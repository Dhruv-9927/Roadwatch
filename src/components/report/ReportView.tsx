import { useState, useEffect } from 'react';
import './ReportView.css';
import { useAppStore } from '../../store/app.store';
import { routeComplaint } from '../../lib/routing-engine';
import { saveReport, getAllReports } from '../../lib/offline-db';
import { reverseGeocode } from '../../lib/live-data';
import VoiceReport from './VoiceReport';
import type { ParsedReport } from './VoiceReport';
import type { Report, SeverityLevel, RoadDNA } from '../../types';

function generateId() {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const SEVERITY_OPTIONS: { value: SeverityLevel; label: string }[] = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function ReportView() {
  const reportDraft  = useAppStore((s) => s.reportDraft);
  const roadCache    = useAppStore((s) => s.roadCache);
  const offlineMode  = useAppStore((s) => s.offlineMode);
  const addPending   = useAppStore((s) => s.addPendingReport);
  const setReportDraft = useAppStore((s) => s.setReportDraft);

  const [roadName,    setRoadName]    = useState(reportDraft?.road_name ?? '');
  const [description, setDescription] = useState(reportDraft?.description ?? '');
  const [severity,    setSeverity]    = useState<SeverityLevel>(
    (reportDraft?.severity as SeverityLevel) ?? 'high'
  );
  const [lat,  setLat]  = useState<string>(String(reportDraft?.latitude  ?? ''));
  const [lng,  setLng]  = useState<string>(String(reportDraft?.longitude ?? ''));
  const [gpsLoading, setGpsLoading] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history,   setHistory]   = useState<Report[]>([]);

  // Routing decision derived from selected road in cache
  const selectedRoad: RoadDNA | undefined = reportDraft?.road_id
    ? roadCache.get(reportDraft.road_id)
    : undefined;

  const routing = selectedRoad ? routeComplaint(selectedRoad) : null;

  useEffect(() => {
    // Sync draft when it changes
    if (reportDraft?.road_name) setRoadName(reportDraft.road_name);
    if (reportDraft?.description) setDescription(reportDraft.description);
    if (reportDraft?.severity) setSeverity(reportDraft.severity as SeverityLevel);
    if (reportDraft?.latitude)  setLat(String(reportDraft.latitude));
    if (reportDraft?.longitude) setLng(String(reportDraft.longitude));
  }, [reportDraft]);

  useEffect(() => {
    getAllReports().then(setHistory).catch(console.error);
  }, [submitted]);

  const handleGetGPS = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude.toFixed(6));
        setLng(longitude.toFixed(6));
        // Reverse geocode to get road name if not already set
        if (!roadName) {
          const geo = await reverseGeocode(latitude, longitude);
          if (geo) setRoadName(geo.display_name.split(',')[0] ?? '');
        }
        setGpsLoading(false);
      },
      () => { setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roadName || !description) return;
    setSubmitting(true);

    const report: Report = {
      id:           generateId(),
      road_id:      reportDraft?.road_id ?? null,
      road_name:    roadName,
      description,
      severity,
      latitude:     lat ? parseFloat(lat) : null,
      longitude:    lng ? parseFloat(lng) : null,
      photo_hash:   null,
      status:       'pending',
      routing_decision: routing,
      created_at:   new Date().toISOString(),
      synced_at:    null,
    };

    await saveReport(report);
    addPending(report);

    // Attempt live Supabase sync if online
    if (!offlineMode) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')) {
          await fetch(`${supabaseUrl}/rest/v1/reports`, {
            method:  'POST',
            headers: {
              'apikey':       supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer':       'return=minimal',
            },
            body: JSON.stringify(report),
          });
        }
      } catch (err) {
        console.warn('[Report] Supabase sync failed, queued offline:', err);
      }
    }

    setSubmitting(false);
    setSubmitted(true);
    setReportDraft(null);
  };

  if (submitted) {
    return (
      <div className="report-view">
        <div className="report-success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <h2>Report Submitted</h2>
          <p>
            {offlineMode
              ? "Saved locally. Will sync when you're back online."
              : `Routed to ${routing?.primary_authority.name ?? 'responsible authority'}.`}
          </p>
          {offlineMode && <span className="offline-queued">⏳ Queued — will sync when connected</span>}
          <button
            style={{ marginTop: 'var(--space-5)', padding: 'var(--space-3) var(--space-6)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
            onClick={() => setSubmitted(false)}
          >
            Submit Another
          </button>
        </div>

        {history.length > 0 && (
          <section aria-label="Your submitted reports">
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>Your Reports</h2>
            <div className="report-history">
              {history.map((r) => (
                <div key={r.id} className="report-card">
                  <div className="report-card-content">
                    <div className="report-card-title">{r.road_name || 'Unknown road'}</div>
                    <div className="report-card-meta">
                      {r.severity} · {new Date(r.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <span className={`status-chip ${r.status}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="report-view">
      <header>
        <h1>File a Complaint</h1>
        <p>Your complaint will be routed to the exact responsible authority, not a generic inbox.</p>
      </header>

      {/* ── Hindi Voice Report ── */}
      <VoiceReport
        onParsed={(p: ParsedReport) => {
          if (p.road)     setRoadName(p.road);
          if (p.issueEn)  setDescription(
            `${p.issueEn}${p.location ? ' near ' + p.location : ''}. Severity: ${p.severity}.`
          );
          if (p.severity) setSeverity(p.severity as SeverityLevel);
        }}
      />

      {/* Routing visualiser */}
      {routing && (
        <div className="routing-visualizer" aria-label="Complaint routing chain">
          <div className="routing-title">How this complaint routes</div>
          <div className="routing-steps">
            {routing.reasoning_steps.map((step, i) => (
              <div key={i} className="routing-step">
                <div className={`routing-step-dot${i === routing.reasoning_steps.length - 1 ? ' primary' : ''}`}>
                  {i + 1}
                </div>
                <div className="routing-step-content">
                  <div className="routing-step-condition">{step.condition}</div>
                  <div className="routing-step-result">{step.result}</div>
                  {i === routing.reasoning_steps.length - 1 && (
                    <div className="routing-authority-chip">
                      <div className="routing-authority-name">→ {routing.primary_authority.name}</div>
                      <div className="routing-authority-ee">
                        EE: {routing.primary_authority.executive_engineer} · {routing.primary_authority.email}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="routing-confidence">
            <span>Routing confidence</span>
            <span className="routing-confidence-val">{Math.round(routing.confidence * 100)}%</span>
          </div>
        </div>
      )}

      {/* Form */}
      <form className="report-form" onSubmit={handleSubmit} aria-label="Report submission form">
        <div className="report-form-section">
          <h2>Road Details</h2>

          <div className="form-field">
            <label className="form-label" htmlFor="road-name">
              Road Name / Number <span className="required">*</span>
            </label>
            <input
              id="road-name"
              className="form-input"
              type="text"
              value={roadName}
              onChange={(e) => setRoadName(e.target.value)}
              placeholder="e.g. NH-3 Chandigarh-Manali Highway"
              required
              autoComplete="off"
            />
          </div>

          <div className="form-field">
            <label className="form-label">GPS Location</label>
            <div className="gps-row">
              <input
                className="form-input"
                type="text"
                value={lat && lng ? `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` : ''}
                placeholder="Latitude, Longitude"
                readOnly
                aria-label="GPS coordinates"
              />
              <button
                type="button"
                className="gps-btn"
                onClick={handleGetGPS}
                disabled={gpsLoading}
                aria-label="Get current GPS location"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>
                  <path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
                {gpsLoading ? 'Locating…' : 'Use GPS'}
              </button>
            </div>
          </div>
        </div>

        <div className="report-form-section">
          <h2>Issue Details</h2>

          <div className="form-field">
            <label className="form-label" htmlFor="description">
              Description <span className="required">*</span>
            </label>
            <textarea
              id="description"
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the road condition — pothole size, safety risk, how long it's been there…"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Severity</label>
            <div className="severity-pills" role="radiogroup" aria-label="Severity level">
              {SEVERITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`severity-pill${severity === opt.value ? ` selected-${opt.value}` : ''}`}
                  onClick={() => setSeverity(opt.value)}
                  role="radio"
                  aria-checked={severity === opt.value}
                  aria-label={`Severity: ${opt.label}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="report-form-section">
          <button
            id="report-submit-btn"
            type="submit"
            className="report-submit"
            disabled={submitting || !roadName || !description}
            aria-label="Submit complaint report"
          >
            {submitting ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Submitting…
              </>
            ) : offlineMode ? (
              '⏳ Queue Report (Offline)'
            ) : (
              'Submit Report →'
            )}
          </button>
          {offlineMode && (
            <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
              You're offline. Report will be queued and sent automatically when connected.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
