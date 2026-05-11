import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { config } from '@/lib/config';
import { STATUS_HEX, colors } from '@/lib/colors';
import { Text } from '@/components/ui';
import type { Lead } from '@/types';

Mapbox.setAccessToken(config.mapbox.token);

export default function MapScreen() {
  const q = useQuery({
    queryKey: ['leads-map'],
    queryFn:  () => leadsApi.list({ page_size: 2000 }),
    staleTime: 60_000,
  });

  const features = useMemo(() => {
    const leads = q.data?.data ?? [];
    return {
      type: 'FeatureCollection' as const,
      features: leads
        .filter((l): l is Lead & { lat: number; lng: number } => l.lat !== null && l.lng !== null)
        .map((l) => ({
          type: 'Feature' as const,
          id: l.id,
          properties: { id: l.id, status: l.status },
          geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] as [number, number] },
        })),
    };
  }, [q.data]);

  const initialCenter: [number, number] = [-95.3698, 29.7604]; // Houston fallback
  const firstLead = q.data?.data?.find((l) => l.lat !== null && l.lng !== null);
  const center: [number, number] = firstLead && firstLead.lat !== null && firstLead.lng !== null
    ? [firstLead.lng, firstLead.lat]
    : initialCenter;

  const statusColorExpression = useMemo<unknown>(() => {
    const exp: unknown[] = ['match', ['get', 'status']];
    for (const [status, hex] of Object.entries(STATUS_HEX)) {
      exp.push(status, hex);
    }
    exp.push('#94a3b8'); // fallback gray
    return exp;
  }, []);

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Dark}>
        <Mapbox.Camera zoomLevel={11} centerCoordinate={center} />

        <Mapbox.ShapeSource id="leads-source" shape={features as unknown as GeoJSON.FeatureCollection}>
          <Mapbox.CircleLayer
            id="leads-circles"
            style={{
              circleColor: statusColorExpression as never,
              circleRadius: 6,
              circleStrokeWidth: 1.5,
              circleStrokeColor: '#0a0f1e',
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      {q.isLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.brand} />
          <Text variant="caption" tone="dim">Loading leads…</Text>
        </View>
      )}

      <View style={styles.legend}>
        {Object.entries(STATUS_HEX).slice(0, 6).map(([status, hex]) => (
          <View key={status} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: hex }]} />
            <Text variant="caption" tone="dim">{status.replace(/_/g, ' ')}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  map:       { flex: 1 },
  overlay:   { position: 'absolute', top: 16, alignSelf: 'center', backgroundColor: colors.bgCard, padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  legend:    { position: 'absolute', left: 12, bottom: 12, backgroundColor: colors.bgCard + 'cc', padding: 8, borderRadius: 8, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
