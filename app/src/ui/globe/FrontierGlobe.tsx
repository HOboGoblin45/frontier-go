import { useEffect, useRef } from 'react';
import { GlobeScene, type GlobeMarker } from './globeScene';

/**
 * React around the scene. Gestures are handled with pointer events rather than
 * a controls library so that a single tap stays a selection and never becomes
 * a one-pixel drag, which is the difference between a globe that feels
 * responsive and one that feels slippery.
 */
export function FrontierGlobe({
  markers, selectedKey, focus, reducedMotion, active, onSelect,
}: {
  markers: GlobeMarker[];
  selectedKey: string | null;
  focus: { latitude: number; longitude: number; token: number } | null;
  reducedMotion: boolean;
  active: boolean;
  onSelect: (key: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<GlobeScene | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<number | null>(null);
  const movedRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const scene = new GlobeScene({
      canvas,
      reducedMotion,
      onSelect: (key) => onSelectRef.current(key),
    });
    sceneRef.current = scene;

    // Observe the CONTAINER, never the canvas. Observing the canvas couples
    // the measurement to the thing being resized, and any drift between the
    // two turns into a feedback loop rather than a one-pixel error.
    const host = canvas.parentElement ?? canvas;
    let last = { w: 0, h: 0 };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w <= 0 || h <= 0) return;
      if (w === last.w && h === last.h) return;
      last = { w, h };
      scene.resize(w, h);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      observer.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [reducedMotion]);

  useEffect(() => { sceneRef.current?.setMarkers(markers); }, [markers]);
  useEffect(() => { sceneRef.current?.setSelected(selectedKey); }, [selectedKey]);
  useEffect(() => {
    if (focus) sceneRef.current?.flyTo(focus.latitude, focus.longitude);
  }, [focus]);

  // The single most important performance rule in the app: no WebGL loop
  // while the globe is not on screen.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    if (active) scene.start(); else scene.stop();
    const onVisibility = () => {
      if (document.hidden) scene.stop();
      else if (active) scene.start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      scene.stop();
    };
  }, [active]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movedRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const spread = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchRef.current != null && pinchRef.current > 0) {
        sceneRef.current?.zoomBy(spread / pinchRef.current);
      }
      pinchRef.current = spread;
      movedRef.current += 10;
      return;
    }

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    movedRef.current += Math.abs(dx) + Math.abs(dy);
    sceneRef.current?.rotateBy(dx, dy);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (movedRef.current < 8 && sceneRef.current) {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      sceneRef.current.pick(e.clientX, e.clientY, rect);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="globe__canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="img"
      aria-label={`Interactive globe with ${markers.length} locations. A list of the same places is available below.`}
    />
  );
}

export default FrontierGlobe;
export type { GlobeMarker };
