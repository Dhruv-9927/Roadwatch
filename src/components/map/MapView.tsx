import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import './MapView.css';
import { useAppStore } from '../../store/app.store';
import { fetchAccidentStats, fetchNHProjects } from '../../lib/live-data';
import { resolveAuthority } from '../../lib/routing-engine';
import { computeRiskScore, getRiskLabel } from '../../lib/risk-scorer';

// ── CartoDB Dark Matter (dark mode)
const STYLE_DARK: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
      maxzoom: 20,
    },
  },
  layers: [{ id: 'carto-tiles', type: 'raster', source: 'carto' }],
};

// CartoDB Positron (light mode)
const STYLE_LIGHT: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
      maxzoom: 20,
    },
  },
  layers: [{ id: 'carto-tiles', type: 'raster', source: 'carto' }],
};

// Free OSRM routing API (no key needed)
const OSRM_API = 'https://router.project-osrm.org/route/v1/driving';
// Nominatim geocoding
const NOMINATIM  = 'https://nominatim.openstreetmap.org';

// Condition → colour mapping (traffic-light style)
const CONDITION_COLORS = {
  good:     '#2a9d8f',  // teal-green
  fair:     '#f9c74f',  // yellow
  poor:     '#f4a261',  // amber
  critical: '#e63946',  // red
};

interface GeoPlace {
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteSegment {
  coords: [number, number][];
  condition: 'good' | 'fair' | 'poor' | 'critical';
  authority: string;
  authorityEE: string;
  authorityPhone: string;
  riskScore: number;
}

interface RouteResult {
  distance_km: number;
  duration_min: number;
  overall_risk: number;
  segments: RouteSegment[];
  authorities: { name: string; ee: string; phone: string; type: string }[];
}

// Compute overall risk score for a route (mock per-segment scoring)
async function scoreRoute(
  coordinates: [number, number][],
  accidentStats: any[],
  nhProjects: any[]
): Promise<RouteSegment[]> {
  // Split route into logical segments and score each
  const chunkSize = Math.max(3, Math.floor(coordinates.length / 4));
  const segments: RouteSegment[] = [];

  for (let i = 0; i < coordinates.length - 1; i += chunkSize) {
    const chunk = coordinates.slice(i, Math.min(i + chunkSize + 1, coordinates.length));
    if (chunk.length < 2) continue;

    // Assign deterministic risk per segment based on position in route
    // (In production: cross-reference with OSM Overpass for each segment's road type)
    const fraction = i / coordinates.length;
    const riskInput = {
      years_since_relaying: 2 + fraction * 8,
      accident_density: 2 + Math.sin(fraction * Math.PI * 2) * 4 + 4,
      budget_utilization: 0.5 + fraction * 0.4,
      terrain_type: 'hilly' as const,
      road_width: 2,
      traffic_volume_proxy: 0.4 + fraction * 0.3,
    };
    const riskResult = computeRiskScore(riskInput);

    const condition: RouteSegment['condition'] =
      riskResult.score >= 70 ? 'critical' :
      riskResult.score >= 50 ? 'poor' :
      riskResult.score >= 30 ? 'fair' : 'good';

    // Resolve authority based on segment position
    const roadType = fraction < 0.3 ? 'NH' : fraction < 0.6 ? 'SH' : 'MDR';
    const mockRoad: any = { road_type: roadType, district: 'mandi', state: 'Himachal Pradesh' };
    const auth = resolveAuthority(mockRoad);

    segments.push({
      coords: chunk as [number, number][],
      condition,
      authority: auth.name,
      authorityEE: auth.executive_engineer,
      authorityPhone: auth.phone,
      riskScore: riskResult.score,
    });
  }

  return segments;
}

// ── Nominatim search ──────────────────────────────────────────────────────────
async function searchPlace(query: string, countryCode = 'in'): Promise<GeoPlace[]> {
  if (query.length < 3) return [];
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&countrycodes=${countryCode}&format=json&limit=5&addressdetails=1`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'ROADWATCH/1.0' } });
    return await res.json();
  } catch {
    return [];
  }
}

// ── Input with autocomplete ───────────────────────────────────────────────────
function PlaceInput({
  id, placeholder, color, value, onChange, onSelect,
}: {
  id: string;
  placeholder: string;
  color: string;
  value: string;
  onChange: (val: string) => void;
  onSelect: (place: GeoPlace) => void;
}) {
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const results = await searchPlace(val);
      setSuggestions(results);
    }, 350);
  };

  const handleSelect = (place: GeoPlace) => {
    onChange(place.display_name.split(',').slice(0, 2).join(',').trim());
    setSuggestions([]);
    onSelect(place);
  };

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <input
        id={id}
        className="route-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        autoComplete="off"
        style={{ width: '100%', boxSizing: 'border-box' }}
        aria-label={placeholder}
        aria-autocomplete="list"
      />
      {suggestions.length > 0 && (
        <div className="route-suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <div key={i} className="route-suggestion-item" role="option" aria-selected="false"
              onClick={() => handleSelect(s)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelect(s)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="10" r="3"/>
                <path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 14-8 14S4 15.25 4 10a8 8 0 0 1 8-8z"/>
              </svg>
              <span style={{ color }}>{s.display_name.split(',').slice(0, 3).join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Issue categories (NHAI/MoRTH complaint types) ───────────────────────────
const ISSUE_TYPES = [
  {
    id: 'pothole',
    emoji: '🕳',
    label: 'Pothole',
    sub: 'Bowl-shaped depression ≥ 150mm',
    color: '#e63946',
    authority: 'NHAI PIU / State PWD',
    irc: 'IRC:SP:16-2004',
  },
  {
    id: 'object',
    emoji: '⚠',
    label: 'Object / Debris',
    sub: 'Rocks, fallen tree, vehicle wreck',
    color: '#f4a261',
    authority: 'District Collector / NH Police',
    irc: 'MV Act §184',
  },
  {
    id: 'road_damage',
    emoji: '🚧',
    label: 'Road Damage',
    sub: 'Cracking, rutting, surface failure',
    color: '#f9c74f',
    authority: 'NHAI PIU / PWD Division',
    irc: 'IRC:81-1997',
  },
  {
    id: 'flooding',
    emoji: '🌊',
    label: 'Flooding / Waterlogging',
    sub: 'Blocked drain, water on carriageway',
    color: '#4cc9f0',
    authority: 'PWD Drainage Cell / Municipal',
    irc: 'IRC:SP:50-1999',
  },
  {
    id: 'missing_sign',
    emoji: '🚦',
    label: 'Missing / Damaged Sign',
    sub: 'Road sign, guardrail, km post',
    color: '#52b788',
    authority: 'NHAI / State PWD Sign Cell',
    irc: 'IRC:67-2012',
  },
  {
    id: 'encroachment',
    emoji: '🏗',
    label: 'Encroachment',
    sub: 'Illegal structure on ROW',
    color: '#a0a0b0',
    authority: 'NHAI Land Acquisition / Revenue',
    irc: 'NH Act §8',
  },
  {
    id: 'streetlight',
    emoji: '💡',
    label: 'Street Light Failure',
    sub: 'Broken or missing highway light',
    color: '#f9c74f',
    authority: 'NHAI Concessionaire / HPSEBL',
    irc: 'IRC:SP:72-2007',
  },
  {
    id: 'bridge',
    emoji: '🌉',
    label: 'Bridge / Culvert Issue',
    sub: 'Structural crack, scour, railing',
    color: '#e63946',
    authority: 'NHAI Bridge Wing / PWD Bridge Div',
    irc: 'IRC:6-2017',
  },
] as const;

type IssueTypeId = (typeof ISSUE_TYPES)[number]['id'];

// ── Quick Report Sheet ────────────────────────────────────────────────────────
function QuickReportSheet({
  open,
  onClose,
  routeFrom,
  routeTo,
  authority,
}: {
  open: boolean;
  onClose: () => void;
  routeFrom: string;
  routeTo: string;
  authority: string;
}) {
  const [selected,  setSelected]  = useState<IssueTypeId | null>(null);
  const [severity,  setSeverity]  = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [gps,       setGps]       = useState<string>('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const selectedIssue = ISSUE_TYPES.find((t) => t.id === selected);

  const captureGPS = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Reset on close
  useEffect(() => {
    if (!open) { setSelected(null); setSeverity('high'); setGps(''); }
  }, [open]);

  if (!open) return null;

  const SEVERITY_COLORS: Record<string, string> = {
    low: '#52b788', medium: '#f9c74f', high: '#f4a261', critical: '#e63946',
  };

  return (
    <div
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        zIndex: 50,
        background: 'rgba(15,17,23,0.98)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px 20px 0 0',
        maxHeight: '88vh',
        overflowY: 'auto',
        animation: 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1) both',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
      }}
      role="dialog"
      aria-label="Report a road issue"
      aria-modal="true"
    >
      {/* Drag handle */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 16px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--color-text-primary)', fontWeight: 600 }}>
            Report a Road Issue
          </div>
          {routeFrom && routeTo && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 3 }}>
              {routeFrom.split(',')[0]} → {routeTo.split(',')[0]}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close report sheet"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--color-text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18, lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Issue type grid ── */}
        <div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            What is the issue?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {ISSUE_TYPES.map((issue) => (
              <button
                key={issue.id}
                id={`issue-type-${issue.id}`}
                onClick={() => setSelected(issue.id === selected ? null : issue.id)}
                aria-pressed={selected === issue.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  background: selected === issue.id
                    ? `rgba(${issue.color === '#e63946' ? '230,57,70' : issue.color === '#f4a261' ? '244,162,97' : issue.color === '#f9c74f' ? '249,199,79' : issue.color === '#4cc9f0' ? '76,201,240' : issue.color === '#52b788' ? '82,183,136' : '160,160,176'},0.14)`
                    : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${selected === issue.id ? issue.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{issue.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: 600,
                    color: selected === issue.id ? issue.color : 'var(--color-text-primary)',
                    fontFamily: 'var(--font-body)',
                  }}>
                    {issue.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {issue.sub}
                  </div>
                </div>
                {selected === issue.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={issue.color} style={{ flexShrink: 0 }} aria-hidden="true">
                    <path d="M20 6L9 17l-5-5"/>
                    <polyline points="20 6 9 17 4 12" fill="none" stroke={issue.color} strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Responsible authority (shown after selection) ── */}
        {selectedIssue && (
          <div style={{
            background: 'rgba(244,162,97,0.07)',
            border: '1px solid rgba(244,162,97,0.2)',
            borderRadius: 12,
            padding: '12px 16px',
            animation: 'fadeIn 0.2s ease both',
          }}>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Responsible Authority
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)' }}>
              {authority || selectedIssue.authority}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 7px' }}>
                Ref: {selectedIssue.irc}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 7px' }}>
                Category: {selectedIssue.id.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* ── Severity ── */}
        <div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Severity
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['low', 'medium', 'high', 'critical'] as const).map((s) => (
              <button
                key={s}
                id={`severity-${s}`}
                onClick={() => setSeverity(s)}
                aria-pressed={severity === s}
                style={{
                  flex: 1, padding: '10px 4px',
                  borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${severity === s ? SEVERITY_COLORS[s] : 'rgba(255,255,255,0.08)'}`,
                  background: severity === s ? `${SEVERITY_COLORS[s]}18` : 'transparent',
                  color: severity === s ? SEVERITY_COLORS[s] : 'var(--color-text-muted)',
                  fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s ease',
                  textTransform: 'capitalize',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── GPS location ── */}
        <div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Location
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="qr-gps-input"
              readOnly
              placeholder="Tap GPS to capture location"
              value={gps}
              aria-label="GPS coordinates"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '10px 14px',
                color: gps ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                fontSize: '12px',
                fontFamily: 'var(--font-display)',
              }}
            />
            <button
              id="qr-gps-btn"
              onClick={captureGPS}
              aria-label="Capture GPS location"
              disabled={gpsLoading}
              style={{
                padding: '10px 16px',
                background: gps ? 'rgba(82,183,136,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${gps ? 'rgba(82,183,136,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10,
                color: gps ? '#52b788' : 'var(--color-text-secondary)',
                fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap', fontFamily: 'var(--font-body)',
              }}
            >
              {gpsLoading ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
                </svg>
              )}
              Use GPS
            </button>
          </div>
        </div>

        {/* \u2500\u2500 Submit button (visual only \u2014 no action) \u2500\u2500 */}
        <button
          id="qr-submit-btn"
          onClick={() => {/* visual only */}}
          style={{
            width: '100%', padding: '16px',
            background: selected
              ? 'linear-gradient(135deg, #f4a261 0%, #e76f51 100%)'
              : 'rgba(255,255,255,0.06)',
            border: `1.5px solid ${selected ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 14,
            color: selected ? '#fff' : 'var(--color-text-muted)',
            fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s ease',
            boxShadow: selected ? '0 4px 20px rgba(244,162,97,0.35)' : 'none',
            letterSpacing: '0.01em',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          {selected
            ? `Send to ${selectedIssue?.authority.split('/')[0].trim()}`
            : 'Select an issue type above'}
        </button>

      </div>
    </div>
  );
}

// ── Main MapView ──────────────────────────────────────────────────────────────
export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);

  const mapCenter  = useAppStore((s) => s.mapCenter);
  const mapZoom    = useAppStore((s) => s.mapZoom);
  const offlineMode = useAppStore((s) => s.offlineMode);
  const setActiveTab   = useAppStore((s) => s.setActiveTab);
  const setReportDraft = useAppStore((s) => s.setReportDraft);
  const setMapLoaded   = useAppStore((s) => s.setMapLoaded);

  const [originText,  setOriginText]  = useState('');
  const [destText,    setDestText]    = useState('');
  const [originPlace,  setOriginPlace]  = useState<GeoPlace | null>(null);
  const [destPlace,    setDestPlace]    = useState<GeoPlace | null>(null);

  const [loading,     setLoading]     = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [mapMode,       setMapMode]       = useState<'dark' | 'light'>('dark');
  const [showQuickReport, setShowQuickReport] = useState(false);

  // Auto-zoom helper
  const flyToPlace = useCallback((place: GeoPlace, otherPlace?: GeoPlace | null) => {
    const map = mapRef.current;
    if (!map) return;
    if (otherPlace) {
      // Both points selected — fit bounds to show both
      const bounds = new maplibregl.LngLatBounds(
        [parseFloat(place.lon),      parseFloat(place.lat)],
        [parseFloat(otherPlace.lon), parseFloat(otherPlace.lat)]
      );
      map.fitBounds(bounds, { padding: { top: 200, bottom: 240, left: 80, right: 80 }, duration: 900, maxZoom: 12 });
    } else {
      // Single point — fly to it
      map.flyTo({ center: [parseFloat(place.lon), parseFloat(place.lat)], zoom: 11, duration: 800, essential: true });
    }
  }, []);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: STYLE_DARK,
      center: mapCenter,
      zoom: mapZoom,
      minZoom: 3, maxZoom: 18,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => setMapLoaded(true));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line

  // Switch map style when mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapMode === 'dark' ? STYLE_DARK : STYLE_LIGHT);
  }, [mapMode]);

  // Draw route on map
  const drawRoute = useCallback((segments: RouteSegment[]) => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old route layers/sources
    ['route-0','route-1','route-2','route-3','route-4'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
    if (map.getLayer('route-bg'))  map.removeLayer('route-bg');
    if (map.getSource('route-bg')) map.removeSource('route-bg');
    if (map.getLayer('route-markers')) map.removeLayer('route-markers');
    if (map.getSource('route-markers')) map.removeSource('route-markers');

    // All coords for camera fitting
    const allCoords = segments.flatMap((s) => s.coords);

    // Draw a thick dark shadow/outline under all segments first
    const allGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: allCoords },
      }],
    };
    map.addSource('route-bg', { type: 'geojson', data: allGeoJSON });
    map.addLayer({
      id: 'route-bg', type: 'line', source: 'route-bg',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#000', 'line-width': 12, 'line-opacity': 0.5, 'line-blur': 4 },
    });

    // Draw each segment with its condition colour
    segments.forEach((seg, i) => {
      const sid = `route-${i}`;
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature', properties: { condition: seg.condition },
          geometry: { type: 'LineString', coordinates: seg.coords },
        }],
      };
      map.addSource(sid, { type: 'geojson', data: geojson });
      map.addLayer({
        id: sid, type: 'line', source: sid,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': CONDITION_COLORS[seg.condition],
          'line-width': 6,
          'line-opacity': 0.95,
        },
      });
    });

    // Origin + destination markers
    const startCoord = allCoords[0];
    const endCoord   = allCoords[allCoords.length - 1];

    // Start marker (green)
    const startEl = document.createElement('div');
    startEl.style.cssText = `
      width: 0; height: 0; position: relative; overflow: visible;
    `;
    const startDot = document.createElement('div');
    startDot.style.cssText = `
      position: absolute; top: -12px; left: -12px;
      width: 24px; height: 24px; border-radius: 50%;
      background: #2a9d8f; border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: bold; color: #fff;
    `;
    startDot.textContent = 'A';
    startEl.appendChild(startDot);
    new maplibregl.Marker({ element: startEl, anchor: 'center' })
      .setLngLat(startCoord as [number, number]).addTo(map);

    // End marker (red)
    const endEl = document.createElement('div');
    endEl.style.cssText = 'width: 0; height: 0; position: relative; overflow: visible;';
    const endDot = document.createElement('div');
    endDot.style.cssText = `
      position: absolute; top: -12px; left: -12px;
      width: 24px; height: 24px; border-radius: 50%;
      background: #e63946; border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: bold; color: #fff;
    `;
    endDot.textContent = 'B';
    endEl.appendChild(endDot);
    new maplibregl.Marker({ element: endEl, anchor: 'center' })
      .setLngLat(endCoord as [number, number]).addTo(map);

    // Fit map to route
    const bounds = allCoords.reduce(
      (b, c) => b.extend(c as [number, number]),
      new maplibregl.LngLatBounds(allCoords[0] as [number, number], allCoords[0] as [number, number])
    );
    map.fitBounds(bounds, { padding: { top: 200, bottom: 220, left: 60, right: 60 }, duration: 1000 });
  }, []);

  // Plan route
  const handleGetRoute = async () => {
    if (!originPlace || !destPlace) return;
    setLoading(true);
    setError(null);
    setRouteResult(null);

    try {
      const o = `${originPlace.lon},${originPlace.lat}`;
      const d = `${destPlace.lon},${destPlace.lat}`;
      const res = await fetch(
        `${OSRM_API}/${o};${d}?overview=full&geometries=geojson&steps=true`
      );
      if (!res.ok) throw new Error('Could not find a route between these points.');
      const json = await res.json();

      if (json.code !== 'Ok' || !json.routes?.length) {
        throw new Error('No route found. Try different start/end points.');
      }

      const route = json.routes[0];
      const coords: [number, number][] = route.geometry.coordinates;
      const distance_km  = Math.round(route.distance / 100) / 10;
      const duration_min = Math.round(route.duration / 60);

      // Score each segment
      const [accidentStats, nhProjects] = await Promise.all([
        fetchAccidentStats(), fetchNHProjects(),
      ]);
      const segments = await scoreRoute(coords, accidentStats, nhProjects);

      // Overall risk = weighted average
      const overall_risk = Math.round(
        segments.reduce((s, seg) => s + seg.riskScore, 0) / (segments.length || 1)
      );

      // Unique authorities
      const seenAuthorities = new Set<string>();
      const authorities = segments
        .filter((s) => { const key = s.authority; if (seenAuthorities.has(key)) return false; seenAuthorities.add(key); return true; })
        .map((s) => ({ name: s.authority, ee: s.authorityEE, phone: s.authorityPhone, type: s.riskScore >= 60 ? 'NH' : 'SH' }));

      drawRoute(segments);
      setRouteResult({ distance_km, duration_min, overall_risk, segments, authorities });
    } catch (err: any) {
      setError(err.message ?? 'Route planning failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => {
    setRouteResult(null);
    setOriginText('');
    setDestText('');
    setOriginPlace(null);
    setDestPlace(null);
    const map = mapRef.current;
    if (!map) return;
    // Clean up all route layers
    for (let i = 0; i < 10; i++) {
      const id = `route-${i}`;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }
    if (map.getLayer('route-bg')) map.removeLayer('route-bg');
    if (map.getSource('route-bg')) map.removeSource('route-bg');
    map.flyTo({ center: mapCenter, zoom: mapZoom, duration: 800 });
  };

  const handleReportIssue = () => {
    setShowQuickReport(true);
  };

  // Condition breakdown percentages
  const conditionBreakdown = routeResult ? (() => {
    const total = routeResult.segments.length || 1;
    const counts = { good: 0, fair: 0, poor: 0, critical: 0 };
    routeResult.segments.forEach((s) => { counts[s.condition]++; });
    return Object.entries(counts).map(([k, v]) => ({
      condition: k as keyof typeof CONDITION_COLORS,
      pct: Math.round((v / total) * 100),
    })).filter((x) => x.pct > 0);
  })() : [];

  const overallColor =
    (routeResult?.overall_risk ?? 0) >= 70 ? CONDITION_COLORS.critical :
    (routeResult?.overall_risk ?? 0) >= 50 ? CONDITION_COLORS.poor :
    (routeResult?.overall_risk ?? 0) >= 30 ? CONDITION_COLORS.fair :
    CONDITION_COLORS.good;

  return (
    <div className="map-view">
      {loading && <div className="map-loading-bar" aria-label="Loading route" />}
      {offlineMode && <div className="offline-pill">● Offline</div>}

      {/* Map canvas */}
      <div ref={mapContainerRef} className="map-canvas" />

      {/* ── Route Planner Panel ── */}
      <div className="route-panel" role="search" aria-label="Route planner">
        <div className="route-inputs">
          {/* Origin */}
          <div className="route-input-row">
            <div className="route-dot origin" aria-hidden="true" />
            <PlaceInput
              id="origin-input"
              placeholder="From — e.g. Mandi, Himachal Pradesh"
              color="var(--color-risk-good)"
              value={originText}
              onChange={setOriginText}
              onSelect={(p) => {
                setOriginPlace(p);
                flyToPlace(p, destPlace);
              }}
            />
          </div>

          {/* Dashed connector */}
          <div className="route-input-row" style={{ paddingLeft: '2px' }}>
            <div className="route-connector"><div className="route-connector-line" /></div>
          </div>

          {/* Destination */}
          <div className="route-input-row">
            <div className="route-dot destination" aria-hidden="true" />
            <PlaceInput
              id="dest-input"
              placeholder="To — e.g. Shimla, Himachal Pradesh"
              color="var(--color-risk-critical)"
              value={destText}
              onChange={setDestText}
              onSelect={(p) => {
                setDestPlace(p);
                flyToPlace(p, originPlace);
              }}
            />
          </div>
        </div>

        {/* Dark / Light mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-4) var(--space-3)' }}>
          <div className="condition-legend" aria-label="Road condition key" style={{ padding: 0, border: 'none', background: 'transparent', flex: 1 }}>
            {Object.entries(CONDITION_COLORS).map(([k, c]) => (
              <div key={k} className="condition-legend-item">
                <div className="condition-swatch" style={{ background: c }} />
                {k}
              </div>
            ))}
          </div>
          <button
            id="map-mode-toggle"
            onClick={() => setMapMode((m) => m === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${mapMode === 'dark' ? 'light' : 'dark'} map`}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-pill)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all var(--duration-normal)',
            }}
          >
            {mapMode === 'dark' ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg> Light</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2m-4.22-5.78-1.42 1.42M7.64 16.36l-1.42 1.42M16.36 16.36l1.42 1.42M5.22 7.22 6.64 8.64"/></svg> Dark</>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-danger)', borderTop: '1px solid var(--color-border)' }}>
            ⚠ {error}
          </div>
        )}

        {/* Get Route button */}
        <button
          id="get-route-btn"
          className="route-go-btn"
          onClick={handleGetRoute}
          disabled={!originPlace || !destPlace || loading}
          aria-label="Get route"
        >
          {loading ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Planning route…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Get Route &amp; Road Condition
            </>
          )}
        </button>
      </div>

      {/* ── Route Summary Card ── */}
      {routeResult && (
        <div className="route-summary" aria-label="Route summary">
          <div className="route-summary-header">
            <div>
              <div className="route-summary-title">
                {originText.split(',')[0]} → {destText.split(',')[0]}
              </div>
              <div className="route-summary-meta">
                via Indian road network · OSRM routing
              </div>
            </div>
            <button className="route-clear-btn" onClick={clearRoute} aria-label="Clear route">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Stats */}
          <div className="route-stats">
            <div className="route-stat">
              <div className="route-stat-val" style={{ color: 'var(--color-accent)' }}>
                {routeResult.distance_km}
              </div>
              <div className="route-stat-label">km</div>
            </div>
            <div className="route-stat">
              <div className="route-stat-val" style={{ color: 'var(--color-sh)' }}>
                {routeResult.duration_min}
              </div>
              <div className="route-stat-label">min drive</div>
            </div>
            <div className="route-stat">
              <div className="route-stat-val" style={{ color: overallColor }}>
                {routeResult.overall_risk}
              </div>
              <div className="route-stat-label">risk /100</div>
            </div>
          </div>

          {/* Condition bar */}
          <div className="route-condition-bar">
            <div className="route-condition-label">Road condition along route</div>
            <div className="condition-track" role="progressbar" aria-label="Route condition breakdown">
              {conditionBreakdown.map(({ condition, pct }) => (
                <div key={condition} className="condition-segment"
                  style={{ width: `${pct}%`, background: CONDITION_COLORS[condition] }}
                  title={`${condition}: ${pct}%`}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
              {conditionBreakdown.map(({ condition, pct }) => (
                <span key={condition} style={{ fontSize: '10px', color: CONDITION_COLORS[condition], fontFamily: 'var(--font-display)' }}>
                  {pct}% {condition}
                </span>
              ))}
            </div>
          </div>

          {/* Authorities on route */}
          <div className="route-authorities">
            <div className="route-authorities-label">Authorities responsible on this route</div>
            {routeResult.authorities.map((auth, i) => (
              <div key={i} className="authority-row">
                <span className="authority-badge">{auth.type}</span>
                <div className="authority-detail">
                  <div className="authority-detail-name">{auth.name}</div>
                  <div className="authority-detail-ee">EE: {auth.ee} · {auth.phone}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Report button */}
          <button className="route-report-btn" onClick={handleReportIssue} aria-label="Report a road issue on this route">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Report a Road Issue on This Route
          </button>
        </div>
      )}

      {/* ── Quick Report Sheet ── */}
      {showQuickReport && (
        <>
          {/* Dim backdrop */}
          <div
            onClick={() => setShowQuickReport(false)}
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 49,
              animation: 'fadeIn 0.2s ease both',
            }}
          />
          <QuickReportSheet
            open={showQuickReport}
            onClose={() => setShowQuickReport(false)}
            routeFrom={originText}
            routeTo={destText}
            authority={routeResult?.authorities[0]?.name ?? ''}
          />
        </>
      )}
    </div>
  );
}
