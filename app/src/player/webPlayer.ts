import { WebPlugin } from '@capacitor/core';
import type { FrontierPlayerPlugin, PlayableItem } from './types';

/**
 * Web implementation.
 *
 * Not a stub and not a fallback for iOS — on iOS this file must never run, and
 * the wrapper says so loudly if it does. It exists because the browser build is
 * a real target (development, CI smoke checks, and eventually a web version),
 * and because reproducing the native contract in the DOM is the cheapest way to
 * keep the two honest about what the contract actually is.
 *
 * It mirrors the native design: a visible current element and a hidden,
 * already-buffering next element, so a shuffle is a swap rather than a load.
 */

const STAGE_ID = 'frontier-stage';

function stage(): HTMLElement {
  let el = document.getElementById(STAGE_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = STAGE_ID;
    document.body.insertBefore(el, document.body.firstChild);
  }
  return el;
}

/**
 * The blurred artwork plane behind the video. Mirrors what the native engine
 * does behind its AVPlayerLayer, so the two platforms letterbox the same way.
 */
function backdrop(): HTMLDivElement {
  let el = stage().querySelector<HTMLDivElement>('.stage-backdrop');
  if (!el) {
    el = document.createElement('div');
    el.className = 'stage-backdrop';
    stage().insertBefore(el, stage().firstChild);
  }
  return el;
}

function setBackdrop(url?: string) {
  const el = backdrop();
  if (url) {
    el.style.backgroundImage = `url(${JSON.stringify(url)})`;
    el.classList.add('is-visible');
  } else {
    el.classList.remove('is-visible');
  }
}

function makeVideo(): HTMLVideoElement {
  const v = document.createElement('video');
  v.playsInline = true;
  v.preload = 'auto';
  v.controls = false;
  // No crossOrigin attribute, deliberately.
  //
  // Setting it to 'anonymous' turns a plain media fetch into a CORS request,
  // and neither NOAA Ocean Exploration nor the NASA asset CDN sends
  // Access-Control-Allow-Origin on video files — so every clip failed to load
  // in the browser while working perfectly on device, where AVPlayer does no
  // CORS at all. Nothing here reads the pixels back, so there is nothing to
  // gain from the tainted-canvas protection it buys.
  v.setAttribute('x-webkit-airplay', 'allow');
  return v;
}

export class WebFrontierPlayer extends WebPlugin implements FrontierPlayerPlugin {
  private current: HTMLVideoElement | null = null;
  private nextEl: HTMLVideoElement | null = null;
  private currentItem: PlayableItem | null = null;
  private nextItem: PlayableItem | null = null;
  private failed = new Set<string>();
  private muted = false;
  private status = 'idle';

  private setStatus(next: string, event?: string) {
    this.status = next;
    this.notifyListeners(event || 'onStateChanged', this.snapshot());
  }

  private snapshot(): Record<string, unknown> {
    const v = this.current;
    const buffered = v && v.buffered.length > 0 ? v.buffered.end(v.buffered.length - 1) : 0;
    return {
      status: this.status,
      itemId: this.currentItem?.id ?? null,
      positionSeconds: v?.currentTime ?? 0,
      durationSeconds: Number.isFinite(v?.duration ?? NaN) ? (v as HTMLVideoElement).duration : (this.currentItem?.durationSeconds ?? 0),
      bufferedSeconds: Math.max(0, buffered - (v?.currentTime ?? 0)),
      muted: this.muted,
      airPlayActive: false,
      pipActive: !!document.pictureInPictureElement,
      queueDepth: (this.current ? 1 : 0) + (this.nextEl ? 1 : 0),
      failedIds: [...this.failed],
    };
  }

  private bind(v: HTMLVideoElement, item: PlayableItem) {
    v.onplaying = () => this.setStatus('playing', 'onPlaying');
    v.onpause = () => { if (this.status !== 'ended') this.setStatus('paused', 'onPaused'); };
    v.onwaiting = () => this.setStatus('buffering', 'onBuffering');
    v.oncanplay = () => {
      if (this.status === 'loading') this.setStatus('ready', 'onReady');
      this.notifyListeners('onItemReady', { itemId: item.id });
    };
    v.ontimeupdate = () => this.notifyListeners('onTimeUpdate', this.snapshot());
    v.onended = () => {
      this.notifyListeners('onEnded', { itemId: item.id });
      if (this.nextEl) void this.skipToNext({ reason: 'ended' });
      else { this.setStatus('ended', 'onEnded'); this.notifyListeners('onQueueStarved', { reason: 'ended' }); }
    };
    v.onerror = () => {
      this.failed.add(item.id);
      this.notifyListeners('onError', { itemId: item.id, message: 'media error', fatal: false });
      if (this.nextEl) void this.skipToNext({ reason: 'failed' });
      else this.notifyListeners('onQueueStarved', { reason: 'failed' });
    };
  }

  async load(options: { item: PlayableItem; autoplay?: boolean }) {
    const { item, autoplay = true } = options;
    this.setStatus('loading', 'onLoading');
    this.current?.remove();
    this.nextEl?.remove();
    this.nextEl = null;
    this.nextItem = null;

    setBackdrop(item.artworkUrl);
    const v = makeVideo();
    // The agency's own frame while the file loads, instead of a black box.
    if (item.artworkUrl) v.poster = item.artworkUrl;
    v.src = item.url;
    v.muted = this.muted;
    this.bind(v, item);
    stage().appendChild(v);
    this.current = v;
    this.currentItem = item;
    if (autoplay) {
      // Autoplay with sound is blocked until the page has a gesture. Falling
      // back to muted keeps the picture moving instead of showing a dead frame.
      v.play().catch(() => { v.muted = true; this.muted = true; v.play().catch(() => {}); });
    }
    this.notifyListeners('onItemChanged', { itemId: item.id });
    return { loaded: true, itemId: item.id };
  }

  async enqueue(options: { item: PlayableItem }) {
    const item = options.item;
    if (this.failed.has(item.id) || this.nextEl) return { queued: false };
    const v = makeVideo();
    if (item.artworkUrl) v.poster = item.artworkUrl;
    v.src = item.url;
    v.muted = true;
    v.style.display = 'none';
    stage().appendChild(v);
    this.nextEl = v;
    this.nextItem = item;
    return { queued: true, itemId: item.id };
  }

  async play() { await this.current?.play().catch(() => {}); return { playing: true }; }
  async pause() { this.current?.pause(); return { paused: true }; }

  async skipToNext(options?: { reason?: string }) {
    if (!this.nextEl || !this.nextItem) {
      this.notifyListeners('onQueueStarved', { reason: options?.reason || 'user' });
      return { advanced: false };
    }
    const v = this.nextEl;
    const item = this.nextItem;
    this.setStatus('transitioning', 'onTransitioning');
    setBackdrop(item.artworkUrl);
    this.current?.remove();
    this.nextEl = null;
    this.nextItem = null;
    v.style.display = '';
    v.muted = this.muted;
    this.bind(v, item);
    this.current = v;
    this.currentItem = item;
    v.play().catch(() => {});
    this.notifyListeners('onItemChanged', { itemId: item.id });
    return { advanced: true };
  }

  async seek(options: { seconds: number }) {
    if (this.current) this.current.currentTime = Math.max(0, options.seconds);
    return { sought: true };
  }

  async setMuted(options: { muted: boolean }) {
    this.muted = options.muted;
    if (this.current) this.current.muted = options.muted;
    this.notifyListeners('onStateChanged', this.snapshot());
    return { muted: options.muted };
  }

  async clearQueue(options?: { keepCurrent?: boolean }) {
    this.nextEl?.remove();
    this.nextEl = null;
    this.nextItem = null;
    if (options?.keepCurrent === false) {
      this.current?.remove();
      this.current = null;
      this.currentItem = null;
    }
    return { cleared: true };
  }

  async enterPiP() {
    try {
      if (this.current && document.pictureInPictureEnabled) {
        await this.current.requestPictureInPicture();
        this.notifyListeners('onPiPChanged', { active: true });
        return { entered: true };
      }
    } catch { /* PiP is a courtesy, never a failure path */ }
    return { entered: false };
  }

  async exitPiP() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        this.notifyListeners('onPiPChanged', { active: false });
        return { exited: true };
      }
    } catch { /* noop */ }
    return { exited: false };
  }

  async presentRoutePicker() { return { presented: false }; }
  /** No AirPlay picker on the web. The last frame is kept for the browser harness. */
  async setRoutePickerFrame(frame: { x: number; y: number; width: number; height: number; visible: boolean }) {
    (window as unknown as { __routePickerFrame?: unknown }).__routePickerFrame = frame;
    return { state: 'none' };
  }

  /**
   * The web half of the same contract. The native player insets its layer;
   * here the stage carries the numbers as custom properties and the CSS puts
   * the video element inside them.
   */
  async setVideoInsets({ top, bottom }: { top: number; bottom: number; animated?: boolean }) {
    const el = stage();
    el.style.setProperty('--video-inset-top', `${Math.max(0, top)}px`);
    el.style.setProperty('--video-inset-bottom', `${Math.max(0, bottom)}px`);
    return { top, bottom };
  }

  async getState() { return this.snapshot() as never; }
  async setNowPlayingMetadata() { return { applied: false }; }
  async getDiagnostics() {
    return { native: false, implementation: 'web-video-element', pipSupported: !!document.pictureInPictureEnabled };
  }
}
