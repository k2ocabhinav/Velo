"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { shouldFitMapBounds, shouldFollowDriverLocation } from "@velo/app-core/map-viewport";
import type { MapPoint } from "../../../_lib/map/routing";
import { getTileProviderConfig } from "../../../_lib/map/providers";

type ActiveRideMapProps = {
  pickup: MapPoint | null;
  dropOff: MapPoint | null;
  driver: MapPoint | null;
  routePoints: MapPoint[];
};

function toLatLng(point: MapPoint): LatLngExpression {
  return [point.lat, point.lng];
}

function FitBoundsOnce({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (!shouldFitMapBounds(hasFitted.current, points.length)) {
      return;
    }
    hasFitted.current = true;

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

function FollowDriver({ follow, driver }: { follow: boolean; driver: MapPoint | null }) {
  const map = useMap();

  useEffect(() => {
    if (!shouldFollowDriverLocation(follow, driver !== null) || !driver) {
      return;
    }
    map.panTo(toLatLng(driver));
  }, [driver, follow, map]);

  return null;
}

export function ActiveRideMap({ pickup, dropOff, driver, routePoints }: ActiveRideMapProps) {
  const tileProvider = getTileProviderConfig();
  const [followDriver, setFollowDriver] = useState(false);

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
    <div className="active-ride-map">
      <button
        className="secondary-button"
        type="button"
        aria-pressed={followDriver}
        disabled={!driver}
        onClick={() => setFollowDriver((following) => !following)}
      >
        {followDriver ? "Stop following" : "Follow driver"}
      </button>
      <MapContainer center={toLatLng(center)} zoom={13} scrollWheelZoom className="active-ride-map-inner">
        <TileLayer
          attribution={tileProvider.attribution}
          url={tileProvider.urlTemplate}
          subdomains={tileProvider.subdomains}
          maxZoom={tileProvider.maxZoom}
        />

        <FitBoundsOnce points={allPoints} />
        <FollowDriver follow={followDriver} driver={driver} />

        {pickup ? (
          <CircleMarker center={toLatLng(pickup)} pathOptions={{ color: "hsl(var(--color-primary))", fillColor: "hsl(var(--color-primary))" }} radius={8}>
            <Popup>Pickup</Popup>
          </CircleMarker>
        ) : null}

        {dropOff ? (
          <CircleMarker center={toLatLng(dropOff)} pathOptions={{ color: "hsl(var(--color-success))", fillColor: "hsl(var(--color-success))" }} radius={8}>
            <Popup>Drop-off</Popup>
          </CircleMarker>
        ) : null}

        {driver ? (
          <CircleMarker center={toLatLng(driver)} pathOptions={{ color: "hsl(var(--color-warning))", fillColor: "hsl(var(--color-warning))" }} radius={7}>
            <Popup>Driver</Popup>
          </CircleMarker>
        ) : null}

        {polylinePoints.length > 1 ? (
          <Polyline positions={polylinePoints.map(toLatLng)} pathOptions={{ color: "hsl(var(--color-info))", weight: 4 }} />
        ) : null}
      </MapContainer>
    </div>
  );
}
