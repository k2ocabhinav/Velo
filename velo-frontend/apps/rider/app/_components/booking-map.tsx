"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";
import type { MapPoint } from "../_lib/map/routing";
import { getTileProviderConfig } from "../_lib/map/providers";
import type { SelectionTarget } from "../_lib/booking-map-state";

// Fix Leaflet default icon paths broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PICKUP_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "booking-marker-pickup",
});

const DROPOFF_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "booking-marker-dropoff",
});

type BookingMapProps = {
  pickup: MapPoint | null;
  dropOff: MapPoint | null;
  routePoints: MapPoint[];
  activeTarget: SelectionTarget;
  onPointSelected: (target: SelectionTarget, point: MapPoint) => void;
};

function toLatLng(point: MapPoint): LatLngExpression {
  return [point.lat, point.lng];
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const prevKey = useRef("");

  useEffect(() => {
    const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
    if (key === prevKey.current || points.length === 0) {
      return;
    }
    prevKey.current = key;

    if (points.length === 1) {
      map.setView(toLatLng(points[0]), 14);
      return;
    }

    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [40, 40], maxZoom: 15 },
    );
  }, [map, points]);

  return null;
}

function ClickHandler({
  activeTarget,
  onPointSelected,
}: {
  activeTarget: SelectionTarget;
  onPointSelected: (target: SelectionTarget, point: MapPoint) => void;
}) {
  useMapEvents({
    click(event) {
      onPointSelected(activeTarget, {
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  return null;
}

export function BookingMap({
  pickup,
  dropOff,
  routePoints,
  activeTarget,
  onPointSelected,
}: BookingMapProps) {
  const tileProvider = getTileProviderConfig();

  const allPoints = useMemo(() => {
    const pts: MapPoint[] = [];
    if (pickup) pts.push(pickup);
    if (dropOff) pts.push(dropOff);
    return pts;
  }, [pickup, dropOff]);

  const center = allPoints[0] ?? { lat: 12.9716, lng: 77.5946 };
  const polylinePositions =
    routePoints.length > 1
      ? routePoints.map(toLatLng)
      : pickup && dropOff
        ? [toLatLng(pickup), toLatLng(dropOff)]
        : [];

  function handleDragEnd(target: SelectionTarget, marker: L.Marker) {
    const pos = marker.getLatLng();
    onPointSelected(target, { lat: pos.lat, lng: pos.lng });
  }

  return (
    <div className="booking-map">
      <MapContainer
        center={toLatLng(center)}
        zoom={13}
        scrollWheelZoom
        className="booking-map-inner"
      >
        <TileLayer
          attribution={tileProvider.attribution}
          url={tileProvider.urlTemplate}
          subdomains={tileProvider.subdomains}
          maxZoom={tileProvider.maxZoom}
        />

        <FitBounds points={allPoints.length > 0 ? allPoints : [center]} />
        <ClickHandler activeTarget={activeTarget} onPointSelected={onPointSelected} />

        {pickup ? (
          <Marker
            position={toLatLng(pickup)}
            icon={PICKUP_ICON}
            draggable
            eventHandlers={{
              dragend(event) {
                handleDragEnd("pickup", event.target as L.Marker);
              },
            }}
          >
            <Popup>Pickup</Popup>
          </Marker>
        ) : null}

        {dropOff ? (
          <Marker
            position={toLatLng(dropOff)}
            icon={DROPOFF_ICON}
            draggable
            eventHandlers={{
              dragend(event) {
                handleDragEnd("dropoff", event.target as L.Marker);
              },
            }}
          >
            <Popup>Drop-off</Popup>
          </Marker>
        ) : null}

        {polylinePositions.length > 1 ? (
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.7 }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
