import * as THREE from 'three';
import { latLonToUnitVector } from '../../core/util/geo';
import { buildEarthCanvas } from './earthTexture';

/**
 * The Frontier globe.
 *
 * Restrained on purpose: a dark ocean, moss-coloured land, one warm rim of
 * atmosphere, a thin field of stars, and bronze points where there is
 * something to watch. No neon, no bloom, no rotating hero animation — this is
 * a map of where the footage came from, and it has to still look considered on
 * the twentieth viewing.
 *
 * Rendering pauses whenever the globe is off screen. A WebGL loop running
 * behind the Watch screen would quietly halve the battery life of a product
 * whose entire proposition is being left on.
 */

export interface GlobeMarker {
  key: string;
  latitude: number;
  longitude: number;
  displayName: string;
  count: number;
  visited?: boolean;
  current?: boolean;
}

export interface GlobeOptions {
  canvas: HTMLCanvasElement;
  onSelect?: (key: string | null) => void;
  reducedMotion?: boolean;
}

const EARTH_RADIUS = 1;
const MARKER_LIFT = 1.012;
const FOV = 34;
/** How much empty space to leave around the globe at rest. */
const FIT_MARGIN = 1.22;
const ZOOM_IN = 0.62;
const ZOOM_OUT = 1.5;

const BRONZE = new THREE.Color('#B0886B');
const STONE = new THREE.Color('#D7C9BB');
const BONE = new THREE.Color('#F4EFE7');

function dotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class GlobeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private earth: THREE.Mesh;
  private atmosphere: THREE.Mesh;
  private stars: THREE.Points;
  private markerPoints: THREE.Points | null = null;
  private visitedPoints: THREE.Points | null = null;
  private selectionRing: THREE.Mesh;
  private root = new THREE.Group();

  private markers: GlobeMarker[] = [];
  private markerPositions: THREE.Vector3[] = [];

  private rotation = { x: 0.32, y: -1.2 };
  private velocity = { x: 0, y: 0 };
  private distance = 3.4;
  private targetDistance = 3.4;
  private fitDistance = 3.4;
  private flight: { from: THREE.Vector2; to: THREE.Vector2; t: number; duration: number } | null = null;

  private running = false;
  private frame = 0;
  private lastTime = 0;
  private dotTex = dotTexture();
  private onSelect?: (key: string | null) => void;
  private reducedMotion: boolean;
  private disposed = false;

  constructor(opts: GlobeOptions) {
    this.onSelect = opts.onSelect;
    this.reducedMotion = !!opts.reducedMotion;

    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, this.distance);

    this.scene.add(this.root);

    const texture = new THREE.CanvasTexture(buildEarthCanvas());
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 96, 96),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.94, metalness: 0.0 }),
    );
    this.root.add(this.earth);

    // A single fresnel shell. Cheap, and it is what stops the sphere reading
    // as a flat disc against a black background.
    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.055, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color('#7C8F86') } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec3 vNormal;
          void main() {
            float rim = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
            gl_FragColor = vec4(uColor, clamp(rim, 0.0, 1.0) * 0.5);
          }
        `,
      }),
    );
    this.root.add(this.atmosphere);

    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.028, 0.038, 40),
      new THREE.MeshBasicMaterial({ color: BONE, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.selectionRing.visible = false;
    this.root.add(this.selectionRing);

    this.stars = this.buildStars();
    this.scene.add(this.stars);

    // One warm key from the upper left gives the sphere its terminator; a
    // cool fill keeps the night side from going to pure black, which would
    // read as a hole rather than a planet.
    const key = new THREE.DirectionalLight(0xF4EFE7, 3.1);
    key.position.set(-2.2, 1.3, 2.4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8FA096, 0.6);
    fill.position.set(2.6, -1.0, -1.4);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0xD7C9BB, 0.55));
  }

  private buildStars(): THREE.Points {
    const count = 900;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const v = new THREE.Vector3(
        Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1,
      ).normalize().multiplyScalar(22 + Math.random() * 12);
      positions.set([v.x, v.y, v.z], i * 3);
      sizes[i] = 0.06 + Math.random() * 0.13;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return new THREE.Points(geometry, new THREE.PointsMaterial({
      color: STONE, size: 0.11, sizeAttenuation: true, transparent: true,
      opacity: 0.5, map: this.dotTex, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
  }

  setMarkers(markers: GlobeMarker[]) {
    this.markers = markers;
    this.markerPositions = markers.map((m) => {
      const [x, y, z] = latLonToUnitVector(m.latitude, m.longitude);
      return new THREE.Vector3(x, y, z).multiplyScalar(EARTH_RADIUS * MARKER_LIFT);
    });

    if (this.markerPoints) { this.root.remove(this.markerPoints); this.markerPoints.geometry.dispose(); }
    if (this.visitedPoints) { this.root.remove(this.visitedPoints); this.visitedPoints.geometry.dispose(); }

    const live = markers.map((m, i) => ({ m, i })).filter(({ m }) => !m.visited);
    const seen = markers.map((m, i) => ({ m, i })).filter(({ m }) => m.visited);

    this.markerPoints = this.buildPointCloud(live, BRONZE, 1);
    this.visitedPoints = this.buildPointCloud(seen, STONE, 0.6);
    if (this.markerPoints) this.root.add(this.markerPoints);
    if (this.visitedPoints) this.root.add(this.visitedPoints);
    this.requestFrame();
  }

  private buildPointCloud(
    entries: Array<{ m: GlobeMarker; i: number }>, color: THREE.Color, opacity: number,
  ): THREE.Points | null {
    if (entries.length === 0) return null;
    const positions = new Float32Array(entries.length * 3);
    const sizes = new Float32Array(entries.length);
    entries.forEach(({ m, i }, n) => {
      const p = this.markerPositions[i];
      positions.set([p.x, p.y, p.z], n * 3);
      // Clustering is expressed as size, not as a number badge: a cluster of
      // forty dives should look like a place worth going, not like a counter.
      sizes[n] = 0.05 + Math.min(0.075, Math.log2(1 + m.count) * 0.018);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({
      color, size: 0.105, sizeAttenuation: true, map: this.dotTex,
      transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geometry, material);
  }

  setSelected(key: string | null) {
    const index = key ? this.markers.findIndex((m) => m.key === key) : -1;
    if (index < 0) {
      this.selectionRing.visible = false;
    } else {
      const p = this.markerPositions[index].clone().multiplyScalar(1.01);
      this.selectionRing.position.copy(p);
      this.selectionRing.lookAt(0, 0, 0);
      this.selectionRing.visible = true;
    }
    this.requestFrame();
  }

  /** Smoothly bring a place to the front of the globe. */
  flyTo(latitude: number, longitude: number, immediate = false) {
    const targetY = -((longitude + 180) * Math.PI) / 180 - Math.PI / 2;
    const targetX = (latitude * Math.PI) / 180;
    const to = new THREE.Vector2(targetX, this.shortestAngle(this.rotation.y, targetY));
    if (immediate || this.reducedMotion) {
      this.rotation.x = to.x;
      this.rotation.y = to.y;
      this.flight = null;
    } else {
      this.flight = {
        from: new THREE.Vector2(this.rotation.x, this.rotation.y),
        to, t: 0, duration: 900,
      };
    }
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.requestFrame();
  }

  private shortestAngle(from: number, to: number): number {
    const twoPi = Math.PI * 2;
    let delta = (to - from) % twoPi;
    if (delta > Math.PI) delta -= twoPi;
    if (delta < -Math.PI) delta += twoPi;
    return from + delta;
  }

  // ---------------------------------------------------------- interaction

  rotateBy(dx: number, dy: number) {
    this.flight = null;
    this.rotation.y += dx * 0.005;
    this.rotation.x = THREE.MathUtils.clamp(this.rotation.x + dy * 0.005, -1.2, 1.2);
    this.velocity.y = dx * 0.005;
    this.velocity.x = dy * 0.005;
    this.requestFrame();
  }

  zoomBy(scale: number) {
    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance / scale,
      this.fitDistance * ZOOM_IN,
      this.fitDistance * ZOOM_OUT,
    );
    this.requestFrame();
  }

  /**
   * Hit-testing in screen space rather than by raycasting the point cloud:
   * points have no geometry to hit reliably at a fingertip's precision, and a
   * 26-pixel tolerance is what makes markers tappable on a phone.
   */
  pick(clientX: number, clientY: number, rect: DOMRect): string | null {
    const camera = this.camera;
    let best: { key: string; dist: number } | null = null;
    const projected = new THREE.Vector3();
    const worldMatrix = this.root.matrixWorld;

    this.markers.forEach((marker, index) => {
      projected.copy(this.markerPositions[index]).applyMatrix4(worldMatrix);
      const toCamera = projected.clone().sub(camera.position).normalize();
      const normal = projected.clone().normalize().applyMatrix4(new THREE.Matrix4().extractRotation(worldMatrix));
      // Skip markers on the far side of the sphere.
      if (normal.dot(toCamera) > -0.08) return;
      projected.project(camera);
      const sx = rect.left + ((projected.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - projected.y) / 2) * rect.height;
      const dist = Math.hypot(sx - clientX, sy - clientY);
      if (dist < 26 && (!best || dist < best.dist)) best = { key: marker.key, dist };
    });

    const key = best ? (best as { key: string }).key : null;
    this.setSelected(key);
    this.onSelect?.(key);
    return key;
  }

  // -------------------------------------------------------------- lifecycle

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    // `updateStyle: false` — the stylesheet owns the element's box. Letting
    // three.js write inline width/height here is the other half of the
    // feedback loop the CSS comment in components.css describes.
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // Pull the camera back far enough that the sphere fits the NARROWER of
    // the two field-of-view angles. A fixed distance is only correct on a
    // square viewport: on a tall phone the vertical fov is the limit and the
    // globe was being cropped top and bottom.
    const vHalf = THREE.MathUtils.degToRad(FOV) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const limit = Math.min(vHalf, hHalf);
    const previousFit = this.fitDistance;
    this.fitDistance = (EARTH_RADIUS * FIT_MARGIN) / Math.sin(limit);
    // Preserve the viewer's zoom across a rotation or a keyboard appearing.
    const ratio = previousFit > 0 ? this.targetDistance / previousFit : 1;
    this.targetDistance = THREE.MathUtils.clamp(
      this.fitDistance * ratio,
      this.fitDistance * ZOOM_IN,
      this.fitDistance * ZOOM_OUT,
    );
    if (this.distance === previousFit) this.distance = this.targetDistance;
    this.requestFrame();
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private requestFrame() {
    if (!this.running && !this.disposed) {
      // Render one frame while paused so a change is still reflected.
      this.render(0);
    }
  }

  private loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(48, now - this.lastTime);
    this.lastTime = now;
    this.render(dt);
    this.frame = requestAnimationFrame(this.loop);
  };

  private render(dt: number) {
    if (this.disposed) return;

    if (this.flight) {
      this.flight.t = Math.min(1, this.flight.t + dt / this.flight.duration);
      const e = 1 - (1 - this.flight.t) ** 3;
      this.rotation.x = THREE.MathUtils.lerp(this.flight.from.x, this.flight.to.x, e);
      this.rotation.y = THREE.MathUtils.lerp(this.flight.from.y, this.flight.to.y, e);
      if (this.flight.t >= 1) this.flight = null;
    } else if (!this.reducedMotion) {
      // Inertia, then a very slow drift so a globe left alone is alive but not
      // busy. Reduce Motion stops both.
      this.rotation.y += this.velocity.y;
      this.rotation.x = THREE.MathUtils.clamp(this.rotation.x + this.velocity.x, -1.2, 1.2);
      this.velocity.y *= 0.94;
      this.velocity.x *= 0.94;
      if (Math.abs(this.velocity.y) < 0.00012) this.velocity.y = 0;
      if (Math.abs(this.velocity.x) < 0.00012) this.velocity.x = 0;
      if (this.velocity.x === 0 && this.velocity.y === 0) this.rotation.y += dt * 0.000018;
    }

    this.distance += (this.targetDistance - this.distance) * 0.12;
    this.camera.position.set(0, 0, this.distance);
    this.camera.lookAt(0, 0, 0);

    this.root.rotation.set(this.rotation.x, this.rotation.y, 0);
    this.stars.rotation.set(this.rotation.x * 0.12, this.rotation.y * 0.12, 0);

    if (this.selectionRing.visible && !this.reducedMotion) {
      const pulse = 1 + Math.sin(performance.now() / 420) * 0.08;
      this.selectionRing.scale.setScalar(pulse);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.disposed = true;
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.dotTex.dispose();
    this.renderer.dispose();
  }
}
