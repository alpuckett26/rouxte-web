import React, { useCallback } from 'react';
import Mapbox from '@rnmapbox/maps';

interface Props {
  /** Called whenever Mapbox emits a new GPS fix. Coords are [lng, lat]. */
  onUpdate?: (coord: [number, number], accuracy: number | null) => void;
}

/**
 * Renders the live GPS puck on the map and surfaces coordinate updates
 * via onUpdate. Mapbox handles the platform permission prompt itself
 * on first render (we already declare ACCESS_FINE_LOCATION /
 * ACCESS_COARSE_LOCATION in AndroidManifest.xml).
 */
export function UserPuck({ onUpdate }: Props) {
  const handleUpdate = useCallback((location: {
    coords?: { latitude?: number; longitude?: number; accuracy?: number | null };
  } | null | undefined) => {
    if (!location?.coords) return;
    const { latitude, longitude, accuracy } = location.coords;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    onUpdate?.([longitude, latitude], accuracy ?? null);
  }, [onUpdate]);

  return (
    <Mapbox.UserLocation
      visible
      animated
      onUpdate={handleUpdate as never}
      showsUserHeadingIndicator
    />
  );
}
