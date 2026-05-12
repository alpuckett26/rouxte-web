import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Linking, Alert } from 'react-native';
import Mapbox, { type MapView as MapboxMapViewType } from '@rnmapbox/maps';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { logsApi } from '@/api/logs';
import { fccApi, type BBox } from '@/api/fcc';
import { config } from '@/lib/config';
import { STATUS_HEX, colors } from '@/lib/colors';
import { Text, Card, Button, Badge, Modal, Input } from '@/components/ui';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/leads';
import { LOG_EVENT_LABELS } from '@/lib/logs';
import { KnockCounter } from '@/components/dashboard/KnockCounter';
import { useKnockCounter } from '@/hooks/useKnockCounter';
import { useProfile } from '@/hooks/useProfile';
import { useNavigation } from '@react-navigation/native';
import type { Lead, LeadStatus, LogEventType } from '@/types';

Mapbox.setAccessToken(config.mapbox.token);

type LeadFilter = 'all' | 'fiber';
type StyleMode = 'streets' | 'satellite';

const STYLE_URLS: Record<StyleMode, string> = {
  streets:   Mapbox.StyleURL.Dark,
  satellite: Mapbox.StyleURL.SatelliteStreet,
};

const QUICK_LOG_EVENTS: LogEventType[] = [
  'door_knock',
  'no_solicit_observed',
  'do_not_knock_marked',
  'appointment_set',
  'appointment_missed',
  'complaint_received',
];

export default function MapScreen() {
  const nav = useNavigation();
  const qc = useQueryClient();
  const { profile } = useProfile();
  const showKnockCounter = profile?.role === 'sales_rep' || profile?.role === 'team_lead';

  const [leadFilter, setLeadFilter] = useState<LeadFilter>('all');
  const [styleMode, setStyleMode] = useState<StyleMode>('streets');
  const [showFiberLayer, setShowFiberLayer] = useState(true);
  const [showAddressDots, setShowAddressDots] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const [bbox, setBbox] = useState<BBox | null>(null);
  const [zoom, setZoom] = useState(11);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [quickLogLead, setQuickLogLead] = useState<Lead | null>(null);
  const [captureCoord, setCaptureCoord] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<MapboxMapViewType>(null);
  const bboxFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const leadsQ = useQuery({
    queryKey: ['leads-map', leadFilter],
    queryFn:  () => leadsApi.list({
      page_size: 2000,
      ...(leadFilter === 'fiber' && { carrier: 'att' }),
    }),
    staleTime: 60_000,
  });

  const fccBlocksQ = useQuery({
    queryKey: ['fcc-blocks', bbox],
    queryFn:  () => (bbox ? fccApi.blocks(bbox) : Promise.resolve(emptyFc())),
    enabled:  !!bbox && zoom >= 11 && showFiberLayer,
    staleTime: 60 * 60 * 1000,
  });

  const fccCoverageQ = useQuery({
    queryKey: ['fcc-coverage', bbox],
    queryFn:  () => (bbox ? fccApi.coverage(bbox) : Promise.resolve(emptyFc())),
    enabled:  !!bbox && zoom >= 13 && showAddressDots,
    staleTime: 60 * 60 * 1000,
  });

  const heatmapQ = useQuery({
    queryKey: ['fiber-heatmap', bbox],
    queryFn:  () => (bbox ? leadsApi.fiberHeatmap(bbox) : Promise.resolve(emptyFc())),
    enabled:  !!bbox && showHeatmap,
    staleTime: 60 * 60 * 1000,
  });

  const geolocatedLeads = useMemo(
    () => (leadsQ.data?.data ?? []).filter(
      (l): l is Lead & { lat: number; lng: number } => l.lat !== null && l.lng !== null,
    ),
    [leadsQ.data],
  );

  const totalLeads = leadsQ.data?.data?.length ?? 0;

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
    for (const [status, hex] of Object.entries(STATUS_HEX)) exp.push(status, hex);
    exp.push('#94a3b8');
    return exp;
  }, []);

  const center: [number, number] = geolocatedLeads[0]
    ? [geolocatedLeads[0].lng, geolocatedLeads[0].lat]
    : [-95.3698, 29.7604];

  // Track viewport — debounced.
  const onCameraChanged = useCallback((e: { properties: { zoom: number } }) => {
    setZoom(e.properties.zoom);
    if (bboxFetchTimer.current) clearTimeout(bboxFetchTimer.current);
    bboxFetchTimer.current = setTimeout(async () => {
      const map = mapRef.current;
      if (!map) return;
      try {
        const bounds = await map.getVisibleBounds();
        if (!bounds || bounds.length !== 2) return;
        const [[east, north], [west, south]] = bounds;
        setBbox({ north, south, east, west });
      } catch { /* ignore */ }
    }, 600);
  }, []);

  // Tap on a lead circle — open detail sheet
  const onLeadCirclePress = useCallback((e: { features?: Array<{ properties?: { id?: string } }> }) => {
    const id = e.features?.[0]?.properties?.id;
    if (!id) return;
    const lead = geolocatedLeads.find((l) => l.id === id);
    if (lead) setSelectedLead(lead);
  }, [geolocatedLeads]);

  // Long-press a lead → quick-log sheet (uses Mapbox long-press detection via second tap handler)
  // RNMapbox doesn't expose long-press on layers natively; we use a fallback button in the lead sheet
  // for "Quick log" that opens the same sheet.

  // Tap empty map → capture lead at that coord
  const onMapPress = useCallback((e: { geometry?: { coordinates?: [number, number] }; features?: unknown[] }) => {
    // If a lead feature was hit, onLeadCirclePress on the ShapeSource fires first; skip here.
    if (!e.geometry?.coordinates) return;
    const [lng, lat] = e.geometry.coordinates;
    // Defer to allow ShapeSource onPress to run first
    setTimeout(() => {
      if (!selectedLeadRef.current && !captureRef.current) {
        setCaptureCoord({ lat, lng });
      }
    }, 200);
  }, []);

  // Refs used by the deferred check above
  const selectedLeadRef = useRef<Lead | null>(null);
  const captureRef = useRef<{ lat: number; lng: number } | null>(null);
  React.useEffect(() => { selectedLeadRef.current = selectedLead; }, [selectedLead]);
  React.useEffect(() => { captureRef.current = captureCoord; }, [captureCoord]);

  const noGeolocated = !leadsQ.isLoading && geolocatedLeads.length === 0;

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
          styleURL={STYLE_URLS[styleMode]}
          onCameraChanged={onCameraChanged}
          onPress={onMapPress}
        >
          <Mapbox.Camera zoomLevel={11} centerCoordinate={center} animationMode="flyTo" animationDuration={0} />

          {/* FCC fiber coverage (green polygons) */}
          {showFiberLayer && fccBlocksQ.data && (
            <Mapbox.ShapeSource id="fcc-blocks" shape={fccBlocksQ.data as GeoJSON.FeatureCollection}>
              <Mapbox.FillLayer
                id="fcc-blocks-fill"
                style={{
                  fillColor: '#22c55e',
                  fillOpacity: ['interpolate', ['linear'], ['zoom'], 8, 0.25, 13, 0.15, 16, 0.08] as never,
                }}
              />
              <Mapbox.LineLayer
                id="fcc-blocks-outline"
                style={{
                  lineColor: '#16a34a',
                  lineWidth: 1,
                  lineOpacity: ['interpolate', ['linear'], ['zoom'], 10, 0, 11, 0.6, 15, 0.3] as never,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Fiber heatmap from BDC */}
          {showHeatmap && heatmapQ.data && (
            <Mapbox.ShapeSource id="fiber-heat" shape={heatmapQ.data as GeoJSON.FeatureCollection}>
              <Mapbox.HeatmapLayer
                id="fiber-heat-layer"
                style={{
                  heatmapWeight:    1,
                  heatmapIntensity: ['interpolate', ['linear'], ['zoom'], 7, 0.8, 13, 1.8] as never,
                  heatmapRadius:    ['interpolate', ['linear'], ['zoom'], 7, 14, 10, 22, 13, 35] as never,
                  heatmapOpacity:   ['interpolate', ['linear'], ['zoom'], 7, 0.80, 14, 0.60] as never,
                  heatmapColor: [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0,    'rgba(0,0,0,0)',
                    0.15, 'rgba(103,169,207,0.6)',
                    0.35, 'rgba(65,182,196,0.8)',
                    0.55, 'rgba(35,139,69,0.9)',
                    0.75, 'rgba(161,217,155,0.95)',
                    1,    'rgba(255,255,178,1)',
                  ] as never,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* AT&T fiber address dots (blue) */}
          {showAddressDots && fccCoverageQ.data && (
            <Mapbox.ShapeSource id="att-dots" shape={fccCoverageQ.data as GeoJSON.FeatureCollection}>
              <Mapbox.CircleLayer
                id="att-dots-layer"
                style={{
                  circleColor: '#3b82f6',
                  circleRadius: ['interpolate', ['linear'], ['zoom'], 13, 1.5, 15, 3, 17, 5] as never,
                  circleOpacity: 0.7,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Leads (status-colored, always on top) */}
          <Mapbox.ShapeSource id="leads-source" shape={features as GeoJSON.FeatureCollection} onPress={onLeadCirclePress}>
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

      {/* Top filter bar */}
      <View style={styles.topBar}>
        <View style={styles.chipRow}>
          <FilterChip label="All leads"   active={leadFilter === 'all'}   onPress={() => setLeadFilter('all')} />
          <FilterChip label="AT&T fiber"  active={leadFilter === 'fiber'} onPress={() => setLeadFilter('fiber')} />
        </View>

        <View style={[styles.chipRow, { marginTop: 4 }]}>
          <FilterChip
            label={showFiberLayer ? '✓ Fiber blocks' : 'Fiber blocks'}
            active={showFiberLayer}
            onPress={() => setShowFiberLayer((v) => !v)}
            size="small"
          />
          <FilterChip
            label={showAddressDots ? '✓ AT&T dots' : 'AT&T dots'}
            active={showAddressDots}
            onPress={() => setShowAddressDots((v) => !v)}
            size="small"
          />
          <FilterChip
            label={showHeatmap ? '✓ Heatmap' : 'Heatmap'}
            active={showHeatmap}
            onPress={() => setShowHeatmap((v) => !v)}
            size="small"
          />
          <FilterChip
            label={styleMode === 'streets' ? '🛰️ Sat' : '🗺️ Map'}
            active={styleMode === 'satellite'}
            onPress={() => setStyleMode((m) => (m === 'streets' ? 'satellite' : 'streets'))}
            size="small"
          />
        </View>

        {!leadsQ.isLoading && (
          <Text variant="caption" tone="dim" style={styles.countLabel}>
            {geolocatedLeads.length} on map
            {totalLeads > geolocatedLeads.length && ` · ${totalLeads - geolocatedLeads.length} no coords`}
            {showAddressDots && fccCoverageQ.data && ` · ${(fccCoverageQ.data.features ?? []).length} AT&T addrs`}
          </Text>
        )}

        {zoom < 11 && (showFiberLayer || showHeatmap) && (
          <View style={styles.zoomHint}><Text variant="caption" tone="dim">Zoom in to see overlays</Text></View>
        )}
        {zoom < 13 && showAddressDots && (
          <View style={styles.zoomHint}><Text variant="caption" tone="dim">Zoom to 13+ for AT&T address dots</Text></View>
        )}
      </View>

      {noGeolocated && totalLeads > 0 && (
        <View style={styles.emptyOverlay}>
          <Text tone="dim" weight="medium">{totalLeads} leads — none have coordinates yet</Text>
          <Text tone="mute" variant="caption" style={{ marginTop: 4, textAlign: 'center' }}>
            Geocode them on the web (Leads → Import) or tap an empty area below to capture a new lead at that location.
          </Text>
        </View>
      )}

      {noGeolocated && totalLeads === 0 && (
        <View style={styles.emptyOverlay}>
          <Text tone="dim" weight="medium">No leads yet</Text>
          <Text tone="mute" variant="caption" style={{ marginTop: 4, textAlign: 'center' }}>
            Tap an empty area to drop a pin and capture a lead.
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
        onQuickLog={() => {
          if (!selectedLead) return;
          setQuickLogLead(selectedLead);
          setSelectedLead(null);
        }}
      />

      <QuickLogSheet
        lead={quickLogLead}
        onClose={() => setQuickLogLead(null)}
        onLogged={() => {
          qc.invalidateQueries({ queryKey: ['logs'] });
          qc.invalidateQueries({ queryKey: ['lead-logs', quickLogLead?.id] });
          qc.invalidateQueries({ queryKey: ['rep-knocks'] });
          setQuickLogLead(null);
        }}
      />

      <CaptureLeadModal
        coord={captureCoord}
        onClose={() => setCaptureCoord(null)}
        onCreated={(leadId) => {
          qc.invalidateQueries({ queryKey: ['leads-map'] });
          qc.invalidateQueries({ queryKey: ['leads'] });
          setCaptureCoord(null);
          nav.navigate('Leads' as never, { screen: 'LeadDetail', params: { leadId } } as never);
        }}
      />
    </View>
  );
}

function emptyFc(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function FilterChip({ label, active, onPress, size = 'normal' }: {
  label: string; active: boolean; onPress: () => void; size?: 'normal' | 'small';
}) {
  return (
    <Pressable onPress={onPress} style={[
      styles.chip,
      size === 'small' && styles.chipSmall,
      active && styles.chipActive,
    ]}>
      <Text variant="caption" tone={active ? 'default' : 'dim'} weight={active ? 'semibold' : 'normal'}>
        {label}
      </Text>
    </Pressable>
  );
}

function LeadSheet({ lead, onClose, onOpen, onQuickLog }: {
  lead: Lead | null; onClose: () => void; onOpen: () => void; onQuickLog: () => void;
}) {
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
          <Button title="Quick log" onPress={onQuickLog} variant="secondary" fullWidth={false} style={{ flex: 1 }} />
          {lead.phone && (
            <Button title="Call" onPress={() => Linking.openURL(`tel:${lead.phone}`)} variant="secondary" fullWidth={false} style={{ flex: 1 }} />
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

function QuickLogSheet({ lead, onClose, onLogged }: {
  lead: Lead | null; onClose: () => void; onLogged: () => void;
}) {
  const m = useMutation({
    mutationFn: (event_type: LogEventType) => logsApi.create({
      lead_id: lead!.id,
      event_type,
      summary: LOG_EVENT_LABELS[event_type] ?? String(event_type),
    }),
    onSuccess: () => onLogged(),
    onError: (e: Error) => Alert.alert('Log failed', e.message),
  });

  if (!lead) return null;
  return (
    <Modal visible onClose={onClose} title="Quick log">
      <Text tone="dim" style={{ marginBottom: 8 }} numberOfLines={1}>{lead.address}</Text>
      <View style={{ gap: 6 }}>
        {QUICK_LOG_EVENTS.map((ev) => (
          <Button
            key={ev}
            title={LOG_EVENT_LABELS[ev]}
            onPress={() => m.mutate(ev)}
            variant={ev === 'no_solicit_observed' || ev === 'do_not_knock_marked' || ev === 'complaint_received' ? 'danger' : 'secondary'}
            loading={m.isPending && m.variables === ev}
            disabled={m.isPending}
          />
        ))}
      </View>
    </Modal>
  );
}

function CaptureLeadModal({ coord, onClose, onCreated }: {
  coord: { lat: number; lng: number } | null; onClose: () => void; onCreated: (leadId: string) => void;
}) {
  const [address, setAddress] = useState('');
  const [attStatus, setAttStatus] = useState<'checking' | 'available' | 'unavailable' | null>(null);

  // Auto-fetch FCC availability when modal opens
  React.useEffect(() => {
    if (!coord) { setAddress(''); setAttStatus(null); return; }
    setAttStatus('checking');
    fccApi.check(coord.lat, coord.lng)
      .then((res) => setAttStatus(res.att_available ? 'available' : 'unavailable'))
      .catch(() => setAttStatus(null));
  }, [coord]);

  const create = useMutation({
    mutationFn: () => leadsApi.create({
      address: address.trim(),
      lat: coord!.lat,
      lng: coord!.lng,
      status: 'new',
      source: 'map',
      carrier_availability: {
        att: attStatus === 'available',
        competitors: [],
        max_down_mbps: null,
        max_up_mbps: null,
        tech_codes: [],
        fcc_block_id: null,
      },
    } as never),
    onSuccess: (res) => onCreated(res.data.id),
    onError: (e: Error) => Alert.alert('Could not create lead', e.message),
  });

  if (!coord) return null;
  return (
    <Modal visible onClose={onClose} title="Capture lead at this location">
      <Text variant="caption" tone="dim" style={{ marginBottom: 8 }}>
        {coord.lat.toFixed(5)}, {coord.lng.toFixed(5)}
      </Text>

      {attStatus === 'checking' && <Text variant="caption" tone="dim">Checking AT&T availability…</Text>}
      {attStatus === 'available' && <Badge label="✓ AT&T Fiber available" color="green" dot />}
      {attStatus === 'unavailable' && <Badge label="No AT&T fiber here" color="gray" dot />}

      <Input
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="123 Main St, Houston TX"
        autoComplete="street-address"
        style={{ marginTop: 12 }}
      />

      <Button
        title="Save lead"
        onPress={() => create.mutate()}
        loading={create.isPending}
        disabled={!address.trim()}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  map:          { flex: 1 },
  fullLoader:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar:       { position: 'absolute', top: 12, left: 12, right: 12, alignItems: 'center', gap: 4 },
  chipRow:      { flexDirection: 'row', gap: 4, backgroundColor: colors.bgCard + 'e6', padding: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border, flexWrap: 'wrap', justifyContent: 'center' },
  chip:         { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  chipSmall:    { paddingHorizontal: 8, paddingVertical: 4 },
  chipActive:   { backgroundColor: colors.brand },
  countLabel:   { backgroundColor: colors.bgCard + 'cc', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  zoomHint:     { backgroundColor: colors.warning + '33', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  emptyOverlay: { position: 'absolute', top: '35%', left: 24, right: 24, backgroundColor: colors.bgCard, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  legend:       { position: 'absolute', left: 12, bottom: 12, backgroundColor: colors.bgCard + 'cc', padding: 8, borderRadius: 8, gap: 4 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:    { width: 10, height: 10, borderRadius: 5 },
});
