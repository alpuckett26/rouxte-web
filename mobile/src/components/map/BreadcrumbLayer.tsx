import React from 'react';
import Mapbox from '@rnmapbox/maps';

interface Props {
  /** GeoJSON FeatureCollection — typically a single LineString of today's GPS samples. */
  shape: GeoJSON.FeatureCollection;
}

/**
 * Renders the rep's walking trail on the map as a faint dashed line.
 * Stays mounted permanently so RNMapbox doesn't crash on toggle —
 * feature collection is just empty when there's nothing to draw.
 */
export function BreadcrumbLayer({ shape }: Props) {
  return (
    <Mapbox.ShapeSource id="breadcrumb" shape={shape}>
      <Mapbox.LineLayer
        id="breadcrumb-line"
        style={{
          lineColor: '#1BAEE1',
          lineWidth: 3,
          lineOpacity: 0.55,
          lineCap: 'round',
          lineJoin: 'round',
          lineDasharray: [1, 1.5] as never,
        }}
      />
    </Mapbox.ShapeSource>
  );
}
