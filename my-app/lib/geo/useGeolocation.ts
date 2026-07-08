"use client";

import { useCallback, useState } from "react";

/**
 * Browser geolocation capture for Phase 4 batch 4.4 (nearby + serviceability).
 * Wraps `navigator.geolocation.getCurrentPosition` with explicit permission
 * states so callers can render prompt/denied/unavailable UX. The pure
 * `mapGeolocationError` helper is exported and unit-tested; the hook itself is
 * a thin stateful wrapper (no test infra for rendering hooks in this repo).
 */

export type GeolocationStatus =
  | "idle"
  | "prompting"
  | "granted"
  | "denied"
  | "unavailable"
  | "error";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeolocationState {
  coords?: Coordinates;
  status: GeolocationStatus;
  error?: string;
  /** Triggers the permission prompt / position read. Safe to call repeatedly (retry). */
  request: () => void;
}

/**
 * Maps a `GeolocationPositionError` (code 1/2/3) to our status + a
 * user-facing message. Pure — no DOM, no React — so it is unit-tested directly.
 */
export function mapGeolocationError(error: { code?: number; message?: string }): {
  status: GeolocationStatus;
  message: string;
} {
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return {
        status: "denied",
        message: "Location permission denied. Enable it to find restaurants near you.",
      };
    case 2: // POSITION_UNAVAILABLE
      return {
        status: "unavailable",
        message: "Your location is currently unavailable. Please try again.",
      };
    case 3: // TIMEOUT
      return {
        status: "error",
        message: "Timed out getting your location. Please try again.",
      };
    default:
      return {
        status: "error",
        message: error.message || "Could not determine your location.",
      };
  }
}

export function useGeolocation(): GeolocationState {
  const [coords, setCoords] = useState<Coordinates | undefined>(undefined);
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setStatus("prompting");
    setError(undefined);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("granted");
        setError(undefined);
      },
      (err) => {
        const mapped = mapGeolocationError(err);
        setStatus(mapped.status);
        setError(mapped.message);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  return { coords, status, error, request };
}
