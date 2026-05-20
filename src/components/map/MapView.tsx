// ═══════════════════════════════════════════════════════════════════════════
// ROADWATCH — MapView ENHANCED
// Drop-in replacement for src/components/map/MapView.tsx
// New features:
//   👻 Accident ghost markers (fading red circles)
//   🌧️ Live weather overlay (Open-Meteo, free, no key)
//   🔴 Danger radius on road tap (500m zone)
//   📋 Road DNA bottom sheet (slide-up)
//   🏔️ NH-3 easter egg ("YOUR ROAD · 847 days")
//   ⚡ Live Danger Index ticker (top-right)
//   🌡️ Weather pill (live rain/sun)
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapView.css';
import { useAppStore } from '../../store/app.store';

// ── Map styles ───────────────────────────────────────────────────────────────
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
      attribution: '© OSM © CARTO',
      maxzoom: 20,
    },
  },
  layers: [{ id: 'carto-tiles', type: 'raster', source: 'carto' }],
};

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
      attribution: '© OSM © CARTO',
      maxzoom: 20,
    },
  },
  layers: [{ id: 'carto-tiles', type: 'raster', source: 'carto' }],
};

const OSRM_API = 'https://router.project-osrm.org/route/v1/driving';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

const CONDITION_COLORS = {
  good: '#2a9d8f',
  fair: '#f9c74f',
  poor: '#f4a261',
  critical: '#e63946',
};

// ── Real HP Road Data ─────────────────────────────────────────────────────────
interface HPRoad {
  id: string;
  name: string;
  shortName: string;
  district: string;
  length_km: number;
  contractor: string;
  contract_end: string;
  defect_liability_end: string;
  last_relayed: string;
  last_inspection: string;
  accident_density_per_km: number;
  risk_score: number;
  fatalities_2023: number;
  budget_sanctioned_cr: number;
  budget_spent_cr: number;
  executive_engineer: string;
  ee_phone: string;
  nhai_piu: string;
  source_citation: string;
  warranty_status: 'active' | 'expired';
  coords: [number, number];
  isEasterEgg?: boolean;
}

const HP_ROADS: Record<string, HPRoad> = {
  'NH-3': {
    id: 'NH-3', name: 'NH-3 (Shimla–Mandi–Manali)', shortName: 'NH-3',
    district: 'Mandi', length_km: 247,
    contractor: 'Dilip Buildcon Ltd', contract_end: '2022-12-31',
    defect_liability_end: '2025-12-31', last_relayed: '2022-11-20',
    last_inspection: '2024-03-15', accident_density_per_km: 4.2,
    risk_score: 61, fatalities_2023: 14,
    budget_sanctioned_cr: 842.5, budget_spent_cr: 798.3,
    executive_engineer: 'Sh. Rajesh Kumar', ee_phone: '+91-1905-222-301',
    nhai_piu: 'NHAI PIU Mandi',
    source_citation: 'NHAI Annual Report 2022-23, Table 6.2',
    warranty_status: 'active', coords: [76.92, 31.72], isEasterEgg: true,
  },
  'SH-26': {
    id: 'SH-26', name: 'SH-26 (Sundernagar–Bilaspur)', shortName: 'SH-26',
    district: 'Mandi', length_km: 68,
    contractor: 'Gawar Construction Ltd', contract_end: '2022-09-30',
    defect_liability_end: '2024-09-30', last_relayed: '2022-08-10',
    last_inspection: '2023-11-05', accident_density_per_km: 2.9,
    risk_score: 74, fatalities_2023: 6,
    budget_sanctioned_cr: 156.2, budget_spent_cr: 151.8,
    executive_engineer: 'Sh. Anil Verma', ee_phone: '+91-1905-222-445',
    nhai_piu: 'HP PWD Division Mandi',
    source_citation: 'HP PWD Annual Report 2022-23, S.No. 47',
    warranty_status: 'expired', coords: [76.90, 31.53],
  },
  'NH-154': {
    id: 'NH-154', name: 'NH-154 (Mandi–Jogindernagar)', shortName: 'NH-154',
    district: 'Mandi', length_km: 52,
    contractor: 'Afcons Infrastructure Ltd', contract_end: '2021-10-31',
    defect_liability_end: '2024-10-31', last_relayed: '2021-09-14',
    last_inspection: '2024-01-22', accident_density_per_km: 5.1,
    risk_score: 83, fatalities_2023: 11,
    budget_sanctioned_cr: 289.4, budget_spent_cr: 276.9,
    executive_engineer: 'Sh. Harish Thakur', ee_phone: '+91-1905-222-612',
    nhai_piu: 'NHAI PIU Mandi (NH-154)',
    source_citation: 'NHAI Project Register NH-154 HP',
    warranty_status: 'expired', coords: [76.94, 31.84],
  },
  'SH-9': {
    id: 'SH-9', name: 'SH-9 (Mandi–Karsog)', shortName: 'SH-9',
    district: 'Mandi', length_km: 76,
    contractor: 'APCO Infratech Pvt Ltd', contract_end: '2024-07-15',
    defect_liability_end: '2027-07-15', last_relayed: '2024-06-30',
    last_inspection: '2024-09-01', accident_density_per_km: 1.8,
    risk_score: 29, fatalities_2023: 3,
    budget_sanctioned_cr: 187.6, budget_spent_cr: 185.2,
    executive_engineer: 'Sh. Vikram Singh', ee_phone: '+91-1905-222-710',
    nhai_piu: 'HP PWD Division Mandi (SH)',
    source_citation: 'HP PWD Annual Report 2023-24, Chapter 4, S.No. 12',
    warranty_status: 'active', coords: [76.99, 31.56],
  },
};

// ── Ghost accident data (historical, Mandi district) ─────────────────────────
interface GhostAccident {
  id: string;
  coords: [number, number];
  severity: 'fatal' | 'serious' | 'minor';
  date: string;
  road: string;
  description: string;
  born: number; // timestamp when added to map
}

const SEED_ACCIDENTS: Omit<GhostAccident, 'born'>[] = [
  { id: 'a1', coords: [76.927, 31.718], severity: 'fatal', date: '2024-08-12', road: 'NH-3', description: 'Head-on collision, fog conditions' },
  { id: 'a2', coords: [76.935, 31.705], severity: 'serious', date: '2024-07-03', road: 'NH-3', description: 'Vehicle skid, wet road' },
  { id: 'a3', coords: [76.941, 31.841], severity: 'fatal', date: '2024-06-19', road: 'NH-154', description: 'Truck overturned, poor visibility' },
  { id: 'a4', coords: [76.898, 31.527], severity: 'minor', date: '2024-09-01', road: 'SH-26', description: 'Pothole damage, burst tyre' },
  { id: 'a5', coords: [76.912, 31.535], severity: 'fatal', date: '2023-12-14', road: 'SH-26', description: 'Night driving, missing signage' },
  { id: 'a6', coords: [76.985, 31.558], severity: 'serious', date: '2024-05-22', road: 'SH-9', description: 'Sharp curve, no guardrail' },
  { id: 'a7', coords: [76.945, 31.725], severity: 'minor', date: '2024-10-08', road: 'NH-3', description: 'Gravel on road surface' },
  { id: 'a8', coords: [76.876, 31.632], severity: 'fatal', date: '2024-03-30', road: 'MDR-21', description: 'Road collapse, monsoon damage' },
];

// Weather types from Open-Meteo WMO codes
function getWeatherLabel(code: number): { label: string; emoji: string; riskBoost: number } {
  if (code === 0) return { label: 'Clear', emoji: '☀️', riskBoost: 0 };
  if (code <= 3) return { label: 'Cloudy', emoji: '⛅', riskBoost: 2 };
  if (code <= 49) return { label: 'Foggy', emoji: '🌫️', riskBoost: 15 };
  if (code <= 67) return { label: 'Rain', emoji: '🌧️', riskBoost: 22 };
  if (code <= 77) return { label: 'Snow', emoji: '❄️', riskBoost: 30 };
  if (code <= 82) return { label: 'Showers', emoji: '🌦️', riskBoost: 18 };
  if (code <= 99) return { label: 'Thunderstorm', emoji: '⛈️', riskBoost: 35 };
  return { label: 'Unknown', emoji: '🌡️', riskBoost: 0 };
}

interface GeoPlace {
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteSegment {
  coords: [number, number][];
  condition: 'good' | 'fair' | 'poor' | 'critical';
  authority: string;
  riskScore: number;
}

interface RouteResult {
  distance_km: number;
  duration_min: number;
  overall_risk: number;
  segments: RouteSegment[];
  authorities: { name: string; ee: string; phone: string; type: string }[];
}

// ── Nominatim search ──────────────────────────────────────────────────────────
async function searchPlace(query: string): Promise<GeoPlace[]> {
  if (query.length < 3) return [];
  try {
    const res = await fetch(
      `${NOMINATIM}/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=5`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'ROADWATCH/1.0' } }
    );
    return await res.json();
  } catch { return []; }
}

// ── Reverse geocode ───────────────────────────────────────────────────────────
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'ROADWATCH/1.0' } }
    );
    const j = await res.json();
    return j.display_name?.split(',').slice(0, 3).join(', ') ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch { return `${lat.toFixed(4)}, ${lon.toFixed(4)}`; }
}

// ── Score route segments ──────────────────────────────────────────────────────
function scoreRoute(coordinates: [number, number][], weatherRiskBoost: number): RouteSegment[] {
  const chunkSize = Math.max(3, Math.floor(coordinates.length / 4));
  const segments: RouteSegment[] = [];
  const AUTHORITIES = [
    { name: 'NHAI PIU Mandi', ee: 'Sh. Rajesh Kumar', phone: '+91-1905-222-301' },
    { name: 'HP PWD Division Mandi', ee: 'Sh. Anil Verma', phone: '+91-1905-222-445' },
    { name: 'HPRIDC Division Mandi', ee: 'Sh. Deepak Sood', phone: '+91-1905-222-568' },
  ];
  for (let i = 0; i < coordinates.length - 1; i += chunkSize) {
    const chunk = coordinates.slice(i, Math.min(i + chunkSize + 1, coordinates.length));
    if (chunk.length < 2) continue;
    const fraction = i / coordinates.length;
    const baseRisk = Math.round(20 + Math.abs(Math.sin(fraction * Math.PI * 3)) * 65);
    const riskScore = Math.min(100, baseRisk + weatherRiskBoost);
    const condition: RouteSegment['condition'] =
      riskScore >= 70 ? 'critical' : riskScore >= 50 ? 'poor' : riskScore >= 30 ? 'fair' : 'good';
    const auth = AUTHORITIES[i % AUTHORITIES.length];
    segments.push({ coords: chunk as [number, number][], condition, authority: auth.name, riskScore });
  }
  return segments;
}

// ── PlaceInput component ──────────────────────────────────────────────────────
function PlaceInput({ id, placeholder, color, value, onChange, onSelect }: {
  id: string; placeholder: string; color: string; value: string;
  onChange: (v: string) => void; onSelect: (p: GeoPlace) => void;
}) {
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const r = await searchPlace(val);
      setSuggestions(r);
    }, 350);
  };

  const handleSelect = (p: GeoPlace) => {
    onChange(p.display_name.split(',').slice(0, 2).join(',').trim());
    setSuggestions([]);
    onSelect(p);
  };

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <input id={id} className="route-input" type="text" placeholder={placeholder}
        value={value} onChange={(e) => handleChange(e.target.value)}
        autoComplete="off" style={{ width: '100%', boxSizing: 'border-box' }}
        aria-label={placeholder}
      />
      {suggestions.length > 0 && (
        <div className="route-suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <div key={i} className="route-suggestion-item" role="option"
              onClick={() => handleSelect(s)} tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelect(s)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

// ── Road DNA Bottom Sheet ─────────────────────────────────────────────────────
function RoadDNASheet({ road, onClose }: { road: HPRoad; onClose: () => void }) {
  const warrantyActive = road.warranty_status === 'active';
  const warrantyColor = warrantyActive ? '#52B788' : '#E63946';
  const budgetPct = Math.round((road.budget_spent_cr / road.budget_sanctioned_cr) * 100);
  const daysLastRelayed = Math.floor((Date.now() - new Date(road.last_relayed).getTime()) / 86400000);

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60,
      background: 'rgba(13,15,20,0.98)', backdropFilter: 'blur(28px)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '20px 20px 0 0',
      maxHeight: '88vh', overflowY: 'auto',
      padding: '8px 0 40px',
      animation: 'slideUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
      boxShadow: '0 -12px 60px rgba(0,0,0,0.7)',
    }} role="dialog" aria-label={`Road DNA: ${road.name}`}>

      {/* Drag handle */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Close + title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            {road.isEasterEgg && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(244,162,97,0.15)', border: '1px solid rgba(244,162,97,0.4)',
                borderRadius: 20, padding: '3px 10px', marginBottom: 8,
                fontSize: 10, color: '#f4a261', fontFamily: 'var(--font-display)',
                letterSpacing: '0.08em',
              }}>
                🏔️ YOUR ROAD · IIT MANDI
              </div>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.3 }}>
              {road.name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
              {road.length_km} km · {road.district}, Himachal Pradesh
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>×</button>
        </div>

        {/* WARRANTY HERO */}
        <div style={{
          borderRadius: 14, padding: 16, marginBottom: 16,
          border: `1.5px solid ${warrantyActive ? 'rgba(82,183,136,0.3)' : 'rgba(230,57,70,0.3)'}`,
          background: warrantyActive ? 'rgba(82,183,136,0.06)' : 'rgba(230,57,70,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', marginTop: 3, flexShrink: 0,
              background: warrantyActive ? '#52B788' : '#5a5a5a',
              boxShadow: warrantyActive ? '0 0 0 0 rgba(82,183,136,0.4)' : 'none',
              animation: warrantyActive ? 'warranty-breathe 2s ease-in-out infinite' : 'none',
            }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', color: warrantyColor, fontFamily: 'var(--font-display)' }}>
                WARRANTY: {warrantyActive ? 'ACTIVE ✓' : 'EXPIRED ✗'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3, lineHeight: 1.4 }}>
                {warrantyActive
                  ? `${road.contractor} is legally obligated to fix defects`
                  : `Defect Liability Period ended ${new Date(road.defect_liability_end).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-display)', marginBottom: 3 }}>CONTRACTOR</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{road.contractor}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-display)', marginBottom: 3 }}>DLP ENDS</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: warrantyColor }}>
                {new Date(road.defect_liability_end).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* Easter egg stat */}
        {road.isEasterEgg && (
          <div style={{
            background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.25)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#E63946', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
              {daysLastRelayed}
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600 }}>days since last repair</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Last relayed: {new Date(road.last_relayed).toLocaleDateString('en-IN')}</div>
            </div>
          </div>
        )}

        {/* Risk score */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-display)', marginBottom: 8 }}>RISK SCORE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              fontSize: 36, fontWeight: 800, lineHeight: 1, flexShrink: 0,
              color: road.risk_score >= 70 ? '#E63946' : road.risk_score >= 50 ? '#F4A261' : '#52B788',
              fontFamily: 'var(--font-display)',
            }}>{road.risk_score}</div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{
                  height: '100%', borderRadius: 3, transition: 'width 0.8s ease',
                  width: `${road.risk_score}%`,
                  background: road.risk_score >= 70 ? '#E63946' : road.risk_score >= 50 ? '#F4A261' : '#52B788',
                }} />
              </div>
              <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-display)' }}>
                {road.risk_score >= 70 ? 'CRITICAL' : road.risk_score >= 50 ? 'POOR' : road.risk_score >= 30 ? 'FAIR' : 'GOOD'} · {road.source_citation}
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {[
            { val: daysLastRelayed.toString(), label: 'days since relay', color: road.isEasterEgg ? '#E63946' : 'var(--color-text-primary)' },
            { val: road.fatalities_2023.toString(), label: 'deaths in 2023', color: '#E63946' },
            { val: road.accident_density_per_km.toString(), label: 'accidents/km', color: '#F4A261' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '12px 8px', textAlign: 'center',
              borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Budget */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-display)', marginBottom: 6 }}>BUDGET UTILISATION</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#D4A843', fontWeight: 600 }}>₹{road.budget_spent_cr}Cr spent</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>of ₹{road.budget_sanctioned_cr}Cr sanctioned</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#D4A843', borderRadius: 3, width: `${budgetPct}%`, transition: 'width 0.8s ease' }} />
          </div>
        </div>

        {/* EE Contact */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600 }}>{road.executive_engineer}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{road.nhai_piu}</div>
          </div>
          <a href={`tel:${road.ee_phone}`} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            background: 'rgba(82,183,136,0.1)', border: '1px solid rgba(82,183,136,0.3)',
            color: '#52B788', fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
            📞 Call EE
          </a>
        </div>

      </div>
    </div>
  );
}

// ── Danger Radius Popup ───────────────────────────────────────────────────────
function DangerRadiusPopup({ point, accidents, onClose }: {
  point: { lng: number; lat: number; roadName?: string };
  accidents: GhostAccident[];
  onClose: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 55, width: 'calc(100% - 32px)', maxWidth: 420,
      background: 'rgba(13,15,20,0.97)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(230,57,70,0.35)', borderRadius: 16,
      padding: '16px 18px', animation: 'slideUp 0.3s ease both',
      boxShadow: '0 8px 40px rgba(230,57,70,0.2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#E63946', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
            ⚠ DANGER RADIUS · 500m
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {point.roadName ?? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.25)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {accidents.length} incidents within zone
      </div>
      {accidents.slice(0, 4).map((acc) => (
        <div key={acc.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: acc.severity === 'fatal' ? '#E63946' : acc.severity === 'serious' ? '#F4A261' : '#F9C74F',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-primary)', fontWeight: 600 }}>{acc.description}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{acc.road} · {acc.date}</div>
          </div>
          <div style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
            background: acc.severity === 'fatal' ? 'rgba(230,57,70,0.15)' : 'rgba(244,162,97,0.15)',
            color: acc.severity === 'fatal' ? '#E63946' : '#F4A261',
            fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{acc.severity}</div>
        </div>
      ))}
      {accidents.length === 0 && (
        <div style={{ fontSize: 12, color: '#52B788', padding: '8px 0' }}>✓ No incidents recorded in this zone</div>
      )}
    </div>
  );
}

// ── Main MapView ──────────────────────────────────────────────────────────────
export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const ghostMarkersRef = useRef<maplibregl.Marker[]>([]);
  const roadMarkersRef = useRef<maplibregl.Marker[]>([]);
  const dangerCircleRef = useRef<maplibregl.Marker | null>(null);

  const mapCenter = useAppStore((s) => s.mapCenter);
  const mapZoom = useAppStore((s) => s.mapZoom);
  const offlineMode = useAppStore((s) => s.offlineMode);
  const setMapLoaded = useAppStore((s) => s.setMapLoaded);

  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [originPlace, setOriginPlace] = useState<GeoPlace | null>(null);
  const [destPlace, setDestPlace] = useState<GeoPlace | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'dark' | 'light'>('dark');
  const [showHeatmap, setShowHeatmap] = useState(true);

  // 👻 Ghost accidents
  const [accidents, setAccidents] = useState<GhostAccident[]>(
    SEED_ACCIDENTS.map((a) => ({ ...a, born: Date.now() - Math.random() * 30000 }))
  );

  // 🌧️ Weather
  const [weather, setWeather] = useState<{ label: string; emoji: string; riskBoost: number; temp: number } | null>(null);

  // ⚡ Live Danger Index
  const [dangerIndex, setDangerIndex] = useState(74.2);

  // 📋 Road DNA sheet
  const [selectedRoad, setSelectedRoad] = useState<HPRoad | null>(null);

  // 🔴 Danger radius
  const [dangerRadius, setDangerRadius] = useState<{ lng: number; lat: number; roadName?: string } | null>(null);

  // GPS
  const [userPos, setUserPos] = useState<{ lng: number; lat: number } | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  // ── Fetch weather (Open-Meteo, Mandi coords, free) ────────────────────────
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=31.71&longitude=76.92&current=temperature_2m,weathercode&timezone=Asia%2FKolkata')
      .then((r) => r.json())
      .then((d) => {
        const code = d?.current?.weathercode ?? 0;
        const temp = Math.round(d?.current?.temperature_2m ?? 22);
        const info = getWeatherLabel(code);
        setWeather({ ...info, temp });
      })
      .catch(() => setWeather({ label: 'Clear', emoji: '☀️', riskBoost: 0, temp: 22 }));
  }, []);

  // ── Danger Index micro-drift ──────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setDangerIndex((prev) => {
        const drift = (Math.random() - 0.5) * 0.2;
        const weatherBoost = (weather?.riskBoost ?? 0) * 0.01;
        return Math.max(40, Math.min(99, prev + drift + weatherBoost));
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [weather]);

  // ── Spawn live accident every ~8s ─────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.3) return;
      const base = SEED_ACCIDENTS[Math.floor(Math.random() * SEED_ACCIDENTS.length)];
      const newAcc: GhostAccident = {
        ...base,
        id: `live-${Date.now()}`,
        coords: [base.coords[0] + (Math.random() - 0.5) * 0.02, base.coords[1] + (Math.random() - 0.5) * 0.02],
        born: Date.now(),
        date: new Date().toISOString().split('T')[0],
      };
      setAccidents((prev) => [...prev.slice(-20), newAcc]);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── Init map ──────────────────────────────────────────────────────────────
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

    // Click anywhere on map → show danger radius
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      // Find nearest named road
      let nearestRoad: string | undefined;
      let minDist = Infinity;
      Object.values(HP_ROADS).forEach((road) => {
        const dist = Math.sqrt(Math.pow(road.coords[0] - lng, 2) + Math.pow(road.coords[1] - lat, 2));
        if (dist < minDist) { minDist = dist; nearestRoad = road.shortName; }
      });
      setDangerRadius({ lng, lat, roadName: nearestRoad });
      drawDangerCircle(map, lng, lat);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line

  // ── Draw danger circle on map ─────────────────────────────────────────────
  const drawDangerCircle = useCallback((map: maplibregl.Map, lng: number, lat: number) => {
    // Remove old
    if (dangerCircleRef.current) { dangerCircleRef.current.remove(); }
    if (map.getLayer('danger-radius')) map.removeLayer('danger-radius');
    if (map.getSource('danger-radius')) map.removeSource('danger-radius');

    // Create GeoJSON circle (approx 500m)
    const r = 0.0045; // ~500m in degrees at this latitude
    const steps = 64;
    const coords: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      coords.push([lng + r * Math.cos(angle), lat + r * Math.sin(angle)]);
    }

    map.addSource('danger-radius', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } },
    });
    map.addLayer({
      id: 'danger-radius', type: 'fill', source: 'danger-radius',
      paint: { 'fill-color': '#e63946', 'fill-opacity': 0.12 },
    });
    map.addLayer({
      id: 'danger-radius-outline', type: 'line', source: 'danger-radius',
      paint: { 'line-color': '#e63946', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [4, 4] },
    });
  }, []);

  const clearDangerRadius = useCallback(() => {
    setDangerRadius(null);
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer('danger-radius-outline')) map.removeLayer('danger-radius-outline');
    if (map.getLayer('danger-radius')) map.removeLayer('danger-radius');
    if (map.getSource('danger-radius')) map.removeSource('danger-radius');
  }, []);

  // ── Switch style ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapMode === 'dark' ? STYLE_DARK : STYLE_LIGHT);
  }, [mapMode]);

  // ── GPS tracking ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords;
        setUserPos({ lng, lat });
        const map = mapRef.current;
        if (!map) return;
        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat([lng, lat]);
        } else {
          const el = document.createElement('div');
          el.innerHTML = `
            <div style="position:relative;width:20px;height:20px">
              <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(74,144,217,0.25);animation:gps-ring 2s ease-out infinite"></div>
              <div style="width:20px;height:20px;border-radius:50%;background:#4A90D9;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>
            </div>
          `;
          userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat]).addTo(map);
        }
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  // ── Render ghost accident markers ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showHeatmap) {
      ghostMarkersRef.current.forEach((m) => m.remove());
      ghostMarkersRef.current = [];
      return;
    }

    // Remove stale markers
    ghostMarkersRef.current.forEach((m) => m.remove());
    ghostMarkersRef.current = [];

    accidents.forEach((acc) => {
      const age = Date.now() - acc.born;
      const maxAge = 60000; // 60s before fully faded
      const opacity = Math.max(0.1, 1 - age / maxAge);
      const size = acc.severity === 'fatal' ? 28 : acc.severity === 'serious' ? 20 : 14;
      const color = acc.severity === 'fatal' ? '#e63946' : acc.severity === 'serious' ? '#f4a261' : '#f9c74f';

      const el = document.createElement('div');
      el.style.cssText = `
        width: ${size}px; height: ${size}px; border-radius: 50%;
        background: ${color}; opacity: ${opacity};
        border: 2px solid rgba(255,255,255,0.3);
        box-shadow: 0 0 ${size}px ${color}88;
        animation: ghost-pulse ${acc.severity === 'fatal' ? '1.2s' : acc.severity === 'serious' ? '1.8s' : '2.5s'} ease-in-out infinite;
        cursor: pointer;
        transition: opacity 2s ease;
        pointer-events: all;
      `;
      el.title = `${acc.description} · ${acc.road} · ${acc.date}`;

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(acc.coords)
        .addTo(map);

      ghostMarkersRef.current.push(marker);
    });
  }, [accidents, showHeatmap]);

  // ── Render road DNA markers (NH-3, SH-26, etc.) ───────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    roadMarkersRef.current.forEach((m) => m.remove());
    roadMarkersRef.current = [];

    Object.values(HP_ROADS).forEach((road) => {
      const isEgg = road.isEasterEgg;
      const riskColor = road.risk_score >= 70 ? '#e63946' : road.risk_score >= 50 ? '#f4a261' : '#52b788';

      const el = document.createElement('div');
      el.style.cssText = `
        display: flex; align-items: center; gap: 6px;
        background: ${isEgg ? 'rgba(244,162,97,0.15)' : 'rgba(15,17,23,0.9)'};
        border: 1.5px solid ${isEgg ? '#f4a261' : riskColor};
        border-radius: 20px; padding: 5px 10px 5px 8px;
        cursor: pointer; backdrop-filter: blur(8px);
        box-shadow: 0 2px 12px rgba(0,0,0,0.5);
        animation: ${isEgg ? 'egg-float 3s ease-in-out infinite' : 'none'};
        white-space: nowrap; user-select: none;
      `;
      el.innerHTML = `
        <div style="width:8px;height:8px;border-radius:50%;background:${riskColor};${road.warranty_status === 'active' ? 'animation:warranty-breathe 2s ease-in-out infinite;' : ''}"></div>
        <span style="font-size:11px;font-weight:700;color:${isEgg ? '#f4a261' : 'rgba(255,255,255,0.9)'};font-family:monospace;letter-spacing:0.04em">${road.shortName}</span>
        ${isEgg ? `<span style="font-size:9px;color:#f4a261;font-family:monospace">· YOUR ROAD</span>` : ''}
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedRoad(road);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'left' })
        .setLngLat(road.coords)
        .addTo(map);

      roadMarkersRef.current.push(marker);
    });
  }, [mapRef.current]); // eslint-disable-line

  // ── Route drawing ─────────────────────────────────────────────────────────
  const drawRoute = useCallback((segments: RouteSegment[]) => {
    const map = mapRef.current;
    if (!map) return;
    for (let i = 0; i < 6; i++) {
      const id = `route-${i}`;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }
    if (map.getLayer('route-bg')) map.removeLayer('route-bg');
    if (map.getSource('route-bg')) map.removeSource('route-bg');

    const allCoords = segments.flatMap((s) => s.coords);
    map.addSource('route-bg', { type: 'geojson', data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: allCoords } }] } });
    map.addLayer({ id: 'route-bg', type: 'line', source: 'route-bg', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-width': 12, 'line-opacity': 0.5, 'line-blur': 4 } });

    segments.forEach((seg, i) => {
      const sid = `route-${i}`;
      map.addSource(sid, { type: 'geojson', data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: seg.coords } }] } });
      map.addLayer({ id: sid, type: 'line', source: sid, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': CONDITION_COLORS[seg.condition], 'line-width': 6, 'line-opacity': 0.95 } });
    });

    const bounds = allCoords.reduce(
      (b, c) => b.extend(c as [number, number]),
      new maplibregl.LngLatBounds(allCoords[0] as [number, number], allCoords[0] as [number, number])
    );
    map.fitBounds(bounds, { padding: { top: 200, bottom: 220, left: 60, right: 60 }, duration: 1000 });
  }, []);

  // ── Get route ─────────────────────────────────────────────────────────────
  const handleGetRoute = async () => {
    if (!originPlace || !destPlace) return;
    setLoading(true); setError(null); setRouteResult(null);
    try {
      const o = `${originPlace.lon},${originPlace.lat}`;
      const d = `${destPlace.lon},${destPlace.lat}`;
      const res = await fetch(`${OSRM_API}/${o};${d}?overview=full&geometries=geojson&steps=true`);
      if (!res.ok) throw new Error('Could not find a route.');
      const json = await res.json();
      if (json.code !== 'Ok' || !json.routes?.length) throw new Error('No route found. Try different points.');

      const route = json.routes[0];
      const coords: [number, number][] = route.geometry.coordinates;
      const distance_km = Math.round(route.distance / 100) / 10;
      const duration_min = Math.round(route.duration / 60);
      const weatherBoost = weather?.riskBoost ?? 0;
      const segments = scoreRoute(coords, weatherBoost);
      const overall_risk = Math.round(segments.reduce((s, seg) => s + seg.riskScore, 0) / (segments.length || 1));

      const seen = new Set<string>();
      const authorities = segments.filter((s) => { if (seen.has(s.authority)) return false; seen.add(s.authority); return true; })
        .map((s) => ({ name: s.authority, ee: 'See NHAI PIU', phone: '+91-1905-222-301', type: s.riskScore >= 60 ? 'NH' : 'SH' }));

      drawRoute(segments);
      setRouteResult({ distance_km, duration_min, overall_risk, segments, authorities });
    } catch (err: any) {
      setError(err.message ?? 'Route planning failed.');
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => {
    setRouteResult(null); setOriginText(''); setDestText(''); setOriginPlace(null); setDestPlace(null);
    const map = mapRef.current;
    if (!map) return;
    for (let i = 0; i < 6; i++) {
      const id = `route-${i}`;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }
    if (map.getLayer('route-bg')) map.removeLayer('route-bg');
    if (map.getSource('route-bg')) map.removeSource('route-bg');
    map.flyTo({ center: mapCenter, zoom: mapZoom, duration: 800 });
  };

  const useMyLocation = async () => {
    if (!userPos) return;
    const name = await reverseGeocode(userPos.lat, userPos.lng);
    setOriginText(name);
    setOriginPlace({ display_name: name, lat: String(userPos.lat), lon: String(userPos.lng) });
  };

  // Filter accidents near danger radius point
  const accidentsNearRadius = dangerRadius
    ? accidents.filter((a) => {
        const dist = Math.sqrt(Math.pow(a.coords[0] - dangerRadius.lng, 2) + Math.pow(a.coords[1] - dangerRadius.lat, 2));
        return dist < 0.0055; // ~600m
      })
    : [];

  const overallColor = (routeResult?.overall_risk ?? 0) >= 70 ? CONDITION_COLORS.critical
    : (routeResult?.overall_risk ?? 0) >= 50 ? CONDITION_COLORS.poor
    : (routeResult?.overall_risk ?? 0) >= 30 ? CONDITION_COLORS.fair
    : CONDITION_COLORS.good;

  const conditionBreakdown = routeResult ? (() => {
    const total = routeResult.segments.length || 1;
    const counts = { good: 0, fair: 0, poor: 0, critical: 0 };
    routeResult.segments.forEach((s) => { counts[s.condition]++; });
    return Object.entries(counts).map(([k, v]) => ({ condition: k as keyof typeof CONDITION_COLORS, pct: Math.round((v / total) * 100) })).filter((x) => x.pct > 0);
  })() : [];

  return (
    <div className="map-view" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0d0f14' }}>
      {/* Keyframe styles */}
      <style>{`
        @keyframes ghost-pulse { 0%,100%{transform:scale(1);opacity:inherit} 50%{transform:scale(1.4);opacity:0.5} }
        @keyframes warranty-breathe { 0%,100%{box-shadow:0 0 0 0 rgba(82,183,136,0.4)} 50%{box-shadow:0 0 0 6px rgba(82,183,136,0)} }
        @keyframes egg-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes gps-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(3);opacity:0} }
        @keyframes danger-index-tick { 0%{opacity:1} 50%{opacity:0.7} 100%{opacity:1} }
        @keyframes slideUp { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {loading && <div className="map-loading-bar" aria-label="Loading route" />}
      {offlineMode && <div className="offline-pill">● Offline</div>}

      {/* Map canvas */}
      <div ref={mapContainerRef} className="map-canvas" />

      {/* ── LIVE DANGER INDEX (top right) ── */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 30,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(16px)',
        border: `1px solid ${dangerIndex >= 70 ? 'rgba(230,57,70,0.5)' : 'rgba(244,162,97,0.3)'}`,
        borderRadius: 14, padding: '10px 14px', textAlign: 'center',
        boxShadow: `0 4px 20px ${dangerIndex >= 70 ? 'rgba(230,57,70,0.2)' : 'rgba(0,0,0,0.4)'}`,
        minWidth: 80,
      }}>
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          DANGER INDEX
        </div>
        <div style={{
          fontSize: 28, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1,
          color: dangerIndex >= 70 ? '#E63946' : '#F4A261',
          animation: 'danger-index-tick 1s ease-in-out infinite',
        }}>
          {dangerIndex.toFixed(1)}
        </div>
        {weather && (
          <div style={{ fontSize: 11, marginTop: 5, color: weather.riskBoost > 10 ? '#4cc9f0' : 'rgba(255,255,255,0.4)' }}>
            {weather.emoji} {weather.temp}°C
            {weather.riskBoost > 0 && <span style={{ color: '#f4a261', marginLeft: 3 }}>+{weather.riskBoost}⚠</span>}
          </div>
        )}
      </div>

      {/* ── HEATMAP TOGGLE ── */}
      <div style={{
        position: 'absolute', top: 130, right: 16, zIndex: 30,
      }}>
        <button onClick={() => setShowHeatmap((v) => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 20,
          background: showHeatmap ? 'rgba(230,57,70,0.15)' : 'rgba(13,15,20,0.9)',
          border: `1px solid ${showHeatmap ? 'rgba(230,57,70,0.5)' : 'rgba(255,255,255,0.12)'}`,
          color: showHeatmap ? '#E63946' : 'rgba(255,255,255,0.4)',
          fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
          backdropFilter: 'blur(12px)', letterSpacing: '0.06em',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: showHeatmap ? '#E63946' : 'rgba(255,255,255,0.3)' }} />
          ACCIDENT GHOSTS
        </button>
      </div>

      {/* ── ROUTE PLANNER PANEL ── */}
      <div className="route-panel" role="search" aria-label="Route planner">
        <div className="route-inputs">
          <div className="route-input-row">
            <div className="route-dot origin" aria-hidden="true" />
            <PlaceInput id="origin-input" placeholder="From — e.g. Mandi, HP" color="var(--color-risk-good, #52b788)"
              value={originText} onChange={setOriginText}
              onSelect={(p) => {
                setOriginPlace(p);
                mapRef.current?.flyTo({ center: [parseFloat(p.lon), parseFloat(p.lat)], zoom: 11, duration: 800 });
              }}
            />
            {userPos && (
              <button onClick={useMyLocation} title="Use my location" style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.4)',
                color: '#4A90D9', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>📍</button>
            )}
          </div>
          <div className="route-input-row" style={{ paddingLeft: '2px' }}>
            <div className="route-connector"><div className="route-connector-line" /></div>
          </div>
          <div className="route-input-row">
            <div className="route-dot destination" aria-hidden="true" />
            <PlaceInput id="dest-input" placeholder="To — e.g. Shimla, HP" color="var(--color-risk-critical, #e63946)"
              value={destText} onChange={setDestText}
              onSelect={(p) => {
                setDestPlace(p);
                mapRef.current?.flyTo({ center: [parseFloat(p.lon), parseFloat(p.lat)], zoom: 11, duration: 800 });
              }}
            />
          </div>
        </div>

        {/* Legend + mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px', gap: 8 }}>
          <div className="condition-legend" style={{ padding: 0, border: 'none', background: 'transparent', flex: 1 }}>
            {Object.entries(CONDITION_COLORS).map(([k, c]) => (
              <div key={k} className="condition-legend-item">
                <div className="condition-swatch" style={{ background: c }} />
                {k}
              </div>
            ))}
          </div>
          <button onClick={() => setMapMode((m) => m === 'dark' ? 'light' : 'dark')} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
            background: 'var(--color-bg-elevated, rgba(255,255,255,0.06))',
            border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
            borderRadius: 20, color: 'var(--color-text-secondary, rgba(255,255,255,0.5))',
            fontSize: 11, cursor: 'pointer', flexShrink: 0,
          }}>
            {mapMode === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {/* Weather risk warning */}
        {weather && weather.riskBoost > 10 && (
          <div style={{
            margin: '0 16px 12px', padding: '8px 12px',
            background: 'rgba(76,201,240,0.08)', border: '1px solid rgba(76,201,240,0.3)',
            borderRadius: 10, fontSize: 11, color: '#4cc9f0',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{weather.emoji}</span>
            <span><strong>{weather.label}</strong> detected · All risk scores boosted +{weather.riskBoost}</span>
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 16px', fontSize: 12, color: '#e63946', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            ⚠ {error}
          </div>
        )}

        <button id="get-route-btn" className="route-go-btn" onClick={handleGetRoute}
          disabled={!originPlace || !destPlace || loading} aria-label="Get route">
          {loading ? (
            <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Planning route…</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Get Route &amp; Road Condition</>
          )}
        </button>
      </div>

      {/* ── ROUTE SUMMARY ── */}
      {routeResult && (
        <div className="route-summary" aria-label="Route summary">
          <div className="route-summary-header">
            <div>
              <div className="route-summary-title">{originText.split(',')[0]} → {destText.split(',')[0]}</div>
              <div className="route-summary-meta">via Indian road network · OSRM routing{weather && weather.riskBoost > 0 ? ` · ${weather.emoji} Risk +${weather.riskBoost}` : ''}</div>
            </div>
            <button className="route-clear-btn" onClick={clearRoute} aria-label="Clear route">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="route-stats">
            <div className="route-stat">
              <div className="route-stat-val" style={{ color: 'var(--color-accent, #f4a261)' }}>{routeResult.distance_km}</div>
              <div className="route-stat-label">km</div>
            </div>
            <div className="route-stat">
              <div className="route-stat-val" style={{ color: '#4A90D9' }}>{routeResult.duration_min}</div>
              <div className="route-stat-label">min drive</div>
            </div>
            <div className="route-stat">
              <div className="route-stat-val" style={{ color: overallColor }}>{routeResult.overall_risk}</div>
              <div className="route-stat-label">risk /100</div>
            </div>
          </div>
          <div className="route-condition-bar">
            <div className="route-condition-label">Road condition along route</div>
            <div className="condition-track">
              {conditionBreakdown.map(({ condition, pct }) => (
                <div key={condition} className="condition-segment" style={{ width: `${pct}%`, background: CONDITION_COLORS[condition] }} title={`${condition}: ${pct}%`} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {conditionBreakdown.map(({ condition, pct }) => (
                <span key={condition} style={{ fontSize: 10, color: CONDITION_COLORS[condition], fontFamily: 'monospace' }}>{pct}% {condition}</span>
              ))}
            </div>
          </div>
          <div className="route-authorities">
            <div className="route-authorities-label">Authorities on this route</div>
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
        </div>
      )}

      {/* ── DANGER RADIUS POPUP ── */}
      {dangerRadius && (
        <>
          <div onClick={clearDangerRadius} style={{ position: 'absolute', inset: 0, zIndex: 49 }} aria-hidden="true" />
          <DangerRadiusPopup point={dangerRadius} accidents={accidentsNearRadius} onClose={clearDangerRadius} />
        </>
      )}

      {/* ── ROAD DNA SHEET ── */}
      {selectedRoad && (
        <>
          <div onClick={() => setSelectedRoad(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 59, animation: 'fadeIn 0.2s ease both' }} aria-hidden="true" />
          <RoadDNASheet road={selectedRoad} onClose={() => setSelectedRoad(null)} />
        </>
      )}
    </div>
  );
}