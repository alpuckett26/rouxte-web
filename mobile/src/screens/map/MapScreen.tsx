import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { config } from '@/lib/config';
import { STATUS_HEX, colors } from '@/lib/colors';
import { Text } from '@/components/ui';
import type { Lead } from '@/types';

Mapbox.setAccessToken(config.mapbox.token);

type Filter = 'all' | 'fiber';

export default function MapScreen() {
  const [filter, setFilter] = useState<Filter>('all');

  const q = useQuery({
    queryKey: ['leads-map', filter],
    queryFn:  () => leadsApi.list({
      page_size: 2000,
      ...(filter === 'fiber' && { carrier: 'att' }),
    }),
    staleTime: 60_000,
  });

  const geolocatedLeads = useMemo(
    () => (q.data?.data ?? []).filter(
      (l): l is Lead & { lat: number; lng: number } => l.lat !== null && l.lng !== null,
    ),
    [q.data],
  );

  const features = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: geolocatedLeads.map((l) => ({
      type: 'Feature' as const,
      id: l.id,
      properties: { id: l.id, status: l.status },
      geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] as [number, number] },
    })),
  }), [geolocatedLeads]);

  const statusColorExpression = useMemo<unknown>(() => {
    const exp: unknown[] = ['match', ['get', 'status']];
    for (const [status, hex] of Object.entries(STATUS_HEX)) {
      exp.push(status, hex);
    }
    exp.push('#94a3b8');
    return exp;
  }, []);

  // Center on the first geolocated lead. If none, use Houston as a clear fallback.
  // We only render the Map after the query resolves so the initial frame doesn't
  // animate from Houston to the real territory.
  const center: [number, number] = geolocatedLeads[0]
    ? [geolocatedLeads[0].lng, geolocatedLeads[0].lat]
    : [-95.3698, 29.7604];
  const noLeadsAtAll = !q.isLoading && geolocatedLeads.length === 0;

  return (
    <View style={styles.container}>
      {q.isLoading ? (
        <View style={styles.fullLoader}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text tone="dim" style={{ marginTop: 12 }}>Loading leads…</Text>
        </View>
      ) : (
        <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Dark}>
          <Mapbox.Camera zoomLevel={11} centerCoordinate={center} animationMode="flyTo" animationDuration={0} />

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
      )}

      {/* Top filter overlay */}
      <View style={styles.topBar}>
        <View style={styles.chipRow}>
          <FilterChip label="All leads" active={filter === 'all'}   onPress={() => setFilter('all')}   />
          <FilterChip label="AT&T fiber" active={filter === 'fiber'} onPress={() => setFilter('fiber')} />
        </View>
        {!q.isLoading && (
          <Text variant="caption" tone="dim" style={styles.countLabel}>
            {geolocatedLeads.length} on map
          </Text>
        )}
      </View>

      {noLeadsAtAll && (
        <View style={styles.emptyOverlay}>
          <Text tone="dim" weight="medium">No geolocated leads</Text>
          <Text tone="mute" variant="caption" style={{ marginTop: 4, textAlign: 'center' }}>
            {filter === 'fiber'
              ? 'No AT&T-fiber leads with coordinates. Switch to All leads.'
              : 'Your leads need lat/lng to show on the map. Import via the web first.'}
          </Text>
        </View>
      )}

      {/* Bottom-left status legend */}
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

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text variant="caption" tone={active ? 'default' : 'dim'} weight={active ? 'semibold' : 'normal'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  map:          { flex: 1 },
  fullLoader:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar:       { position: 'absolute', top: 12, left: 12, right: 12, alignItems: 'center', gap: 6 },
  chipRow:      { flexDirection: 'row', gap: 6, backgroundColor: colors.bgCard + 'e6', padding: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chip:         { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  chipActive:   { backgroundColor: colors.brand },
  countLabel:   { backgroundColor: colors.bgCard + 'cc', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  emptyOverlay: { position: 'absolute', top: '40%', left: 24, right: 24, backgroundColor: colors.bgCard, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  legend:       { position: 'absolute', left: 12, bottom: 12, backgroundColor: colors.bgCard + 'cc', padding: 8, borderRadius: 8, gap: 4 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:    { width: 10, height: 10, borderRadius: 5 },
});
