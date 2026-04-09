"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { getTileProviderConfig } from "../../../_lib/map/providers";
import type { MapPoint } from "../../../_lib/map/routing";

type DriverRideMapProps = {
  pickup: MapPoint | null;
  dropOff: MapPoint | null;
  driver: MapPoint | null;
  routePoints: MapPoint[];
};

function toLatLng(point: MapPoint): LatLngExpression {
  return [point.lat, point.lng];
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(toLatLng(points[0]), 14);
      return;
    }

    map.fitBounds(points.map((point) => [point.lat, point.lng] as [number, number]), {
      padding: [24, 24],
      maxZoom: 15,
    });
  }, [map, points]);

  return null;
}

export function DriverRideMap({ pickup, dropOff, driver, routePoints }: DriverRideMapProps) {
  const tileProvider = getTileProviderConfig();

  const allPoints = useMemo(() => {
    const points: MapPoint[] = [];
    if (pickup) points.push(pickup);
    if (dropOff) points.push(dropOff);
    if (driver) points.push(driver);
    return points;
  }, [driver, dropOff, pickup]);

  const center = allPoints[0] ?? { lat: 12.9716, lng: 77.5946 };
  const polylinePoints = routePoints.length > 1 ? routePoints : pickup && dropOff ? [pickup, dropOff] : [];

  return (
    <div className="driver-ride-map">
      <MapContainer center={toLatLng(center)} zoom={13} scrollWheelZoom className="driver-ride-map-inner">
        <TileLayer
          attribution={tileProvider.attribution}
          url={tileProvider.urlTemplate}
          subdomains={tileProvider.subdomains}
          maxZoom={tileProvider.maxZoom}
        />

        <FitBounds points={allPoints.length > 0 ? allPoints : [center]} />

        {pickup ? (
          <CircleMarker center={toLatLng(pickup)} pathOptions={{ color: "#1d4ed8", fillColor: "#1d4ed8" }} radius={8}>
            <Popup>Pickup</Popup>
          </CircleMarker>
        ) : null}

        {dropOff ? (
          <CircleMarker center={toLatLng(dropOff)} pathOptions={{ color: "#059669", fillColor: "#059669" }} radius={8}>
            <Popup>Drop-off</Popup>
          </CircleMarker>
        ) : null}

        {driver ? (
          <CircleMarker center={toLatLng(driver)} pathOptions={{ color: "#b45309", fillColor: "#f59e0b" }} radius={7}>
            <Popup>Driver</Popup>
          </CircleMarker>
        ) : null}

        {polylinePoints.length > 1 ? (
          <Polyline positions={polylinePoints.map(toLatLng)} pathOptions={{ color: "#2563eb", weight: 4 }} />
        ) : null}
      </MapContainer>
    </div>
  );
}
