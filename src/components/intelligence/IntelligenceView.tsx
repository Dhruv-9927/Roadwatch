import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { RISK_FEATURES, computeRiskScore } from '../../lib/risk-scorer';
import type { CountryCode, CountryDataset } from '../../types';
import { useAppStore } from '../../store/app.store';

const css = `
.intel-view { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-5); max-width: 680px; margin: 0 auto; width: 100%; }
.intel-view h1 { font-size: var(--text-xl); color: var(--color-text-primary); margin-bottom: 2px; }
.intel-view > header p { font-size: var(--text-sm); color: var(--color-text-muted); }
.intel-card { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); overflow: hidden; }
.intel-card-header { padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); }
.intel-card-title { font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--color-text-primary); }
.intel-card-sub { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }
.intel-card-body { padding: var(--space-5); }
.country-switcher { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.country-btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-pill); font-size: var(--text-sm); font-family: var(--font-body); border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted); cursor: pointer; transition: all var(--duration-fast); display: flex; align-items: center; gap: var(--space-2); min-height: 40px; }
.country-btn.active { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-glow); }
.country-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin-top: var(--space-4); }
.country-stat { background: var(--color-bg-elevated); border-radius: var(--radius-md); padding: var(--space-3); text-align: center; }
.country-stat-val { font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-accent); }
.country-stat-label { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }
.feature-bar-row { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
.feature-bar-label { width: 180px; font-size: var(--text-xs); color: var(--color-text-secondary); flex-shrink: 0; }
.feature-bar-track { flex: 1; height: 8px; background: var(--color-bg-elevated); border-radius: var(--radius-pill); overflow: hidden; }
.feature-bar-fill { height: 100%; border-radius: var(--radius-pill); background: linear-gradient(90deg, var(--color-sh), var(--color-accent)); transition: width 0.5s var(--ease-out); }
.feature-bar-weight { width: 36px; text-align: right; font-size: var(--text-xs); font-family: var(--font-display); color: var(--color-text-muted); }
.sandbox-sliders { display: flex; flex-direction: column; gap: var(--space-4); }
.slider-row { display: flex; flex-direction: column; gap: var(--space-2); }
.slider-label { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--color-text-secondary); }
.slider-label span:last-child { font-family: var(--font-display); color: var(--color-accent); }
input[type="range"] { width: 100%; accent-color: var(--color-accent); height: 4px; cursor: pointer; }
.risk-output { margin-top: var(--space-5); padding: var(--space-4); background: var(--color-bg-elevated); border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; gap: var(--space-4); }
.risk-output-score { font-family: var(--font-display); font-size: var(--text-3xl); font-weight: var(--weight-bold); line-height: 1; }
.risk-output-label { font-size: var(--text-sm); color: var(--color-text-muted); }
.model-card { font-size: var(--text-sm); color: var(--color-text-secondary); line-height: 1.6; }
.model-card table { width: 100%; border-collapse: collapse; margin-top: var(--space-3); }
.model-card th, .model-card td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border); font-size: var(--text-xs); text-align: left; }
.model-card th { color: var(--color-text-muted); font-family: var(--font-display); }
`;

const COUNTRIES: CountryDataset[] = [
  { code: 'IN', name: 'India',   flag: '🇮🇳', data_url: '', road_count: 6400000, coverage: 'Partial — Mandi, HP seeded' },
  { code: 'KE', name: 'Kenya',   flag: '🇰🇪', data_url: '', road_count: 161451,  coverage: 'OSM — Nairobi + major highways' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', data_url: '', road_count: 195000,  coverage: 'OSM — Lagos + Federal routes' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', data_url: '', road_count: 570000,  coverage: 'OSM — Ho Chi Minh + QL-1' },
];

export default function IntelligenceView() {
  const setActiveCountry = useAppStore((s) => s.setActiveCountry);
  const activeCountry    = useAppStore((s) => s.activeCountry);

  const [years,    setYears]    = useState(4);
  const [accident, setAccident] = useState(5);
  const [budget,   setBudget]   = useState(72);
  const [terrain,  setTerrain]  = useState<'flat' | 'hilly' | 'mountainous'>('hilly');

  const riskResult = computeRiskScore({
    years_since_relaying:  years,
    accident_density:      accident,
    budget_utilization:    budget / 100,
    terrain_type:          terrain,
    road_width:            2,
    traffic_volume_proxy:  0.5,
  });

  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    return () => { document.head.removeChild(styleEl); };
  }, []);

  const countryInfo = COUNTRIES.find((c) => c.code === activeCountry)!;

  return (
    <div className="intel-view">
      <header>
        <h1>Intelligence Layer</h1>
        <p>ML model insights, country-agnostic schema, and live risk simulation</p>
      </header>

      {/* Country Switcher */}
      <div className="intel-card">
        <div className="intel-card-header">
          <div className="intel-card-title">Country Switcher</div>
          <div className="intel-card-sub">RoadDNA schema is country-agnostic · OSM covers every country</div>
        </div>
        <div className="intel-card-body">
          <div className="country-switcher" role="radiogroup" aria-label="Select country">
            {COUNTRIES.map((c) => (
              <button key={c.code} className={`country-btn${activeCountry === c.code ? ' active' : ''}`}
                onClick={() => setActiveCountry(c.code as CountryCode)} role="radio" aria-checked={activeCountry === c.code}>
                {c.flag} {c.name}
              </button>
            ))}
          </div>
          <div className="country-stats">
            <div className="country-stat">
              <div className="country-stat-val">{(countryInfo.road_count / 1000).toFixed(0)}K</div>
              <div className="country-stat-label">Road segments</div>
            </div>
            <div className="country-stat">
              <div className="country-stat-val">OSM</div>
              <div className="country-stat-label">Data source</div>
            </div>
            <div className="country-stat">
              <div className="country-stat-val">{countryInfo.flag}</div>
              <div className="country-stat-label">{countryInfo.coverage}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Importance */}
      <div className="intel-card">
        <div className="intel-card-header">
          <div className="intel-card-title">XGBoost Feature Importance</div>
          <div className="intel-card-sub">Risk model trained on RDD2022 + MoRTH accident correlation</div>
        </div>
        <div className="intel-card-body">
          {RISK_FEATURES.map((f) => (
            <div key={f.name} className="feature-bar-row">
              <div className="feature-bar-label">{f.display}</div>
              <div className="feature-bar-track" role="progressbar" aria-valuenow={Math.round(f.weight * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={f.display}>
                <div className="feature-bar-fill" style={{ width: `${f.weight * 100}%` }} />
              </div>
              <div className="feature-bar-weight">{Math.round(f.weight * 100)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* ML Sandbox */}
      <div className="intel-card">
        <div className="intel-card-header">
          <div className="intel-card-title">Risk Score Sandbox</div>
          <div className="intel-card-sub">Adjust features → see live risk score output</div>
        </div>
        <div className="intel-card-body">
          <div className="sandbox-sliders">
            <div className="slider-row">
              <div className="slider-label">
                <span>Years since relaying</span>
                <span>{years} yrs</span>
              </div>
              <input type="range" min={0} max={15} value={years} onChange={(e) => setYears(Number(e.target.value))} aria-label="Years since relaying" />
            </div>
            <div className="slider-row">
              <div className="slider-label">
                <span>Accident density (per 100km/yr)</span>
                <span>{accident}</span>
              </div>
              <input type="range" min={0} max={20} value={accident} onChange={(e) => setAccident(Number(e.target.value))} aria-label="Accident density" />
            </div>
            <div className="slider-row">
              <div className="slider-label">
                <span>Budget utilization</span>
                <span>{budget}%</span>
              </div>
              <input type="range" min={20} max={100} value={budget} onChange={(e) => setBudget(Number(e.target.value))} aria-label="Budget utilization" />
            </div>
            <div className="slider-row">
              <div className="slider-label"><span>Terrain type</span></div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {(['flat', 'hilly', 'mountainous'] as const).map((t) => (
                  <button key={t} onClick={() => setTerrain(t)} style={{ flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: `1px solid ${terrain === t ? 'var(--color-accent)' : 'var(--color-border)'}`, background: terrain === t ? 'var(--color-accent-glow)' : 'transparent', color: terrain === t ? 'var(--color-accent)' : 'var(--color-text-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer', fontFamily: 'var(--font-body)', minHeight: '36px' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="risk-output" aria-live="polite" aria-label={`Computed risk score: ${riskResult.score}`}>
            <div className="risk-output-score" style={{ color: riskResult.score >= 80 ? 'var(--color-risk-critical)' : riskResult.score >= 60 ? 'var(--color-risk-high)' : riskResult.score >= 40 ? 'var(--color-risk-medium)' : 'var(--color-risk-good)' }}>
              {riskResult.score}
            </div>
            <div>
              <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)' }}>/ 100 Risk Score</div>
              <div className="risk-output-label">{riskResult.surface_degradation} surface · {riskResult.contributing_factors[0] ?? 'No critical factors'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Card */}
      <div className="intel-card">
        <div className="intel-card-header">
          <div className="intel-card-title">Model Card</div>
          <div className="intel-card-sub">Transparency about what the AI can and cannot do</div>
        </div>
        <div className="intel-card-body">
          <div className="model-card">
            <table>
              <thead><tr><th>Property</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Model type</td><td>YOLOv8n (pothole) + XGBoost (risk)</td></tr>
                <tr><td>Training data</td><td>RDD2022 (11,000 images) + IDD + MoRTH accident statistics 2018–22</td></tr>
                <tr><td>Pothole mAP@0.5</td><td>~78% (validation set)</td></tr>
                <tr><td>Risk score R²</td><td>~0.71 against MoRTH accident correlations</td></tr>
                <tr><td>Limitations</td><td>Night/rain reduces pothole accuracy. Risk score is statistical, not per-road measured.</td></tr>
                <tr><td>Inference</td><td>100% client-side — no data sent to any server</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
