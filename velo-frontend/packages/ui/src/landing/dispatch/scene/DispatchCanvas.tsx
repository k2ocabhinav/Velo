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
  asphalt: THREE.Color;
  dawn: THREE.Color;
  signal: THREE.Color;
  teal: THREE.Color;
  sodium: THREE.Color;
  concrete: THREE.Color;
};

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
    asphalt: colorFromToken(element, "--dispatch-asphalt"),
    dawn: colorFromToken(element, "--dispatch-dawn"),
    signal: colorFromToken(element, "--dispatch-signal"),
    teal: colorFromToken(element, "--dispatch-teal"),
    sodium: colorFromToken(element, "--dispatch-sodium"),
    concrete: colorFromToken(element, "--dispatch-concrete"),
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
  geometry.computeVertexNormals();
  return geometry;
}

function makeBuildingInstances(
  scene: THREE.Scene,
  coordinates: DispatchCoordinates,
  palette: Palette,
): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const sides = new THREE.MeshStandardMaterial({ color: palette.concrete, roughness: 1, metalness: 0 });
  const roof = new THREE.MeshStandardMaterial({ color: palette.asphalt, roughness: 1, metalness: 0 });
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

function addVehicles(scene: THREE.Scene, palette: Palette, count: number): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(0.54, 0.2, 0.3);
  const material = new THREE.MeshStandardMaterial({ color: "white", roughness: 0.78, metalness: 0.04 });
  const vehicles = new THREE.InstancedMesh(geometry, material, count);
  const color = new THREE.Color();
  for (let index = 0; index < count; index += 1) {
    color.copy(index % 2 === 0 ? palette.teal : palette.asphalt);
    vehicles.setColorAt(index, color);
  }
  vehicles.instanceColor!.needsUpdate = true;
  scene.add(vehicles);
  return vehicles;
}

function makeRibbonMaterial(color: THREE.Color, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
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
        alpha: false,
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
    scene.background = palette.dawn;
    const aspect = Math.max(0.8, root.clientWidth / Math.max(1, root.clientHeight));
    const cameraHeight = 19.5;
    const camera = new THREE.OrthographicCamera(
      -(cameraHeight * aspect) / 2,
      (cameraHeight * aspect) / 2,
      cameraHeight / 2,
      -cameraHeight / 2,
      0.1,
      100,
    );
    camera.position.set(22, 25, 22);
    camera.lookAt(0, 0.4, 0);
    const city = new THREE.Group();
    scene.add(city);
    scene.add(new THREE.HemisphereLight(palette.dawn, palette.concrete, 2.1));
    const keyLight = new THREE.DirectionalLight(palette.dawn, 1.65);
    keyLight.position.set(-7, 14, 9);
    scene.add(keyLight);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 16),
      new THREE.MeshBasicMaterial({ color: palette.dawn }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.09;
    city.add(ground);

    const streetMesh = new THREE.Mesh(
      ribbonGeometry(coordinates.streets, 0.52, -0.035),
      makeRibbonMaterial(palette.concrete, 0.85),
    );
    city.add(streetMesh);
    const buildingMesh = makeBuildingInstances(scene, coordinates, palette);
    city.remove(buildingMesh);
    city.add(buildingMesh);
    const routeMeshes = Object.values(coordinates.routes).map((route) => {
      const mesh = new THREE.Mesh(
        ribbonGeometry([route], 0.15, 0.035),
        makeRibbonMaterial(palette.signal, 0.9),
      );
      mesh.renderOrder = 2;
      city.add(mesh);
      return mesh;
    });
    const vehicles = addVehicles(scene, palette, coordinates.vehicles.length);
    city.remove(vehicles);
    city.add(vehicles);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(root.clientWidth, root.clientHeight, false);

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
      });
      vehicles.instanceMatrix.needsUpdate = true;
    };

    const updateSelectedVehicleColor = () => {
      const tint = new THREE.Color();
      coordinates.vehicles.forEach((vehicle, index) => {
        const selected = vehicle.tripId === selectedId;
        const isFirst = index === getRouteIndex(vehicle.tripId) * 2;
        tint.copy(selected && isFirst && phase === "assign" ? palette.sodium : selected ? palette.teal : palette.asphalt);
        vehicles.setColorAt(index, tint);
      });
      if (vehicles.instanceColor) vehicles.instanceColor.needsUpdate = true;
    };

    const updateRouteAppearance = () => {
      routeMeshes.forEach((mesh, index) => {
        const material = mesh.material as THREE.MeshBasicMaterial;
        const selected = index === getRouteIndex(selectedId);
        material.color.copy(phase === "route" && selected ? palette.sodium : palette.signal);
        material.opacity = selected
          ? phase === "assign" ? 0.34 : phase === "route" ? 1 : 0.92
          : 0.16;
        material.needsUpdate = true;
      });
    };

    const scheduleRender = () => {
      if (visible && document.visibilityState !== "hidden") render();
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
      const nextHeight = 19.5;
      camera.left = -(nextHeight * nextAspect) / 2;
      camera.right = (nextHeight * nextAspect) / 2;
      camera.top = nextHeight / 2;
      camera.bottom = -nextHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      scheduleRender();
    };

    const resolvePalette = () => {
      const nextPalette = readPalette(root);
      palette.asphalt.copy(nextPalette.asphalt);
      palette.dawn.copy(nextPalette.dawn);
      palette.signal.copy(nextPalette.signal);
      palette.teal.copy(nextPalette.teal);
      palette.sodium.copy(nextPalette.sodium);
      palette.concrete.copy(nextPalette.concrete);
      scene.background = palette.dawn;
      const hemisphere = scene.children.find((child) => child instanceof THREE.HemisphereLight) as THREE.HemisphereLight | undefined;
      const directional = scene.children.find((child) => child instanceof THREE.DirectionalLight) as THREE.DirectionalLight | undefined;
      hemisphere?.color.copy(palette.dawn);
      hemisphere?.groundColor.copy(palette.concrete);
      directional?.color.copy(palette.dawn);
      const streetMaterial = streetMesh.material as THREE.MeshBasicMaterial;
      streetMaterial.color.copy(palette.concrete);
      const buildingMaterials = buildingMesh.material as THREE.Material[];
      (buildingMaterials[0] as THREE.MeshStandardMaterial).color.copy(palette.concrete);
      (buildingMaterials[2] as THREE.MeshStandardMaterial).color.copy(palette.asphalt);
      const groundMaterial = ground.material as THREE.MeshBasicMaterial;
      groundMaterial.color.copy(palette.dawn);
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
    updateState(propsRef.current.selectedTripId, propsRef.current.previewPhase, propsRef.current.previewRunId);

    return () => {
      destroyed = true;
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
