# frontier-player

Native playback for frontier go. An `AVQueuePlayer` rendering to an
`AVPlayerLayer` that is hosted **behind** the Capacitor `WKWebView`, which is
made transparent so the React interface floats over the footage.

Swift owns the transport: the player, the queue, buffering, errors, AirPlay,
Picture in Picture, the audio session, Now Playing and the remote command
centre. JavaScript owns policy — which item plays next, and what the screen
says.

## Why not AVPlayerViewController

It would have given Picture in Picture for free, and it would have sat on top
of the web view, which would have meant rebuilding the entire interface in
UIKit. `AVPictureInPictureController` works directly against an
`AVPlayerLayer`, so owning the layer costs nothing and keeps every pixel of
chrome in React.

## Registration

The Swift class conforms to `CAPBridgedPlugin` **and** ships the `CAP_PLUGIN`
macro in `FrontierPlayer.m`. Both are required: since Capacitor 6 the bridge
binds only classes conforming to `CAPBridgedPlugin`, and a plugin that is
missing it does not fail to build — it becomes invisible to JavaScript, and
`registerPlugin` quietly falls back to the web implementation. This project
lost a release cycle to exactly that.

The app surfaces the binding state on its Profile screen. It must read
`Native AVFoundation · active`.

## Testing without a Mac

```bash
# syntax-check the whole plugin
swiftc -frontend -parse ios/Plugin/FrontierPlayer.swift

# compile and RUN the Foundation-only logic
ios/Tests/extract-and-run.sh
```

`extract-and-run.sh` lifts `FrontierPlayableItem` verbatim out of the plugin,
diffs the copy back against the source so a stale harness fails rather than
passes, and exercises the parser: https-only URLs, id validation, artwork
fallback. UIKit and AVFoundation typechecking remains a macOS CI gate.

## API

```
load({ item, autoplay })     replace the queue and start
enqueue({ item })            append a prepared item (queue depth 3)
play() / pause()
skipToNext({ reason })       advance to the already-prepared item
seek({ seconds })
setMuted({ muted })
clearQueue({ keepCurrent })
enterPiP() / exitPiP()
presentRoutePicker()         the system AirPlay picker
getState()                   the authoritative playback state
setNowPlayingMetadata({ ... })
getDiagnostics()             native: true is the signal that matters
```

Events: `onLoading`, `onReady`, `onPlaying`, `onPaused`, `onBuffering`,
`onEnded`, `onError`, `onItemChanged`, `onItemReady`, `onTransitioning`,
`onTimeUpdate`, `onStateChanged`, `onRouteChanged`, `onAirPlayChanged`,
`onPiPChanged`, `onQueueStarved`, `onRemoteCommand`.
