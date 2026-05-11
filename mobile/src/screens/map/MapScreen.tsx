import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Linking } from 'react-native';
import Mapbox, { type MapView as MapboxMapViewType } from '@rnmapbox/maps';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { fccApi, type BBox } from '@/api/fcc';
import { config } from '@/lib/config';
import { STATUS_HEX, colors } from '@/lib/colors';
import { Text, Card, Button, Badge, Modal } from '@/components/ui';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/leads';
import { KnockCounter } from '@/components/dashboard/KnockCounter';
import { useKnockCounter } from '@/hooks/useKnockCounter';
import { useProfile } from '@/hooks/useProfile';
import { useNavigation } from '@react-navigation/native';
import type { Lead, LeadStatus } from '@/types';

Mapbox.setAccessToken(config.mapbox.token);

type Filter = 'all' | 'fiber';

export default function MapScreen() {
  const nav = useNavigation();
  const { profile } = useProfile();
  const showKnockCounter = profile?.role === 'sales_rep' || profile?.role === 'team_lead';

  const [filter, setFilter] = useState<Filter>('all');
  const [showFiberLayer, setShowFiberLayer] = useState(true);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [zoom, setZoom] = useState(11);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const mapRef = useRef<MapboxMapViewType>(null);
  const bboxFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const leadsQ = useQuery({
    queryKey: ['leads-map', filter],
    queryFn:  () => leadsApi.list({
      page_size: 2000,
      ...(filter === 'fiber' && { carrier: 'att' }),
    }),
    staleTime: 60_000,
  });

  // FCC fiber-block polygons — only at zoom >= 11
  const fccQ = useQuery({
    queryKey: ['fcc-blocks', bbox],
    queryFn:  () => bbox ? fccApi.blocks(bbox) : Promise.resolve({ type: 'FeatureCollection' as const, features: [] }),
    enabled:  !!bbox && zoom >= 11 && showFiberLayer,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const geolocatedLeads = useMemo(
    () => (leadsQ.data?.data ?? []).filter(
      (l): l is Lead & { lat: number; lng: number } => l.lat !== null && l.lng !== null,
    ),
    [leadsQ.data],
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

  const center: [number, number] = geolocatedLeads[0]
    ? [geolocatedLeads[0].lng, geolocatedLeads[0].lat]
    : [-95.3698, 29.7604];
  const noLeadsAtAll = !leadsQ.isLoading && geolocatedLeads.length === 0;

  // Track viewport — debounced; refetch FCC blocks on settle.
  const onCameraChanged = useCallback((e: { properties: { zoom: number; center: [number, number] } }) => {
    setZoom(e.properties.zoom);

    if (bboxFetchTimer.current) clearTimeout(bboxFetchTimer.current);
    bboxFetchTimer.current = setTimeout(async () => {
      const map = mapRef.current;
      if (!map) return;
      try {
        const bounds = await map.getVisibleBounds(); // [[neLon, neLat], [swLon, swLat]]
        if (!bounds || bounds.length !== 2) return;
        const [[east, north], [west, south]] = bounds;
        setBbox({ north, south, east, west });
      } catch {
        // ignore
      }
    }, 600);
  }, []);

  // Tap on a lead circle — open detail sheet
  const onCirclePress = useCallback((e: { features?: Array<{ properties?: { id?: string } }> }) => {
    const id = e.features?.[0]?.properties?.id;
    if (!id) return;
    const lead = geolocatedLeads.find((l) => l.id === id);
    if (lead) setSelectedLead(lead);
  }, [geolocatedLeads]);

  return (
    <View style={styles.container}>
      {leadsQ.isLoading ? (
        <View style={styles.fullLoader}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text tone="dim" style={{ marginTop: 12 }}>Loading leads…</Text>
        </View>
      ) : (
        <Mapbox.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={Mapbox.StyleURL.Dark}
          onCameraChanged={onCameraChanged}
        >
          <Mapbox.Camera zoomLevel={11} centerCoordinate={center} animationMode="flyTo" animationDuration={0} />

          {/* FCC fiber coverage — green polygons below leads */}
          {showFiberLayer && fccQ.data && (
            <Mapbox.ShapeSource id="fcc-blocks" shape={fccQ.data as GeoJSON.FeatureCollection}>
              <Mapbox.FillLayer
                id="fcc-blocks-fill"
                style={{
                  fillColor: '#22c55e',
                  fillOpacity: [
                    'interpolate', ['linear'], ['zoom'],
                    8,  0.25,
                    13, 0.15,
                    16, 0.08,
                  ] as never,
                }}
              />
              <Mapbox.LineLayer
                id="fcc-blocks-outline"
                style={{
                  lineColor: '#16a34a',
                  lineWidth: 1,
                  lineOpacity: [
                    'interpolate', ['linear'], ['zoom'],
                    10, 0,
                    11, 0.6,
                    15, 0.3,
                  ] as never,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          <Mapbox.ShapeSource id="leads-source" shape={features as GeoJSON.FeatureCollection} onPress={onCirclePress}>
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
          <FilterChip label="All leads"  active={filter === 'all'}   onPress={() => setFilter('all')} />
          <FilterChip label="AT&T fiber" active={filter === 'fiber'} onPress={() => setFilter('fiber')} />
        </View>
        <View style={[styles.chipRow, { marginTop: 4 }]}>
          <FilterChip
            label={showFiberLayer ? '✓ Fiber overlay' : 'Fiber overlay'}
            active={showFiberLayer}
            onPress={() => setShowFiberLayer((v) => !v)}
          />
        </View>
        {!leadsQ.isLoading && (
          <Text variant="caption" tone="dim" style={styles.countLabel}>
            {geolocatedLeads.length} on map
            {showFiberLayer && fccQ.data && ` · ${(fccQ.data.features ?? []).length} fiber blocks`}
          </Text>
        )}
        {zoom < 11 && showFiberLayer && (
          <View style={styles.zoomHint}>
            <Text variant="caption" tone="dim">Zoom in to see fiber coverage</Text>
          </View>
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

      {showKnockCounter && <KnockCounter bottomOffset={16} position="bottom-right" />}

      <View style={styles.legend}>
        {Object.entries(STATUS_HEX).slice(0, 6).map(([status, hex]) => (
          <View key={status} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: hex }]} />
            <Text variant="caption" tone="dim">{status.replace(/_/g, ' ')}</Text>
          </View>
        ))}
      </View>

      <LeadSheet
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onOpen={() => {
          if (!selectedLead) return;
          const leadId = selectedLead.id;
          setSelectedLead(null);
          nav.navigate('Leads' as never, { screen: 'LeadDetail', params: { leadId } } as never);
        }}
      />
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

function LeadSheet({ lead, onClose, onOpen }: { lead: Lead | null; onClose: () => void; onOpen: () => void }) {
  const { logKnock, loggingKnock } = useKnockCounter(lead?.id);

  if (!lead) return null;
  return (
    <Modal visible onClose={onClose} title={lead.address ?? 'Lead'}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Badge label={LEAD_STATUS_LABELS[lead.status as LeadStatus]} color={LEAD_STATUS_COLORS[lead.status as LeadStatus]} dot />
        {lead.is_do_not_knock && <Badge label="DNK" color="red" />}
        {lead.carrier_availability?.att && <Badge label="AT&T Fiber" color="green" />}
      </View>

      {lead.customer_name && <Text tone="dim" style={{ marginBottom: 6 }}>{lead.customer_name}</Text>}
      {lead.phone && <Text tone="dim" style={{ marginBottom: 12 }}>{lead.phone}</Text>}

      <View style={{ gap: 8 }}>
        <Button title="Open lead" onPress={onOpen} variant="primary" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Log knock" onPress={logKnock} loading={loggingKnock} variant="secondary" fullWidth={false} style={{ flex: 1 }} />
          {lead.phone && (
            <Button
              title="Call"
              onPress={() => Linking.openURL(`tel:${lead.phone}`)}
              variant="secondary"
              fullWidth={false}
              style={{ flex: 1 }}
            />
          )}
          <Button
            title="Directions"
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(lead.address ?? '')}`)}
            variant="secondary"
            fullWidth={false}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  map:          { flex: 1 },
  fullLoader:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar:       { position: 'absolute', top: 12, left: 12, right: 12, alignItems: 'center', gap: 4 },
  chipRow:      { flexDirection: 'row', gap: 6, backgroundColor: colors.bgCard + 'e6', padding: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chip:         { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  chipActive:   { backgroundColor: colors.brand },
  countLabel:   { backgroundColor: colors.bgCard + 'cc', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  zoomHint:     { backgroundColor: colors.warning + '33', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  emptyOverlay: { position: 'absolute', top: '40%', left: 24, right: 24, backgroundColor: colors.bgCard, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  legend:       { position: 'absolute', left: 12, bottom: 12, backgroundColor: colors.bgCard + 'cc', padding: 8, borderRadius: 8, gap: 4 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:    { width: 10, height: 10, borderRadius: 5 },
});
