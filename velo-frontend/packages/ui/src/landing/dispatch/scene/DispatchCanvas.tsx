"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { generateDispatchCoordinates, pointAlongRoute, type DispatchCoordinates, type Point2 } from "./coordinates";
import type { SampleTrip } from "../sample-trips";
import styles from "../dispatch.module.css";

export type PreviewPhase = "idle" | "assign" | "route" | "travel" | "paused" | "complete";

export type DispatchCanvasProps = {
  selectedTripId: SampleTrip["id"];
  previewPhase: PreviewPhase;
  previewRunId: number;
  resetVersion: number;
  onReady: () => void;
  onFallback: () => void;
};

declare global {
  interface Window {
    __VELO_DISPATCH_DEBUG__?: { frames: number };
  }
}

const TRAVEL_DURATION_MS = 2_360;
const TILT_LIMIT = THREE.MathUtils.degToRad(8);
const VEHICLE_STARTS = [0.08, 0.7, 0.08, 0.7, 0.08, 0.7] as const;

type Palette = {
  ground: THREE.Color;
  street: THREE.Color;
  building: THREE.Color;
  roof: THREE.Color;
  window: THREE.Color;
  vehicle: THREE.Color;
  route: THREE.Color;
  routeAlt: THREE.Color;
  sodium: THREE.Color;
};

const INTRO_MS = 3_200;

/** Deterministic PRNG so the night scene looks the same on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Soft round sprite for lamp and headlight glows (generated, no network). */
function glowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Radial alpha mask so the ground fades into the night sky behind the canvas. */
function groundFadeTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

type Runtime = {
  updateState: (tripId: SampleTrip["id"], phase: PreviewPhase, runId: number) => void;
  resetView: () => void;
};

function readToken(element: HTMLElement, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

function colorFromToken(element: HTMLElement, name: string): THREE.Color {
  const value = readToken(element, name);
  const color = new THREE.Color();
  color.setStyle(value);
  return color;
}

function readPalette(element: HTMLElement): Palette {
  return {
    ground: colorFromToken(element, "--dispatch-ground"),
    street: colorFromToken(element, "--dispatch-street"),
    building: colorFromToken(element, "--dispatch-building"),
    roof: colorFromToken(element, "--dispatch-roof"),
    window: colorFromToken(element, "--dispatch-window"),
    vehicle: colorFromToken(element, "--dispatch-vehicle"),
    route: colorFromToken(element, "--dispatch-route"),
    routeAlt: colorFromToken(element, "--dispatch-route-alt"),
    sodium: colorFromToken(element, "--dispatch-sodium"),
  };
}

function ribbonGeometry(paths: readonly Point2[][], width: number, height: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  const halfWidth = width / 2;

  for (const path of paths) {
    for (let index = 1; index < path.length; index += 1) {
      const start = path[index - 1];
      const end = path[index];
      if (!start || !end) continue;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz) || 1;
      const offsetX = (-dz / length) * halfWidth;
      const offsetZ = (dx / length) * halfWidth;
      const base = vertices.length / 3;
      vertices.push(
        start.x + offsetX, height, start.z + offsetZ,
        start.x - offsetX, height, start.z - offsetZ,
        end.x + offsetX, height, end.z + offsetZ,
        end.x - offsetX, height, end.z - offsetZ,
      );
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry;
}

function makeBuildingInstances(
  scene: THREE.Scene,
  coordinates: DispatchCoordinates,
  palette: Palette,
): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const sides = new THREE.MeshLambertMaterial({ color: palette.building });
  const roof = new THREE.MeshLambertMaterial({ color: palette.roof });
  const materials = [sides, sides, roof, sides, sides, sides];
  const buildings = [...coordinates.buildings, ...coordinates.landmarks];
  const instances = new THREE.InstancedMesh(geometry, materials, buildings.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  buildings.forEach((building, index) => {
    position.set(building.x, building.height / 2, building.z);
    scale.set(building.width, building.height, building.depth);
    matrix.compose(position, rotation, scale);
    instances.setMatrixAt(index, matrix);
  });
  instances.instanceMatrix.needsUpdate = true;
  instances.computeBoundingSphere();
  scene.add(instances);
  return instances;
}

/** Lit window bands on the two camera-facing sides of every building: one instanced draw call. */
function makeWindowInstances(coordinates: DispatchCoordinates, palette: Palette): THREE.InstancedMesh {
  const random = mulberry32(5_40);
  const bands: { x: number; y: number; z: number; sx: number; sz: number }[] = [];
  for (const building of [...coordinates.buildings, ...coordinates.landmarks]) {
    const floors = Math.max(1, Math.floor(building.height / 0.42));
    for (let floor = 0; floor < floors; floor += 1) {
      const y = 0.26 + floor * 0.42;
      if (y > building.height - 0.12) break;
      if (random() < 0.5) bands.push({ x: building.x + building.width / 2 + 0.012, y, z: building.z, sx: 0.02, sz: building.depth * 0.7 });
      if (random() < 0.5) bands.push({ x: building.x, y, z: building.z + building.depth / 2 + 0.012, sx: building.width * 0.7, sz: 0.02 });
    }
  }
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: palette.window, toneMapped: false });
  const windows = new THREE.InstancedMesh(geometry, material, Math.max(1, bands.length));
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const tint = new THREE.Color();
  bands.forEach((band, index) => {
    position.set(band.x, band.y, band.z);
    scale.set(band.sx, 0.1, band.sz);
    matrix.compose(position, rotation, scale);
    windows.setMatrixAt(index, matrix);
    // Brightness only: the windows are sodium at night and pale glazing by day, never blue.
    tint.setRGB(1, 1, 1).multiplyScalar(0.78 + random() * 0.4);
    windows.setColorAt(index, tint);
  });
  windows.count = bands.length;
  windows.instanceMatrix.needsUpdate = true;
  if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  return windows;
}

function makeGlowPoints(positions: Point2[], color: THREE.Color, size: number, height: number, opacity: number, texture: THREE.Texture): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const array = new Float32Array(Math.max(1, positions.length) * 3);
  positions.forEach((point, index) => array.set([point.x, height, point.z], index * 3));
  geometry.setAttribute("position", new THREE.BufferAttribute(array, 3));
  const material = new THREE.PointsMaterial({
    color,
    map: texture,
    size,
    sizeAttenuation: false,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  return new THREE.Points(geometry, material);
}

function addVehicles(scene: THREE.Scene, palette: Palette, count: number): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(0.54, 0.2, 0.3);
  const material = new THREE.MeshLambertMaterial({ color: "white" });
  const vehicles = new THREE.InstancedMesh(geometry, material, count);
  const color = new THREE.Color();
  for (let index = 0; index < count; index += 1) {
    color.copy(palette.vehicle);
    vehicles.setColorAt(index, color);
  }
  vehicles.instanceColor!.needsUpdate = true;
  scene.add(vehicles);
  return vehicles;
}

function makeRibbonMaterial(color: THREE.Color, opacity: number, additive = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function getRouteIndex(id: SampleTrip["id"]): number {
  return id === "05:40" ? 0 : id === "09:15" ? 1 : 2;
}

export function DispatchCanvas({
  selectedTripId,
  previewPhase,
  previewRunId,
  resetVersion,
  onReady,
  onFallback,
}: DispatchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const propsRef = useRef({ selectedTripId, previewPhase, previewRunId, onReady, onFallback });
  propsRef.current = { selectedTripId, previewPhase, previewRunId, onReady, onFallback };

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "low-power",
      });
    } catch {
      propsRef.current.onFallback();
      return;
    }

    const coordinates = generateDispatchCoordinates();
    const palette = readPalette(root);
    const scene = new THREE.Scene();
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
    const glow = glowTexture();
    const groundFade = groundFadeTexture();
    const aspect = Math.max(0.8, root.clientWidth / Math.max(1, root.clientHeight));
    const cameraHeight = 17.8;
    const camera = new THREE.OrthographicCamera(
      -(cameraHeight * aspect) / 2,
      (cameraHeight * aspect) / 2,
      cameraHeight / 2,
      -cameraHeight / 2,
      0.1,
      100,
    );
    camera.zoom = 1.15;
    camera.updateProjectionMatrix();
    const cameraHome = new THREE.Vector3(22, 25, 22);
    const cameraIntro = new THREE.Vector3(27, 24, 15);
    camera.position.copy(cameraIntro);
    camera.lookAt(0, 0.4, 0);
    const city = new THREE.Group();
    scene.add(city);
    // Warm key light from the upper left over a sky/ground hemisphere: no blue cast (§10.3).
    const hemisphereLight = new THREE.HemisphereLight(colorFromToken(root, "--dispatch-sky-light"), palette.ground, 1.15);
    scene.add(hemisphereLight);
    const keyLight = new THREE.DirectionalLight(colorFromToken(root, "--dispatch-key-light"), 1.05);
    keyLight.position.set(-7, 14, 9);
    scene.add(keyLight);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 20),
      new THREE.MeshBasicMaterial({ color: palette.ground, alphaMap: groundFade, transparent: true, depthWrite: false }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.09;
    city.add(ground);

    const streetMesh = new THREE.Mesh(
      ribbonGeometry(coordinates.streets, 0.52, -0.035),
      makeRibbonMaterial(palette.street, 1),
    );
    city.add(streetMesh);
    const streetPoints = coordinates.streets.flat();
    const lamps = makeGlowPoints(streetPoints.filter((_, index) => index % 2 === 0), palette.sodium, 9, 0.05, 0.55, glow);
    city.add(lamps);
    const buildingMesh = makeBuildingInstances(scene, coordinates, palette);
    city.remove(buildingMesh);
    city.add(buildingMesh);
    const windowMesh = makeWindowInstances(coordinates, palette);
    city.add(windowMesh);
    const routes = Object.values(coordinates.routes);
    // Each route = a wide additive halo under a crisp core: a cheap glow without post-processing.
    const haloMeshes = routes.map((route) => {
      const mesh = new THREE.Mesh(ribbonGeometry([route], 0.85, 0.03), makeRibbonMaterial(palette.route, 0.18, true));
      mesh.renderOrder = 2;
      city.add(mesh);
      return mesh;
    });
    const routeMeshes = routes.map((route) => {
      const mesh = new THREE.Mesh(
        ribbonGeometry([route], 0.2, 0.04),
        makeRibbonMaterial(palette.route, 0.95),
      );
      mesh.renderOrder = 3;
      city.add(mesh);
      return mesh;
    });
    const vehicles = addVehicles(scene, palette, coordinates.vehicles.length);
    city.remove(vehicles);
    city.add(vehicles);
    const headlights = makeGlowPoints(coordinates.vehicles.map(() => ({ x: 0, z: 0 })), new THREE.Color("#fff3d6"), 22, 0.22, 0.85, glow);
    headlights.renderOrder = 4;
    city.add(headlights);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(root.clientWidth, root.clientHeight, false);

    let glowScale = 1;
    let visible = false;
    let destroyed = false;
    let ready = false;
    let animationFrame = 0;
    let animationRequested = false;
    let animationStart = 0;
    let animationElapsed = 0;
    let lastPreviewRun = -1;
    let selectedId = propsRef.current.selectedTripId;
    let phase = propsRef.current.previewPhase;
    let pointerStart: { x: number; y: number; rotationX: number; rotationY: number } | null = null;

    const render = () => {
      if (destroyed || !visible || document.visibilityState === "hidden") return;
      renderer.render(scene, camera);
      canvas.dataset.webglReady = "true";
      window.__VELO_DISPATCH_DEBUG__ ??= { frames: 0 };
      window.__VELO_DISPATCH_DEBUG__.frames += 1;
      if (!ready) {
        ready = true;
        propsRef.current.onReady();
      }
    };

    const updateVehicleMatrices = (travelProgress = 0) => {
      const transform = new THREE.Object3D();
      coordinates.vehicles.forEach((vehicle, index) => {
        const route = coordinates.routes[vehicle.tripId];
        const routeIndex = getRouteIndex(vehicle.tripId);
        const isMovingVehicle = vehicle.tripId === selectedId && index === routeIndex * 2;
        const progress = isMovingVehicle && phase === "travel"
          ? 0.08 + travelProgress * 0.84
          : VEHICLE_STARTS[index] ?? vehicle.routeProgress;
        const point = pointAlongRoute(route, progress);
        const tangent = pointAlongRoute(route, Math.min(1, progress + 0.015));
        transform.position.set(point.x, 0.17, point.z);
        transform.rotation.set(0, Math.atan2(tangent.x - point.x, tangent.z - point.z), 0);
        transform.scale.set(1, 1, 1);
        transform.updateMatrix();
        vehicles.setMatrixAt(index, transform.matrix);
        const headlightPositions = headlights.geometry.getAttribute("position") as THREE.BufferAttribute;
        const ahead = pointAlongRoute(route, Math.min(1, progress + 0.03));
        headlightPositions.setXYZ(index, ahead.x, 0.22, ahead.z);
      });
      vehicles.instanceMatrix.needsUpdate = true;
      headlights.geometry.getAttribute("position").needsUpdate = true;
    };

    const updateSelectedVehicleColor = () => {
      const tint = new THREE.Color();
      coordinates.vehicles.forEach((vehicle, index) => {
        const selected = vehicle.tripId === selectedId;
        const isFirst = index === getRouteIndex(vehicle.tripId) * 2;
        tint.copy(selected && isFirst && phase === "assign" ? palette.sodium : selected ? palette.routeAlt : palette.vehicle);
        vehicles.setColorAt(index, tint);
      });
      if (vehicles.instanceColor) vehicles.instanceColor.needsUpdate = true;
    };

    const updateRouteAppearance = () => {
      routeMeshes.forEach((mesh, index) => {
        const material = mesh.material as THREE.MeshBasicMaterial;
        const halo = haloMeshes[index]?.material as THREE.MeshBasicMaterial | undefined;
        const selected = index === getRouteIndex(selectedId);
        const color = phase === "route" && selected ? palette.sodium : selected ? palette.route : palette.routeAlt;
        material.color.copy(color);
        material.opacity = selected
          ? phase === "assign" ? 0.45 : 1
          : 0.55;
        if (halo) {
          halo.color.copy(color);
          // A single thin halo under the core: cartographic, not neon.
          halo.opacity = (selected ? (phase === "route" ? 0.34 : 0.26) : 0.1) * glowScale;
        }
      });
    };

    const scheduleRender = () => {
      if (visible && document.visibilityState !== "hidden") render();
    };

    // One short establishing move (≤ 3.2 s), then the scene settles and renders only on demand.
    let introStart = 0;
    let introFrame = 0;
    let introDone = false;
    const introStep = (now: number) => {
      if (destroyed || introDone) return;
      if (!visible || document.visibilityState === "hidden") { introFrame = 0; return; }
      if (!introStart) introStart = now;
      const t = Math.min(1, (now - introStart) / INTRO_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(cameraIntro, cameraHome, eased);
      camera.lookAt(0, 0.4, 0);
      render();
      if (t < 1) introFrame = window.requestAnimationFrame(introStep);
      else { introDone = true; introFrame = 0; }
    };
    const startIntro = () => {
      if (!introDone && !introFrame && visible) introFrame = window.requestAnimationFrame(introStep);
    };

    const stopAnimation = (preserveElapsed: boolean) => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      if (preserveElapsed && animationStart) animationElapsed += performance.now() - animationStart;
      animationStart = 0;
    };

    const animate = (now: number) => {
      if (!animationRequested || !visible || document.visibilityState === "hidden" || destroyed) {
        animationFrame = 0;
        return;
      }
      if (!animationStart) animationStart = now;
      const elapsed = animationElapsed + now - animationStart;
      const progress = Math.min(1, elapsed / TRAVEL_DURATION_MS);
      updateVehicleMatrices(progress);
      updateRouteAppearance();
      render();
      if (progress >= 1) {
        animationRequested = false;
        animationElapsed = 0;
        animationStart = 0;
        animationFrame = 0;
        return;
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      if (animationRequested && visible && !animationFrame) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    };

    const updateState = (nextId: SampleTrip["id"], nextPhase: PreviewPhase, runId: number) => {
      const previousPhase = phase;
      const previousSelection = selectedId;
      if (runId !== lastPreviewRun) {
        lastPreviewRun = runId;
        animationElapsed = 0;
        animationStart = 0;
        animationRequested = false;
        stopAnimation(false);
      }
      const phaseChanged = previousPhase !== nextPhase;
      const selectionChanged = previousSelection !== nextId;
      selectedId = nextId;
      phase = nextPhase;

      if (phase === "travel" && phaseChanged) {
        if (previousPhase !== "paused" || selectionChanged) {
          animationElapsed = 0;
          animationStart = 0;
        }
        animationRequested = true;
      } else if (phase === "paused") {
        animationRequested = false;
        stopAnimation(true);
      } else if (phase !== "travel") {
        animationRequested = false;
        stopAnimation(false);
        if (phase === "idle" || phase === "complete" || selectionChanged) animationElapsed = 0;
      }

      updateRouteAppearance();
      updateSelectedVehicleColor();
      updateVehicleMatrices(phase === "travel" ? animationElapsed / TRAVEL_DURATION_MS : 0);
      scheduleRender();
      startAnimation();
    };

    const resize = () => {
      if (destroyed) return;
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (!width || !height) return;
      const nextAspect = width / height;
      const nextHeight = 17.8;
      camera.left = -(nextHeight * nextAspect) / 2;
      camera.right = (nextHeight * nextAspect) / 2;
      camera.top = nextHeight / 2;
      camera.bottom = -nextHeight / 2;
      camera.zoom = 1.15;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      scheduleRender();
    };

    const applyLighting = () => {
      const glowStrength = Number.parseFloat(readToken(root, "--dispatch-glow")) || 1;
      const day = glowStrength < 0.6;
      hemisphereLight.color.copy(colorFromToken(root, "--dispatch-sky-light"));
      hemisphereLight.groundColor.copy(palette.ground);
      hemisphereLight.intensity = day ? 1.32 : 1.4;
      keyLight.color.copy(colorFromToken(root, "--dispatch-key-light"));
      keyLight.intensity = day ? 1.05 : 1.25;
      (lamps.material as THREE.PointsMaterial).opacity = day ? 0 : 0.62;
      (headlights.material as THREE.PointsMaterial).opacity = 0.9 * glowStrength;
      glowScale = glowStrength;
      (windowMesh.material as THREE.MeshBasicMaterial).color.copy(palette.window);
    };

    const resolvePalette = () => {
      const next = readPalette(root);
      (Object.keys(palette) as (keyof Palette)[]).forEach((key) => palette[key].copy(next[key]));
      (ground.material as THREE.MeshBasicMaterial).color.copy(palette.ground);
      (streetMesh.material as THREE.MeshBasicMaterial).color.copy(palette.street);
      const buildingMaterials = buildingMesh.material as THREE.MeshLambertMaterial[];
      buildingMaterials[0]?.color.copy(palette.building);
      buildingMaterials[2]?.color.copy(palette.roof);
      (lamps.material as THREE.PointsMaterial).color.copy(palette.sodium);
      applyLighting();
      updateRouteAppearance();
      updateSelectedVehicleColor();
      scheduleRender();
    };

    const contextLost = (event: Event) => {
      event.preventDefault();
      canvas.dataset.webglReady = "false";
      animationRequested = false;
      stopAnimation(false);
      propsRef.current.onFallback();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopAnimation(true);
      } else {
        scheduleRender();
        startAnimation();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pointerStart = { x: event.clientX, y: event.clientY, rotationX: city.rotation.x, rotationY: city.rotation.y };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerStart) return;
      city.rotation.x = THREE.MathUtils.clamp(pointerStart.rotationX + (event.clientY - pointerStart.y) * 0.004, -TILT_LIMIT, TILT_LIMIT);
      city.rotation.y = THREE.MathUtils.clamp(pointerStart.rotationY + (event.clientX - pointerStart.x) * 0.004, -TILT_LIMIT, TILT_LIMIT);
      scheduleRender();
    };
    const onPointerUp = (event: PointerEvent) => {
      pointerStart = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onResetView = () => {
      city.rotation.set(0, 0, 0);
      introDone = true;
      camera.position.copy(cameraHome);
      camera.lookAt(0, 0.4, 0);
      scheduleRender();
    };

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(root);
    window.addEventListener("resize", resize);
    const tokenObserver = new MutationObserver(resolvePalette);
    tokenObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    const visibilityObserver = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? false;
          if (visible) {
            scheduleRender();
            startIntro();
            startAnimation();
          } else {
            stopAnimation(true);
          }
        }, { threshold: 0.01 });
    visibilityObserver?.observe(root);
    canvas.addEventListener("webglcontextlost", contextLost, false);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerup", onPointerUp, { passive: true });
    canvas.addEventListener("pointercancel", onPointerUp, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    runtimeRef.current = { updateState, resetView: onResetView };
    applyLighting();
    updateState(propsRef.current.selectedTripId, propsRef.current.previewPhase, propsRef.current.previewRunId);

    return () => {
      destroyed = true;
      if (introFrame) window.cancelAnimationFrame(introFrame);
      animationRequested = false;
      stopAnimation(false);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      tokenObserver.disconnect();
      visibilityObserver?.disconnect();
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      runtimeRef.current = null;
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      });
      scene.traverse((object) => {
        if (object instanceof THREE.Points) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
      glow.dispose();
      groundFade.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.updateState(selectedTripId, previewPhase, previewRunId);
  }, [selectedTripId, previewPhase, previewRunId]);

  useEffect(() => {
    runtimeRef.current?.resetView();
  }, [resetVersion]);

  return (
    <div className={styles.canvasLayer} ref={rootRef} aria-hidden="true">
      <canvas className={styles.canvas} ref={canvasRef} data-webgl-ready="false" />
    </div>
  );
}
