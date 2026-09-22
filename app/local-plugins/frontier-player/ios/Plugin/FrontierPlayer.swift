//
//  FrontierPlayer.swift
//  Frontier Go — native playback.
//
//  WHY THIS EXISTS
//
//  The product this replaced played video inside a WKWebView because its
//  content only ever resolved to YouTube ids. That cost it everything a media
//  app needs: no reliable AirPlay, constrained Picture in Picture, no real
//  buffering control, no way to prepare the next item, an ad break between
//  every shuffle, and a playback lifecycle held together by heartbeat timers
//  and watchdogs. Frontier Go streams H.264/HLS assets it is licensed to
//  stream, so playback moves to AVFoundation where it belongs.
//
//  ARCHITECTURE
//
//    AVQueuePlayer      one player, N prepared items
//         |
//    AVPlayerLayer      hosted in a UIView inserted BEHIND the Capacitor
//         |             WKWebView, which is made transparent
//    React UI           floats over the footage; owns every pixel of chrome
//
//  This is the arrangement that makes "90% footage, 10% interface" literal.
//  AVPlayerViewController would have given PiP for free but would also have
//  sat on top of the web view, which would have meant rebuilding the entire
//  interface in UIKit. AVPictureInPictureController works directly against an
//  AVPlayerLayer, so nothing is lost by owning the layer ourselves.
//
//  DIVISION OF LABOUR
//
//  Swift owns the transport: the player, the queue, buffering, errors,
//  AirPlay, PiP, the audio session, Now Playing and the remote command centre.
//  JavaScript owns policy: which item plays next, and what the screen says.
//  The queue here is deliberately shallow (current + up to two prepared) —
//  deep enough that a shuffle is instant, shallow enough that we are never
//  holding several large AVPlayerItems open on a phone.
//
//  ERROR PHILOSOPHY
//
//  A failed item is not an event the viewer should have to deal with. It is
//  marked, reported, and skipped, and the channel keeps playing. There is no
//  modal anywhere in this file.
//

import Foundation
import UIKit
import AVFoundation
import AVKit
import MediaPlayer
import WebKit
import Capacitor

// MARK: - Item description passed across the bridge

struct FrontierPlayableItem {
    let id: String
    let url: URL
    let title: String
    let place: String
    let organization: String
    let artworkUrl: URL?
    let durationHint: Double?

    init?(_ dict: [String: Any]) {
        guard let id = dict["id"] as? String, !id.isEmpty else { return nil }
        guard let raw = dict["url"] as? String,
              let url = URL(string: raw),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" else { return nil }
        self.id = id
        self.url = url
        self.title = dict["title"] as? String ?? ""
        self.place = dict["place"] as? String ?? ""
        self.organization = dict["organization"] as? String ?? ""
        if let art = dict["artworkUrl"] as? String, let artUrl = URL(string: art), artUrl.scheme?.lowercased() == "https" {
            self.artworkUrl = artUrl
        } else {
            self.artworkUrl = nil
        }
        // A JS number reaches Swift as NSNumber, Int or Double depending on how
        // it was serialised, and `as? Double` does not bridge an Int. Read it
        // through NSNumber so a whole-second duration is not silently dropped.
        if let n = dict["durationSeconds"] as? NSNumber {
            self.durationHint = n.doubleValue
        } else {
            self.durationHint = dict["durationSeconds"] as? Double
        }
    }
}

// MARK: - Playback status, mirrored one-for-one in TypeScript

enum FrontierStatus: String {
    case idle, loading, ready, playing, paused, buffering, transitioning, ended, failed
}

// MARK: - Video surface

/// Hosts the `AVPlayerLayer` and reports its own layout.
///
/// `UIView.bounds` is not dependably KVO-compliant, so observing it to keep the
/// layer in step with rotation and split-view resizes would be relying on
/// undefined behaviour. `layoutSubviews` is the documented hook and it fires
/// for every case that matters.
final class FrontierVideoView: UIView {
    var onLayout: (() -> Void)?

    override func layoutSubviews() {
        super.layoutSubviews()
        onLayout?()
    }
}

// MARK: - The engine

final class FrontierPlaybackEngine: NSObject {

    // MARK: Public surface

    /// Called for every state change or event. The plugin forwards these to JS.
    var emit: ((String, [String: Any]) -> Void)?

    private(set) var status: FrontierStatus = .idle {
        didSet { if status != oldValue { emitState(event: eventName(for: status)) } }
    }

    // MARK: Player

    private let player = AVQueuePlayer()
    private let playerLayer: AVPlayerLayer
    private let container = UIView(frame: .zero)
    /// Hosts the player layer. A sibling of the backdrop rather than its
    /// parent, so z-order is explicit instead of depending on whether a
    /// sublayer was added before or after a subview.
    private let videoView = FrontierVideoView(frame: .zero)
    private var videoTopInset = NSLayoutConstraint()
    private var videoBottomInset = NSLayoutConstraint()
    private let backdropView = UIImageView(frame: .zero)
    private let backdropBlur = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))
    private let backdropDim = UIView(frame: .zero)
    private var backdropTask: URLSessionDataTask?
    private weak var hostWebView: UIView?
    private(set) var webViewIsTransparent = false
    private var routePicker: AVRoutePickerView?
    private var pipController: AVPictureInPictureController?

    /// item id keyed by the AVPlayerItem that carries it.
    private var idsByItem: [ObjectIdentifier: FrontierPlayableItem] = [:]
    private var currentItem: FrontierPlayableItem?
    private var lastEmittedItemId: String?

    /// Ids that failed this session. JS is told, and stops sending them.
    private(set) var failedIds: Set<String> = []

    private var timeObserver: Any?
    private var observations: [NSKeyValueObservation] = []
    private var itemObservations: [ObjectIdentifier: [NSKeyValueObservation]] = [:]
    private var artworkTask: URLSessionDataTask?
    private var loadStartedAt: [String: CFAbsoluteTime] = [:]
    private(set) var diagnostics: [String: Any] = [:]

    /// Deeper than this and we are holding large AVPlayerItems open for no
    /// perceptible gain; shallower and a shuffle can hit an unprepared item.
    private let maxQueueDepth = 3

    override init() {
        playerLayer = AVPlayerLayer(player: player)
        super.init()

        player.actionAtItemEnd = .advance
        player.automaticallyWaitsToMinimizeStalling = true
        player.allowsExternalPlayback = true
        player.usesExternalPlaybackWhileExternalScreenIsActive = true
        player.appliesMediaSelectionCriteriaAutomatically = true

        playerLayer.videoGravity = .resizeAspect
        container.backgroundColor = UIColor(red: 0.043, green: 0.059, blue: 0.055, alpha: 1.0) // Forest Black
        container.isUserInteractionEnabled = false

        // Letterbox backdrop.
        //
        // Nearly every asset in the catalog is 16:9 and nearly every viewer is
        // holding a phone upright, so `resizeAspect` is right and the bars are
        // unavoidable. Filling them with the item's own artwork, blurred past
        // legibility and dimmed, turns dead space into the room the picture is
        // hanging in. The web build does the same thing in CSS.
        backdropView.contentMode = .scaleAspectFill
        backdropView.clipsToBounds = true
        backdropView.alpha = 0
        backdropDim.backgroundColor = UIColor.black.withAlphaComponent(0.52)
        // The backdrop fills the whole surface: it is the room the picture
        // hangs in, and it should reach every edge whatever the insets say.
        for view in [backdropView, backdropBlur, backdropDim] {
            view.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(view)
            NSLayoutConstraint.activate([
                view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
                view.topAnchor.constraint(equalTo: container.topAnchor),
                view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            ])
        }

        // The picture itself is inset, because the interface is drawn over
        // this same plane by the web view above. `resizeAspect` centres the
        // frame in whatever rect it is given, so shrinking the rect is what
        // moves the picture clear of the text rather than under it.
        videoView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(videoView)
        videoTopInset = videoView.topAnchor.constraint(equalTo: container.topAnchor)
        videoBottomInset = container.bottomAnchor.constraint(equalTo: videoView.bottomAnchor)
        NSLayoutConstraint.activate([
            videoView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            videoView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            videoTopInset,
            videoBottomInset,
        ])
        videoView.backgroundColor = .clear
        videoView.layer.addSublayer(playerLayer)
        videoView.onLayout = { [weak self] in self?.layoutLayer() }

        configureAudioSession()
        observePlayer()
        observeSystem()
        configureRemoteCommands()
    }

    deinit { teardown() }

    // MARK: Attachment

    /// Insert the video surface beneath the (now transparent) web view.
    func attach(to host: UIView, webView: UIView?) {
        if let web = webView { hostWebView = web }
        fallbackHost = host
        mountSurface()
        makeWebViewTransparent()

        // Capacitor configures the web view during its own view lifecycle,
        // which can run after this does, and WebKit re-derives the under-page
        // colour when the first document paints. One application at attach
        // time was not enough: the first device build came up with the whole
        // interface composited over white, with the video playing underneath
        // where nobody could see it. Re-apply across the launch window.
        for delay in [0.1, 0.4, 1.0, 2.0, 4.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.mountSurface()
                self?.makeWebViewTransparent()
            }
        }

        setupRoutePicker(in: host)
        setupPiP()
        layoutLayer()
    }

    /// Where the surface goes when the web view has no superview yet.
    private weak var fallbackHost: UIView?

    /// Put the video surface where it can actually be seen.
    ///
    /// `CAPBridgeViewController.loadView()` ends with `view = webView`, and
    /// that method is declared `final`. The bridge's "view controller view" is
    /// therefore the WKWebView itself, so inserting the player surface into it
    /// buries the layer inside WebKit's own view hierarchy - underneath a view
    /// whose ordering, clipping and compositing WebKit owns and can redo at any
    /// time. It draws, but only at WebKit's pleasure, and nothing in our code
    /// would notice if it stopped.
    ///
    /// The surface belongs one level up: a sibling of the web view in the
    /// window, ordered below it. The same pixels, with nothing of ours living
    /// inside WebKit.
    ///
    /// Idempotent. The window is not guaranteed to exist when the plugin first
    /// runs, so this is retried from the same places the transparency pass is.
    func mountSurface() {
        let parent: UIView? = hostWebView?.superview ?? fallbackHost
        guard let parent, container.superview !== parent else { return }

        // Constraints die with the old superview; remount cleanly.
        container.removeFromSuperview()
        container.translatesAutoresizingMaskIntoConstraints = false
        parent.insertSubview(container, at: 0)
        NSLayoutConstraint.activate([
            container.leadingAnchor.constraint(equalTo: parent.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: parent.trailingAnchor),
            container.topAnchor.constraint(equalTo: parent.topAnchor),
            container.bottomAnchor.constraint(equalTo: parent.bottomAnchor),
        ])
        if let web = hostWebView, web.superview === parent {
            parent.bringSubviewToFront(web)
        }
        surfaceIsSiblingOfWebView = parent !== hostWebView
        layoutLayer()
    }

    /// False means the surface is still inside the web view - the fallback
    /// position, taken only when the window was not available yet.
    private(set) var surfaceIsSiblingOfWebView = false

    /// True while no web view has been bound. Every call to
    /// `makeWebViewTransparent()` is a silent no-op in that state, so the
    /// plugin re-checks this and rebinds if the bridge produces one later.
    var hostWebViewIsMissing: Bool { hostWebView == nil }

    /// Bind - or rebind - the web view that floats over the player layer.
    ///
    /// Capacitor's bridge does not guarantee `webView` is non-nil at the
    /// moment the video surface is inserted. If it was nil then, the old code
    /// left `hostWebView` nil for the life of the process and the interface
    /// stayed an opaque sheet over the footage with no way back.
    func adoptWebView(_ web: UIView) {
        hostWebView = web
        mountSurface()
        makeWebViewTransparent()
    }

    /// Make the web view see-through so the player layer behind it is visible.
    ///
    /// Three properties matter and only two of them are obvious:
    ///
    ///   isOpaque              - stops UIKit filling the view's rect
    ///   backgroundColor       - the view's own fill
    ///   underPageBackgroundColor - iOS 15+, the colour WebKit paints BEHIND
    ///                           the page, derived from the document and
    ///                           defaulting to white
    ///
    /// The third is the one that bites. A page with a transparent `html`
    /// background still gets an opaque under-page colour, so the web view
    /// stays a white sheet over the video no matter what the CSS says.
    /// Idempotent and cheap; call it as often as necessary.
    func makeWebViewTransparent() {
        guard let web = hostWebView else { return }
        web.isOpaque = false
        web.backgroundColor = .clear
        if let wk = web as? WKWebView {
            wk.scrollView.isOpaque = false
            wk.scrollView.backgroundColor = .clear
            if #available(iOS 15.0, *) {
                wk.underPageBackgroundColor = .clear
            }
        } else if let scroll = web.subviews.compactMap({ $0 as? UIScrollView }).first {
            scroll.isOpaque = false
            scroll.backgroundColor = .clear
        }
        // Whatever the web view sits in must not paint white either.
        web.superview?.backgroundColor = UIColor(red: 0.043, green: 0.059, blue: 0.055, alpha: 1.0)

        let clear = !web.isOpaque && (web.backgroundColor?.cgColor.alpha ?? 1) == 0
        if clear != webViewIsTransparent {
            webViewIsTransparent = clear
            emit?("onVideoSurfaceChanged", ["webViewTransparent": clear])
        }
    }

    /// Move the picture clear of the interface.
    ///
    /// The web view draws the title, the place and the transport over this
    /// same plane. With the video centred in the full surface, a 16:9 frame on
    /// an upright phone lands exactly where the text block is, so the reading
    /// matter sat on the footage - and, with NOAA material, directly on top of
    /// the expedition title card burned into the first seconds of the clip.
    ///
    /// The web layer measures its own chrome and reports it here. Nothing is
    /// assumed about how tall the interface is or which way the phone is held.
    func setVideoInsets(top: CGFloat, bottom: CGFloat, animated: Bool) {
        let top = max(0, top)
        let bottom = max(0, bottom)
        guard videoTopInset.constant != top || videoBottomInset.constant != bottom else { return }
        videoTopInset.constant = top
        videoBottomInset.constant = bottom

        let apply = { [weak self] in
            self?.container.layoutIfNeeded()
            self?.layoutLayer()
        }
        if animated {
            // Matches the scrim's own fade, so the picture and the interface
            // read as one movement rather than two.
            UIView.animate(withDuration: 0.42, delay: 0, options: [.curveEaseInOut, .beginFromCurrentState]) {
                apply()
            }
        } else {
            apply()
        }
    }

    func layoutLayer() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        playerLayer.frame = videoView.bounds.isEmpty ? container.bounds : videoView.bounds
        CATransaction.commit()
    }

    /// Fetch and cross-fade the backdrop for an item. Entirely optional: a
    /// missing or unreachable image leaves the plain dark stage, exactly as
    /// before, and never blocks or delays playback.
    private func setBackdrop(for item: FrontierPlayableItem) {
        backdropTask?.cancel()
        guard let url = item.artworkUrl else {
            UIView.animate(withDuration: 0.3) { self.backdropView.alpha = 0 }
            return
        }
        let wantedId = item.id
        backdropTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data, let image = UIImage(data: data) else { return }
            DispatchQueue.main.async {
                guard self.currentItem?.id == wantedId else { return }
                self.backdropView.image = image
                UIView.animate(withDuration: 0.45) { self.backdropView.alpha = 1 }
            }
        }
        backdropTask?.resume()
    }

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            // .playback keeps sound going with the ringer switch silenced and
            // when the screen locks, which is what an ambient channel needs.
            try session.setCategory(.playback, mode: .moviePlayback, options: [])
            try session.setActive(true, options: [])
        } catch {
            diagnostics["audioSessionError"] = String(describing: error)
        }
    }

    private func setupRoutePicker(in host: UIView) {
        guard routePicker == nil else { return }
        let picker = AVRoutePickerView(frame: .zero)
        picker.prioritizesVideoDevices = true
        picker.isHidden = true
        host.addSubview(picker)
        routePicker = picker
    }

    private func setupPiP() {
        guard pipController == nil, AVPictureInPictureController.isPictureInPictureSupported() else { return }
        // `init(playerLayer:)` is failable in older SDKs and non-failable in
        // current ones. Binding through an explicitly optional local compiles
        // against both, which matters on a project whose only compiler is a CI
        // runner tracking latest-stable Xcode.
        let controller: AVPictureInPictureController? = AVPictureInPictureController(playerLayer: playerLayer)
        guard let controller else { return }
        controller.delegate = self
        // The deployment target is 15.0, so this needs no availability check.
        controller.canStartPictureInPictureAutomaticallyFromInline = true
        pipController = controller
    }

    // MARK: Queue

    /// Replace everything with `item`. Used on first launch and on a hard jump.
    func load(_ item: FrontierPlayableItem, autoplay: Bool) {
        status = .loading
        player.pause()
        player.removeAllItems()
        clearItemObservations()
        idsByItem.removeAll()
        currentItem = nil
        lastEmittedItemId = nil

        guard let playerItem = makeItem(item) else {
            markFailed(item, reason: "could not create player item")
            return
        }
        player.insert(playerItem, after: nil)
        currentItem = item
        setBackdrop(for: item)
        updateNowPlaying(for: item)
        if autoplay { player.play() }
    }

    /// Append a prepared item. This is what makes Shuffle instant: by the time
    /// the viewer taps, the next asset is already opened and buffering.
    @discardableResult
    func enqueue(_ item: FrontierPlayableItem) -> Bool {
        guard !failedIds.contains(item.id) else { return false }
        guard player.items().count < maxQueueDepth else { return false }
        guard !idsByItem.values.contains(where: { $0.id == item.id }) else { return false }
        guard let playerItem = makeItem(item) else { return false }
        player.insert(playerItem, after: player.items().last)
        return true
    }

    func clearQueue(keepCurrent: Bool) {
        let keep = keepCurrent ? player.currentItem : nil
        for item in player.items() where item !== keep {
            player.remove(item)
            removeObservations(for: item)
            idsByItem.removeValue(forKey: ObjectIdentifier(item))
        }
    }

    /// Advance to the already-prepared next item.
    ///
    /// `.transitioning` is emitted first so the interface can start its travel
    /// animation on the same runloop turn as the tap; the picture changes
    /// underneath it. Nothing here waits on the network.
    func skipToNext(reason: String) -> Bool {
        guard player.items().count > 1 else {
            emit?("onQueueStarved", ["reason": reason])
            return false
        }
        status = .transitioning
        player.advanceToNextItem()
        player.play()
        return true
    }

    private func makeItem(_ item: FrontierPlayableItem) -> AVPlayerItem? {
        let asset = AVURLAsset(url: item.url, options: [
            AVURLAssetPreferPreciseDurationAndTimingKey: false,
        ])
        let playerItem = AVPlayerItem(asset: asset)
        // Enough to start smoothly without pulling a large file down on
        // cellular for a clip the viewer may shuffle away from in four seconds.
        playerItem.preferredForwardBufferDuration = 6
        playerItem.preferredPeakBitRate = 0
        idsByItem[ObjectIdentifier(playerItem)] = item
        loadStartedAt[item.id] = CFAbsoluteTimeGetCurrent()
        observe(playerItem)
        return playerItem
    }

    // MARK: Transport

    func play() {
        if player.currentItem == nil { return }
        player.play()
    }

    func pause() { player.pause() }

    func seek(to seconds: Double) {
        let time = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .positiveInfinity)
    }

    func setMuted(_ muted: Bool) {
        player.isMuted = muted
        emitState(event: "onStateChanged")
    }

    func presentRoutePicker() -> Bool {
        guard let picker = routePicker else { return false }
        for sub in picker.subviews {
            if let button = sub as? UIButton {
                button.sendActions(for: .touchUpInside)
                return true
            }
        }
        return false
    }

    func enterPiP() -> Bool {
        guard let pip = pipController, pip.isPictureInPicturePossible else { return false }
        pip.startPictureInPicture()
        return true
    }

    func exitPiP() -> Bool {
        guard let pip = pipController, pip.isPictureInPictureActive else { return false }
        pip.stopPictureInPicture()
        return true
    }

    // MARK: Observation

    private func observePlayer() {
        observations.append(player.observe(\.currentItem, options: [.new]) { [weak self] _, _ in
            self?.currentItemChanged()
        })
        observations.append(player.observe(\.timeControlStatus, options: [.new]) { [weak self] p, _ in
            guard let self else { return }
            switch p.timeControlStatus {
            case .playing: self.status = .playing
            case .paused: if self.status != .ended && self.status != .failed { self.status = .paused }
            case .waitingToPlayAtSpecifiedRate: self.status = .buffering
            @unknown default: break
            }
        })
        observations.append(player.observe(\.isExternalPlaybackActive, options: [.new]) { [weak self] p, _ in
            self?.emit?("onAirPlayChanged", ["active": p.isExternalPlaybackActive])
            self?.emitState(event: "onStateChanged")
        })

        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] _ in
            self?.emitState(event: "onTimeUpdate")
        }
    }

    private func observe(_ item: AVPlayerItem) {
        let key = ObjectIdentifier(item)
        var list: [NSKeyValueObservation] = []
        list.append(item.observe(\.status, options: [.new]) { [weak self] i, _ in
            guard let self else { return }
            switch i.status {
            case .readyToPlay:
                if let info = self.idsByItem[ObjectIdentifier(i)], let started = self.loadStartedAt[info.id] {
                    let ms = Int((CFAbsoluteTimeGetCurrent() - started) * 1000)
                    self.emit?("onItemReady", ["itemId": info.id, "startupMs": ms])
                    self.loadStartedAt.removeValue(forKey: info.id)
                }
                if i === self.player.currentItem, self.status == .loading { self.status = .ready }
            case .failed:
                if let info = self.idsByItem[ObjectIdentifier(i)] {
                    self.markFailed(info, reason: i.error?.localizedDescription ?? "unknown")
                }
                if i === self.player.currentItem { _ = self.skipToNext(reason: "failed") }
                else { self.player.remove(i) }
            default: break
            }
        })
        list.append(item.observe(\.isPlaybackBufferEmpty, options: [.new]) { [weak self] i, _ in
            guard let self, i === self.player.currentItem, i.isPlaybackBufferEmpty else { return }
            if self.status == .playing { self.status = .buffering }
            self.emit?("onBuffering", ["itemId": self.currentItem?.id ?? ""])
        })
        list.append(item.observe(\.isPlaybackLikelyToKeepUp, options: [.new]) { [weak self] i, _ in
            guard let self, i === self.player.currentItem, i.isPlaybackLikelyToKeepUp else { return }
            if self.status == .buffering { self.status = self.player.rate > 0 ? .playing : .ready }
        })
        itemObservations[key] = list

        NotificationCenter.default.addObserver(
            self, selector: #selector(itemDidPlayToEnd(_:)),
            name: .AVPlayerItemDidPlayToEndTime, object: item)
        NotificationCenter.default.addObserver(
            self, selector: #selector(itemFailedToPlayToEnd(_:)),
            name: .AVPlayerItemFailedToPlayToEndTime, object: item)
    }

    private func removeObservations(for item: AVPlayerItem) {
        let key = ObjectIdentifier(item)
        itemObservations[key]?.forEach { $0.invalidate() }
        itemObservations.removeValue(forKey: key)
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: item)
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemFailedToPlayToEndTime, object: item)
    }

    private func clearItemObservations() {
        for (_, list) in itemObservations { list.forEach { $0.invalidate() } }
        itemObservations.removeAll()
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: nil)
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemFailedToPlayToEndTime, object: nil)
    }

    private func observeSystem() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(routeChanged(_:)),
            name: AVAudioSession.routeChangeNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(audioInterrupted(_:)),
            name: AVAudioSession.interruptionNotification, object: nil)
    }

    // MARK: Events

    @objc private func itemDidPlayToEnd(_ note: Notification) {
        guard let item = note.object as? AVPlayerItem else { return }
        let info = idsByItem[ObjectIdentifier(item)]
        emit?("onEnded", ["itemId": info?.id ?? ""])
        // AVQueuePlayer advances on its own (actionAtItemEnd == .advance). If
        // there is nothing to advance to, say so rather than sitting on a
        // frozen frame: a channel that stops is the one failure mode that
        // cannot be hidden.
        if player.items().count <= 1 {
            status = .ended
            emit?("onQueueStarved", ["reason": "ended"])
        } else {
            status = .transitioning
        }
    }

    @objc private func itemFailedToPlayToEnd(_ note: Notification) {
        guard let item = note.object as? AVPlayerItem else { return }
        let err = note.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
        if let info = idsByItem[ObjectIdentifier(item)] {
            markFailed(info, reason: err?.localizedDescription ?? "failed to play to end")
        }
        _ = skipToNext(reason: "failed-to-end")
    }

    @objc private func routeChanged(_ note: Notification) {
        let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
        let airplay = outputs.contains { $0.portType == .airPlay }
        let names = outputs.map { $0.portName }
        emit?("onRouteChanged", ["airPlay": airplay, "outputs": names])
        emit?("onAirPlayChanged", ["active": airplay || player.isExternalPlaybackActive])
    }

    @objc private func audioInterrupted(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        if type == .began {
            status = .paused
        } else if type == .ended {
            let opts = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            if AVAudioSession.InterruptionOptions(rawValue: opts).contains(.shouldResume) {
                try? AVAudioSession.sharedInstance().setActive(true)
                player.play()
            }
        }
    }

    private func currentItemChanged() {
        guard let item = player.currentItem else {
            currentItem = nil
            return
        }
        guard let info = idsByItem[ObjectIdentifier(item)] else { return }
        currentItem = info
        if lastEmittedItemId != info.id {
            lastEmittedItemId = info.id
            setBackdrop(for: info)
            updateNowPlaying(for: info)
            emit?("onItemChanged", ["itemId": info.id, "queueDepth": player.items().count])
        }
        if player.rate > 0 { status = .playing }
    }

    private func markFailed(_ item: FrontierPlayableItem, reason: String) {
        failedIds.insert(item.id)
        emit?("onError", ["itemId": item.id, "message": reason, "fatal": false])
    }

    private func eventName(for s: FrontierStatus) -> String {
        switch s {
        case .playing: return "onPlaying"
        case .paused: return "onPaused"
        case .buffering: return "onBuffering"
        case .ready: return "onReady"
        case .ended: return "onEnded"
        case .failed: return "onError"
        case .transitioning: return "onTransitioning"
        case .loading: return "onLoading"
        case .idle: return "onStateChanged"
        }
    }

    func stateDictionary() -> [String: Any] {
        let current = player.currentItem
        let duration = current?.duration.seconds ?? 0
        let buffered = current?.loadedTimeRanges.first?.timeRangeValue
        let bufferedEnd = buffered.map { CMTimeGetSeconds($0.start) + CMTimeGetSeconds($0.duration) } ?? 0
        let position = player.currentTime().seconds
        return [
            "status": status.rawValue,
            "itemId": currentItem?.id ?? NSNull(),
            "positionSeconds": position.isFinite ? position : 0,
            "durationSeconds": duration.isFinite ? duration : (currentItem?.durationHint ?? 0),
            "bufferedSeconds": bufferedEnd.isFinite ? max(0, bufferedEnd - (position.isFinite ? position : 0)) : 0,
            "muted": player.isMuted,
            "airPlayActive": player.isExternalPlaybackActive
                || AVAudioSession.sharedInstance().currentRoute.outputs.contains { $0.portType == .airPlay },
            "pipActive": pipController?.isPictureInPictureActive ?? false,
            "queueDepth": player.items().count,
            "failedIds": Array(failedIds),
        ]
    }

    private func emitState(event: String) {
        emit?(event, stateDictionary())
    }

    // MARK: Now Playing and remote commands

    private func configureRemoteCommands() {
        let centre = MPRemoteCommandCenter.shared()
        centre.playCommand.isEnabled = true
        centre.pauseCommand.isEnabled = true
        centre.togglePlayPauseCommand.isEnabled = true
        centre.nextTrackCommand.isEnabled = true
        centre.previousTrackCommand.isEnabled = true
        centre.changePlaybackPositionCommand.isEnabled = true
        // Seek-by-interval is meaningless on a shuffle channel and puts two
        // controls on the lock screen that do almost nothing.
        centre.skipForwardCommand.isEnabled = false
        centre.skipBackwardCommand.isEnabled = false

        centre.playCommand.addTarget { [weak self] _ in self?.play(); return .success }
        centre.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }
        centre.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            if self.player.rate > 0 { self.pause() } else { self.play() }
            return .success
        }
        // Next means Shuffle. On this product they are the same gesture, and
        // mapping them apart would be a lie told on the lock screen.
        centre.nextTrackCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            self.emit?("onRemoteCommand", ["command": "shuffle"])
            return self.skipToNext(reason: "remote") ? .success : .noSuchContent
        }
        centre.previousTrackCommand.addTarget { [weak self] _ in
            self?.emit?("onRemoteCommand", ["command": "previous"])
            return .success
        }
        centre.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let self, let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self.seek(to: e.positionTime)
            return .success
        }
    }

    private func updateNowPlaying(for item: FrontierPlayableItem) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: item.title.isEmpty ? "Frontier Go" : item.title,
            MPMediaItemPropertyArtist: item.place.isEmpty ? "frontier go" : item.place,
            MPMediaItemPropertyAlbumTitle: item.organization.isEmpty ? "frontier go" : item.organization,
            MPNowPlayingInfoPropertyIsLiveStream: false,
            MPNowPlayingInfoPropertyPlaybackRate: player.rate,
        ]
        if let d = item.durationHint, d > 0 { info[MPMediaItemPropertyPlaybackDuration] = d }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        artworkTask?.cancel()
        guard let url = item.artworkUrl else { return }
        artworkTask = URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data, let image = UIImage(data: data) else { return }
            DispatchQueue.main.async {
                guard MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPMediaItemPropertyTitle] as? String == info[MPMediaItemPropertyTitle] as? String else { return }
                var updated = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                updated[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                MPNowPlayingInfoCenter.default().nowPlayingInfo = updated
            }
        }
        artworkTask?.resume()
    }

    func setNowPlayingMetadata(title: String, place: String, organization: String, artworkUrl: String?) {
        let shim = FrontierPlayableItem([
            "id": currentItem?.id ?? "manual",
            "url": currentItem?.url.absoluteString ?? "https://invalid.invalid/none.mp4",
            "title": title, "place": place, "organization": organization,
            "artworkUrl": artworkUrl as Any,
        ])
        if let shim { updateNowPlaying(for: shim) }
    }

    // MARK: Teardown

    func teardown() {
        if let t = timeObserver { player.removeTimeObserver(t); timeObserver = nil }
        observations.forEach { $0.invalidate() }
        observations.removeAll()
        clearItemObservations()
        NotificationCenter.default.removeObserver(self)
        artworkTask?.cancel()
        backdropTask?.cancel()
        player.pause()
        player.removeAllItems()
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }
}

// MARK: - PiP

extension FrontierPlaybackEngine: AVPictureInPictureControllerDelegate {
    func pictureInPictureControllerDidStartPictureInPicture(_ c: AVPictureInPictureController) {
        emit?("onPiPChanged", ["active": true])
    }
    func pictureInPictureControllerDidStopPictureInPicture(_ c: AVPictureInPictureController) {
        emit?("onPiPChanged", ["active": false])
    }
    func pictureInPictureController(_ c: AVPictureInPictureController,
                                    failedToStartPictureInPictureWithError error: Error) {
        emit?("onPiPChanged", ["active": false, "error": error.localizedDescription])
    }
    func pictureInPictureController(
        _ c: AVPictureInPictureController,
        restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void
    ) {
        // The interface never went anywhere — the web view was on screen the
        // whole time — so restoration is immediate. Telling JS anyway keeps its
        // mirrored state honest.
        emit?("onPiPChanged", ["active": false, "restored": true])
        completionHandler(true)
    }
}

// MARK: - Capacitor plugin

@objc(FrontierPlayer)
public class FrontierPlayer: CAPPlugin, CAPBridgedPlugin {

    // Capacitor 6+ binds only plugins that conform to CAPBridgedPlugin and
    // declare all three of these. Omitting them does not fail the build; it
    // makes the entire native layer silently unreachable from JS.
    public let identifier = "FrontierPlayer"
    public let jsName = "FrontierPlayer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enqueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "skipToNext", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMuted", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enterPiP", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exitPiP", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentRoutePicker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNowPlayingMetadata", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVideoInsets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDiagnostics", returnType: CAPPluginReturnPromise),
    ]

    private var engine: FrontierPlaybackEngine?
    private var attached = false

    public override func load() {
        let engine = FrontierPlaybackEngine()
        engine.emit = { [weak self] name, payload in
            DispatchQueue.main.async { self?.notifyListeners(name, data: payload) }
        }
        self.engine = engine
        DispatchQueue.main.async { [weak self] in self?.attachIfNeeded() }

        // There is no `willAppear` to override.
        //
        // `CAPPlugin` exposes `load()` and nothing else in the view lifecycle,
        // so re-attaching when the app comes forward is done by observing the
        // application rather than the plugin. Layout while the app is running
        // is handled separately, by the KVO on the video view's bounds in the
        // engine, which also covers rotation and split view.
        NotificationCenter.default.addObserver(
            self, selector: #selector(applicationDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func applicationDidBecomeActive() {
        DispatchQueue.main.async { [weak self] in
            self?.attachIfNeeded()
            // Unguarded by `attached`: the point is to re-assert placement and
            // transparency that something else may have reset while we were away.
            self?.engine?.mountSurface()
            self?.engine?.makeWebViewTransparent()
            self?.engine?.layoutLayer()
        }
    }

    /// Idempotent, and retried from several entry points: the bridge's view
    /// controller is not guaranteed to exist when `load()` runs.
    private func attachIfNeeded() {
        guard let engine else { return }
        if attached {
            if engine.hostWebViewIsMissing, let web = bridge?.webView {
                engine.adoptWebView(web)
            }
            return
        }
        guard let host = bridge?.viewController?.view else { return }
        engine.attach(to: host, webView: bridge?.webView)
        attached = true
    }

    // MARK: Methods

    @objc func load(_ call: CAPPluginCall) {
        guard let dict = call.getObject("item"), let item = FrontierPlayableItem(dict) else {
            call.reject("load requires an item with an id and an https url")
            return
        }
        let autoplay = call.getBool("autoplay") ?? true
        DispatchQueue.main.async {
            self.attachIfNeeded()
            self.engine?.mountSurface()
            self.engine?.makeWebViewTransparent()
            self.engine?.load(item, autoplay: autoplay)
            call.resolve(["loaded": true, "itemId": item.id])
        }
    }

    @objc func enqueue(_ call: CAPPluginCall) {
        guard let dict = call.getObject("item"), let item = FrontierPlayableItem(dict) else {
            call.resolve(["queued": false, "reason": "invalid-item"])
            return
        }
        DispatchQueue.main.async {
            let ok = self.engine?.enqueue(item) ?? false
            call.resolve(["queued": ok, "itemId": item.id])
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.engine?.play(); call.resolve(["playing": true]) }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.engine?.pause(); call.resolve(["paused": true]) }
    }

    @objc func skipToNext(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "user"
        DispatchQueue.main.async {
            let advanced = self.engine?.skipToNext(reason: reason) ?? false
            call.resolve(["advanced": advanced])
        }
    }

    @objc func seek(_ call: CAPPluginCall) {
        let seconds = call.getDouble("seconds") ?? 0
        DispatchQueue.main.async { self.engine?.seek(to: seconds); call.resolve(["sought": true]) }
    }

    @objc func setMuted(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        DispatchQueue.main.async { self.engine?.setMuted(muted); call.resolve(["muted": muted]) }
    }

    @objc func clearQueue(_ call: CAPPluginCall) {
        let keepCurrent = call.getBool("keepCurrent") ?? true
        DispatchQueue.main.async { self.engine?.clearQueue(keepCurrent: keepCurrent); call.resolve(["cleared": true]) }
    }

    @objc func enterPiP(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["entered": self.engine?.enterPiP() ?? false]) }
    }

    @objc func exitPiP(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["exited": self.engine?.exitPiP() ?? false]) }
    }

    @objc func presentRoutePicker(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.attachIfNeeded()
            call.resolve(["presented": self.engine?.presentRoutePicker() ?? false])
        }
    }

    @objc func getState(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.engine?.stateDictionary() ?? ["status": "idle"]) }
    }

    @objc func setNowPlayingMetadata(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? ""
        let place = call.getString("place") ?? ""
        let org = call.getString("organization") ?? ""
        let art = call.getString("artworkUrl")
        DispatchQueue.main.async {
            self.engine?.setNowPlayingMetadata(title: title, place: place, organization: org, artworkUrl: art)
            call.resolve(["applied": true])
        }
    }

    /// Surfaced on the About screen. "Native player: active" is the one line
    /// that distinguishes a working build from one where the bridge silently
    /// fell back to the web implementation.
    @objc func setVideoInsets(_ call: CAPPluginCall) {
        let top = CGFloat(call.getDouble("top") ?? 0)
        let bottom = CGFloat(call.getDouble("bottom") ?? 0)
        let animated = call.getBool("animated") ?? true
        DispatchQueue.main.async {
            self.engine?.setVideoInsets(top: top, bottom: bottom, animated: animated)
            call.resolve(["top": Double(top), "bottom": Double(bottom)])
        }
    }

    @objc func getDiagnostics(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // `webViewTransparent` is the one line that explains a build where
            // the sound plays and the picture does not: if it is false, the web
            // view is a sheet over the video.
            self.attachIfNeeded()
            self.engine?.mountSurface()
            self.engine?.makeWebViewTransparent()
            call.resolve([
                "native": true,
                "attached": self.attached,
                "webViewBound": !(self.engine?.hostWebViewIsMissing ?? true),
                "surfaceDetached": self.engine?.surfaceIsSiblingOfWebView ?? false,
                "webViewTransparent": self.engine?.webViewIsTransparent ?? false,
                "pipSupported": AVPictureInPictureController.isPictureInPictureSupported(),
                "audioSessionCategory": AVAudioSession.sharedInstance().category.rawValue,
                "state": self.engine?.stateDictionary() ?? [:],
            ])
        }
    }
}
