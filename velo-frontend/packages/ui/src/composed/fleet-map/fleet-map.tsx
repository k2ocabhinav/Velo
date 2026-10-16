"use client";

import { memo, useCallback, useEffect, useRef, type MouseEvent, type RefObject } from "react";
import L, { type Marker as LeafletMarker, type Polyline as LeafletPolyline } from "leaflet";
import { MapContainer, TileLayer, useMap, ZoomControl } from "react-leaflet";
import { getFleetDriverVisualState, interpolateFleetPosition, type FleetPosition } from "./animation";
import { DEFAULT_CENTER, fitFleetMap, fleetMapCameraPoints, focusZoom } from "./camera";
import { formatFleetLastUpdate } from "./format";
import { FleetMapStore, type FleetMapState } from "./store";
import styles from "./fleet-map.module.css";
import type { FleetMapDriver, FleetMapFocusRequest, FleetMapPoint, FleetMapRide, FleetMapSelection } from "./types";

const ANIMATION_MS = 3_000;
const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function cssClass(name: string): string {
  return styles[name] ?? name;
}

function toneClass(tone: "available" | "to-pickup" | "on-trip"): string {
  if (tone === "to-pickup") return cssClass("toneToPickup");
  if (tone === "on-trip") return cssClass("toneOnTrip");
  return cssClass("toneAvailable");
}

interface DriverMarkerRecord {
  marker: LeafletMarker;
  target: FleetPosition;
  animationFrom: FleetPosition;
  animationStartedAt: number;
  driver: FleetMapDriver;
}

interface RequestMarkerRecord {
  marker: LeafletMarker;
  ride: FleetMapRide;
}

interface CameraActions {
  recenter: () => void;
}

interface FleetMapProps {
  drivers: FleetMapDriver[];
  rides: FleetMapRide[];
  focusRequest?: FleetMapFocusRequest | null | undefined;
  onSelectionChange?: ((selection: FleetMapSelection) => void) | undefined;
  reducedMotion?: boolean | undefined;
}

function toLatLng(point: FleetMapPoint | FleetPosition): [number, number] {
  return [point.lat, point.lng];
}

function formatStatus(status: FleetMapDriver["status"]): string {
  if (status === "EN_ROUTE_TO_PICKUP") return "To pickup";
  if (status === "ON_TRIP") return "On trip";
  return "Available";
}

function appendLine(parent: HTMLElement, className: string, value: string): void {
  const line = document.createElement("p");
  line.className = className;
  line.textContent = value;
  parent.append(line);
}

function appendText(parent: HTMLElement, tag: "strong" | "span", className: string, value: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function createDriverPopup(driver: FleetMapDriver, trip?: FleetMapRide): HTMLElement {
  const content = document.createElement("div");
  content.className = cssClass("popup");
  const heading = document.createElement("div");
  heading.className = cssClass("popupHeading");
  appendText(heading, "strong", cssClass("popupTitle"), driver.name);
  appendText(heading, "span", cssClass("popupPlate"), driver.vehiclePlate || "Plate unavailable");
  content.append(heading);
  const meta = document.createElement("div");
  meta.className = cssClass("popupMeta");
  const status = appendText(meta, "span", cssClass("popupStatus"), formatStatus(driver.status));
  status.dataset.tone = driver.status === "EN_ROUTE_TO_PICKUP" ? "warning" : driver.status === "ON_TRIP" ? "primary" : "success";
  appendText(meta, "span", cssClass("popupUpdated"), formatFleetLastUpdate(driver.locationUpdatedAt, driver.stale));
  content.append(meta);
  if (trip) {
    appendLine(content, cssClass("popupTrip"), `${trip.riderName} · ${trip.status === "ONGOING" ? "On trip" : "To pickup"}`);
    appendLine(content, cssClass("popupLine"), `${trip.pickup.address ?? "Pickup"} → ${trip.dropOff.address ?? "Drop-off"}`);
  }
  return content;
}

function createRequestPopup(ride: FleetMapRide): HTMLElement {
  const content = document.createElement("div");
  content.className = cssClass("popup");
  const title = document.createElement("strong");
  title.className = cssClass("popupTitle");
  title.textContent = ride.riderName || "Waiting request";
  content.append(title);
  appendLine(content, cssClass("popupLine"), "Waiting for a driver");
  appendLine(content, cssClass("popupLine"), ride.pickup.address ?? "Pickup location");
  return content;
}

function setDriverMarkerAttributes(marker: LeafletMarker, driver: FleetMapDriver): void {
  const element = marker.getElement();
  if (!element) return;
  const visualState = getFleetDriverVisualState(driver.status, driver.stale);
  element.dataset.testid = "fleet-driver-marker";
  element.dataset.driverId = String(driver.driverId);
  const lastUpdate = formatFleetLastUpdate(driver.locationUpdatedAt, driver.stale);
  element.title = `${driver.name} · ${formatStatus(driver.status)} · ${lastUpdate}`;
  element.setAttribute("aria-label", `${driver.name}, ${formatStatus(driver.status)}${driver.stale ? `, ${lastUpdate}` : ""}`);
  const badge = element.querySelector<HTMLElement>(`.${cssClass("driverMarker")}`);
  badge?.classList.remove(cssClass("toneAvailable"), cssClass("toneToPickup"), cssClass("toneOnTrip"), cssClass("stale"));
  badge?.classList.add(toneClass(visualState.tone));
  if (driver.stale) badge?.classList.add(cssClass("stale"));
  badge?.setAttribute("data-status", visualState.status);
  badge?.setAttribute("data-tone", visualState.tone);
  badge?.setAttribute("data-stale", String(driver.stale));
  const chevron = element.querySelector<HTMLElement>(`.${cssClass("chevron")}`);
  if (chevron) chevron.style.transform = `rotate(${driver.heading ?? 0}deg)`;
}

function createDriverIcon(driver: FleetMapDriver): L.DivIcon {
  const heading = Number.isFinite(driver.heading) ? driver.heading ?? 0 : 0;
  const visualState = getFleetDriverVisualState(driver.status, driver.stale);
  return L.divIcon({
    className: styles.markerRoot,
    html: `<span class="${cssClass("driverMarker")} ${toneClass(visualState.tone)}${driver.stale ? ` ${cssClass("stale")}` : ""}" data-status="${driver.status}" data-stale="${driver.stale}"><span class="${cssClass("chevron")}" style="transform:rotate(${heading}deg)">▲</span></span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function createRequestIcon(): L.DivIcon {
  return L.divIcon({
    className: styles.markerRoot,
    html: `<span class="${cssClass("requestMarker")}" aria-hidden="true"><span class="${cssClass("requestDot")}"></span></span>`,
    iconSize: [28, 34],
    iconAnchor: [14, 30],
  });
}

function cameraPoints(state: FleetMapState): [number, number][] {
  return fleetMapCameraPoints({
    drivers: state.drivers,
    rides: state.rides,
    selection: state.focusRequest?.selection ?? null,
  });
}

function MapCamera({ store, actions }: { store: FleetMapStore; actions: RefObject<CameraActions | null> }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    actions.current = {
      recenter: () => {
        fitFleetMap(map, cameraPoints(store.getState()));
      },
    };
    const fitInitial = () => {
      if (hasFitted.current) return;
      const points = cameraPoints(store.getState());
      if (!points.length) return;
      hasFitted.current = true;
      fitFleetMap(map, points);
    };
    fitInitial();
    const unsubscribe = store.subscribe((change) => {
      if (change === "data") fitInitial();
    });
    return () => {
      unsubscribe();
      actions.current = null;
    };
  }, [actions, map, store]);

  return null;
}

function ImperativeMarkers({ store, reducedMotion }: { store: FleetMapStore; reducedMotion: boolean }) {
  const map = useMap();
  const driverMarkers = useRef(new Map<number, DriverMarkerRecord>());
  const requestMarkers = useRef(new Map<number, RequestMarkerRecord>());

  useEffect(() => {
    let frame: number | null = null;
    let focusedSequence: number | null = null;

    const cancelAnimation = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };

    const focusSelection = (state: FleetMapState) => {
      const request = state.focusRequest;
      if (!request || request.sequence === focusedSequence) return;
      focusedSequence = request.sequence;
      const selection = request.selection;
      const record = selection.type === "driver"
        ? driverMarkers.current.get(selection.id)
        : (() => {
            const ride = state.rides.find((item) => item.rideRequestId === selection.id);
            return ride?.driverId ? driverMarkers.current.get(ride.driverId) : requestMarkers.current.get(selection.id);
          })();
      if (!record) return;
      map.flyTo(record.marker.getLatLng(), focusZoom(map.getZoom()), reducedMotion
        ? { animate: false }
        : { duration: 0.55 });
      if (reducedMotion) {
        record.marker.openPopup();
      } else {
        map.once("moveend", () => {
          if (map.hasLayer(record.marker)) record.marker.openPopup();
        });
      }
    };

    const updateData = () => {
      const { drivers, rides } = store.getState();
      const incomingIds = new Set(drivers.map((driver) => driver.driverId));
      for (const [id, record] of driverMarkers.current) {
        if (incomingIds.has(id)) continue;
        record.marker.remove();
        driverMarkers.current.delete(id);
      }

      const tripsByRide = new Map(rides.filter((ride) => ride.rideId !== null).map((ride) => [ride.rideId!, ride]));
      for (const driver of drivers) {
        const target = { lat: driver.lat, lng: driver.lng, heading: driver.heading ?? null };
        let record = driverMarkers.current.get(driver.driverId);
        if (!record) {
          const marker = L.marker(toLatLng(target), { icon: createDriverIcon(driver), title: driver.name, keyboard: true }).addTo(map);
          marker.bindPopup(createDriverPopup(driver, driver.rideId ? tripsByRide.get(driver.rideId) : undefined), { closeButton: false, maxWidth: 240 });
          marker.on("click", () => store.select({ type: "driver", id: driver.driverId }));
          record = { marker, target, animationFrom: target, animationStartedAt: performance.now(), driver };
          driverMarkers.current.set(driver.driverId, record);
        } else {
          const current = record.marker.getLatLng();
          record.animationFrom = { lat: current.lat, lng: current.lng, heading: record.driver.heading ?? null };
          record.target = target;
          record.animationStartedAt = performance.now();
          record.driver = driver;
          record.marker.setPopupContent(createDriverPopup(driver, driver.rideId ? tripsByRide.get(driver.rideId) : undefined));
        }
        setDriverMarkerAttributes(record.marker, driver);
      }

      const pendingRides = rides.filter((ride) => ride.status === "REQUESTED");
      const incomingRequests = new Set(pendingRides.map((ride) => ride.rideRequestId));
      for (const [id, record] of requestMarkers.current) {
        if (incomingRequests.has(id)) continue;
        record.marker.remove();
        requestMarkers.current.delete(id);
      }
      for (const ride of pendingRides) {
        const existing = requestMarkers.current.get(ride.rideRequestId);
        if (existing) {
          existing.marker.setLatLng(toLatLng(ride.pickup));
          existing.marker.setPopupContent(createRequestPopup(ride));
          existing.ride = ride;
          continue;
        }
        const marker = L.marker(toLatLng(ride.pickup), { icon: createRequestIcon(), title: `Waiting request · ${ride.riderName}`, keyboard: true }).addTo(map);
        marker.getElement()?.setAttribute("data-testid", "fleet-request-marker");
        marker.getElement()?.setAttribute("data-request-id", String(ride.rideRequestId));
        marker.getElement()?.setAttribute("aria-label", `Waiting request · ${ride.riderName}`);
        marker.bindPopup(createRequestPopup(ride), { closeButton: false, maxWidth: 240 });
        marker.on("click", () => store.select({ type: "ride", id: ride.rideRequestId }));
        requestMarkers.current.set(ride.rideRequestId, { marker, ride });
      }

      cancelAnimation();
      const shouldTween = !reducedMotion && [...driverMarkers.current.values()].some((record) => {
        const from = record.animationFrom;
        const to = record.target;
        return Math.abs(from.lat - to.lat) > 0.000001
          || Math.abs(from.lng - to.lng) > 0.000001
          || Math.abs(((from.heading ?? 0) - (to.heading ?? from.heading ?? 0) + 540) % 360 - 180) > 0.1;
      });
      if (!shouldTween) {
        for (const record of driverMarkers.current.values()) {
          record.marker.setLatLng(toLatLng(record.target));
          setDriverMarkerAttributes(record.marker, record.driver);
        }
      } else {
        const animate = (now: number) => {
          let remaining = false;
          for (const record of driverMarkers.current.values()) {
            const progress = (now - record.animationStartedAt) / ANIMATION_MS;
            const position = interpolateFleetPosition(record.animationFrom, record.target, progress);
            record.marker.setLatLng(toLatLng(position));
            const element = record.marker.getElement();
            const chevron = element?.querySelector<HTMLElement>(`.${cssClass("chevron")}`);
            if (chevron) chevron.style.transform = `rotate(${position.heading ?? 0}deg)`;
            if (progress < 1) remaining = true;
          }
          frame = remaining ? requestAnimationFrame(animate) : null;
        };
        frame = requestAnimationFrame(animate);
      }
      focusSelection(store.getState());
    };

    const onChange = (change: "data" | "focus") => {
      if (change === "data") updateData();
      else focusSelection(store.getState());
    };
    const unsubscribe = store.subscribe(onChange);
    updateData();
    return () => {
      unsubscribe();
      cancelAnimation();
      for (const { marker } of driverMarkers.current.values()) marker.remove();
      for (const { marker } of requestMarkers.current.values()) marker.remove();
      driverMarkers.current.clear();
      requestMarkers.current.clear();
    };
  }, [map, reducedMotion, store]);

  return null;
}

function SelectedTripRoute({ store }: { store: FleetMapStore }) {
  const map = useMap();
  const route = useRef<LeafletPolyline | null>(null);
  const approach = useRef<LeafletPolyline | null>(null);

  useEffect(() => {
    const clear = () => {
      route.current?.remove();
      approach.current?.remove();
      route.current = null;
      approach.current = null;
    };
    const updateRoute = () => {
      clear();
      const state = store.getState();
      const selection = state.focusRequest?.selection;
      if (selection?.type !== "ride") return;
      const ride = state.rides.find((item) => item.rideRequestId === selection.id);
      if (!ride) return;
      route.current = L.polyline([toLatLng(ride.pickup), toLatLng(ride.dropOff)], {
        color: "hsl(var(--color-primary))",
        weight: 4,
        opacity: 0.85,
        dashArray: ride.status === "ONGOING" ? undefined : "8 8",
        lineCap: "round",
      }).addTo(map);
      if (ride.status === "CONFIRMED" && ride.driverId) {
        const driver = state.drivers.find((candidate) => candidate.driverId === ride.driverId);
        if (driver) {
          approach.current = L.polyline([toLatLng(driver), toLatLng(ride.pickup)], {
            color: "hsl(var(--color-warning))",
            weight: 3,
            opacity: 0.78,
            dashArray: "4 7",
            lineCap: "round",
          }).addTo(map);
        }
      }
    };
    updateRoute();
    const unsubscribe = store.subscribe(updateRoute);
    return () => {
      unsubscribe();
      clear();
    };
  }, [map, store]);

  return null;
}

function RecenterButton({ actions }: { actions: RefObject<CameraActions | null> }) {
  const recenter = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    actions.current?.recenter();
  }, [actions]);
  return <button className={styles.recenter} type="button" onClick={recenter} aria-label="Recenter fleet map">Recenter</button>;
}

function FleetMapCanvas({ store, reducedMotion }: { store: FleetMapStore; reducedMotion: boolean }) {
  const actions = useRef<CameraActions | null>(null);
  return (
    <div className={styles.mapFrame}>
      <MapContainer center={DEFAULT_CENTER} zoom={12} scrollWheelZoom zoomControl={false} className={cssClass("map")} aria-label="Live fleet map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url={OSM_TILES} maxZoom={19} />
        <ZoomControl position="bottomleft" />
        <MapCamera store={store} actions={actions} />
        <ImperativeMarkers store={store} reducedMotion={reducedMotion} />
        <SelectedTripRoute store={store} />
      </MapContainer>
      <RecenterButton actions={actions} />
    </div>
  );
}

const StableMapCanvas = memo(FleetMapCanvas);

export function FleetMap({ drivers, rides, focusRequest, onSelectionChange, reducedMotion }: FleetMapProps) {
  const storeRef = useRef<FleetMapStore | null>(null);
  if (!storeRef.current) storeRef.current = new FleetMapStore({ drivers, rides, focusRequest: focusRequest ?? null });
  const store = storeRef.current;
  const reduced = reducedMotion ?? (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const empty = drivers.length === 0;

  useEffect(() => store.setData(drivers, rides), [drivers, rides, store]);
  useEffect(() => store.setFocusRequest(focusRequest ?? null), [focusRequest, store]);
  useEffect(() => store.setSelectionChange(onSelectionChange), [onSelectionChange, store]);

  return (
    <section className={styles.mapShell} aria-label="Live fleet map">
      <StableMapCanvas store={store} reducedMotion={reduced} />
      {empty ? <div className={styles.emptyOverlay} role="status">No drivers online right now.</div> : null}
    </section>
  );
}
