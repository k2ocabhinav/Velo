"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { isLeafletMapReady } from "@velo/app-core/map-viewport";

export type LocationPoint = { lat: number; lng: number };
export type LocationTarget = "pickup" | "dropoff";

const PICKUP_ICON = L.divIcon({ className: "geo-map-marker geo-map-marker--pickup", html: "<span></span>", iconSize: [24, 32], iconAnchor: [12, 32] });
const DROPOFF_ICON = L.divIcon({ className: "geo-map-marker geo-map-marker--dropoff", html: "<span></span>", iconSize: [24, 32], iconAnchor: [12, 32] });
const DEFAULT_CENTER: LocationPoint = { lat: 12.9716, lng: 77.5946 };

function toLatLng(point: LocationPoint): [number, number] {
  return [point.lat, point.lng];
}

function FitLocations({ points }: { points: LocationPoint[] }) {
  const map = useMap();
  const currentKey = useRef("");
  useEffect(() => {
    const nextKey = points.map((point) => `${point.lat}:${point.lng}`).join("|");
    if (!points.length || nextKey === currentKey.current || !isLeafletMapReady(map)) return;
    currentKey.current = nextKey;
    if (points.length === 1) {
      const onlyPoint = points[0];
      if (onlyPoint) map.setView(toLatLng(onlyPoint), 14, { animate: false });
    } else {
      map.fitBounds(points.map(toLatLng), { padding: [24, 24], maxZoom: 15, animate: false });
    }
  }, [map, points]);
  return null;
}

function MapClickHandler({ target, onPointSelected }: {
  target: LocationTarget;
  onPointSelected: (target: LocationTarget, point: LocationPoint) => void;
}) {
  useMapEvents({
    click(event) {
      onPointSelected(target, { lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

export function LeafletLocationPicker({
  activeTarget,
  onActiveTargetChange,
  onPointSelected,
  pickup,
  dropoff,
}: {
  pickup: LocationPoint | null;
  dropoff: LocationPoint | null;
  activeTarget: LocationTarget;
  onActiveTargetChange: (target: LocationTarget) => void;
  onPointSelected: (target: LocationTarget, point: LocationPoint) => void;
}) {
  const points = useMemo(() => [pickup, dropoff].filter((point): point is LocationPoint => point !== null), [dropoff, pickup]);
  const center = points[0] ?? DEFAULT_CENTER;
  return (
    <section className="geo-location-picker" aria-label="Choose trip locations on the map">
      <div className="geo-location-picker-actions" role="group" aria-label="Location to set">
        <button type="button" aria-pressed={activeTarget === "pickup"} onClick={() => onActiveTargetChange("pickup")}>Set pickup</button>
        <button type="button" aria-pressed={activeTarget === "dropoff"} onClick={() => onActiveTargetChange("dropoff")}>Set drop-off</button>
      </div>
      <div className="geo-map-picker" role="group" aria-label={`Map picker. Click to set ${activeTarget === "pickup" ? "pickup" : "drop-off"}.`}>
        <MapContainer center={toLatLng(center)} zoom={12} scrollWheelZoom={false} className="geo-map-picker-canvas">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <FitLocations points={points} />
          <MapClickHandler target={activeTarget} onPointSelected={onPointSelected} />
          {pickup ? <Marker position={toLatLng(pickup)} icon={PICKUP_ICON} /> : null}
          {dropoff ? <Marker position={toLatLng(dropoff)} icon={DROPOFF_ICON} /> : null}
          {pickup && dropoff ? <Polyline positions={[toLatLng(pickup), toLatLng(dropoff)]} pathOptions={{ color: "hsl(var(--color-primary))", weight: 3, opacity: 0.7 }} /> : null}
        </MapContainer>
      </div>
      <p className="address-search-status" aria-live="polite">Click the map to set {activeTarget === "pickup" ? "pickup" : "drop-off"}.</p>
    </section>
  );
}
