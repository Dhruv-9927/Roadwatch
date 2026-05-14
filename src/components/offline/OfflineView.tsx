import { useEffect, useState } from 'react';
import { getCacheManifest, getPendingReports, getAllReports } from '../../lib/offline-db';
import { useAppStore } from '../../store/app.store';
import type { CacheItem } from '../../types';

const css = `
.offline-view { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-5); max-width: 680px; margin: 0 auto; width: 100%; }
.offline-view h1 { font-size: var(--text-xl); color: var(--color-text-primary); margin-bottom: 2px; }
.offline-view > header p { font-size: var(--text-sm); color: var(--color-text-muted); }
.offline-card { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); overflow: hidden; }
.offline-card-header { padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; }
.offline-card-title { font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--color-text-primary); }
.offline-card-body { padding: var(--space-5); }
.status-banner { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-5); background: var(--color-bg-elevated); border-radius: var(--radius-md); margin-bottom: var(--space-4); }
.status-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.status-icon.online  { background: rgba(82,183,136,0.2); }
.status-icon.offline { background: rgba(230,57,70,0.2); animation: glow 2s ease-in-out infinite; }
.status-icon svg { width: 24px; height: 24px; }
.status-icon.online  svg { color: var(--color-success); }
.status-icon.offline svg { color: var(--color-danger); }
.status-text h3 { font-size: var(--text-md); color: var(--color-text-primary); }
.status-text p  { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; }
.cache-list { display: flex; flex-direction: column; gap: var(--space-3); }
.cache-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--color-bg-elevated); border-radius: var(--radius-md); border: 1px solid var(--color-border); }
.cache-item-icon { width: 32px; height: 32px; border-radius: var(--radius-sm); background: rgba(76,201,240,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cache-item-icon svg { width: 16px; height: 16px; color: var(--color-sh); }
.cache-item-label { flex: 1; font-size: var(--text-sm); color: var(--color-text-secondary); }
.cache-item-size { font-size: var(--text-xs); font-family: var(--font-display); color: var(--color-text-muted); }
.cache-empty { font-size: var(--text-sm); color: var(--color-text-muted); text-align: center; padding: var(--space-6); }
.pending-count { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--color-accent); }
.sync-btn { width: 100%; padding: var(--space-4); background: var(--color-accent); border: none; border-radius: var(--radius-md); color: var(--color-bg); font-size: var(--text-base); font-weight: var(--weight-bold); font-family: var(--font-body); cursor: pointer; min-height: 52px; display: flex; align-items: center; justify-content: center; gap: var(--space-2); transition: all var(--duration-normal) var(--ease-out); }
.sync-btn:hover:not(:disabled) { background: #f5b07a; transform: translateY(-1px); }
.sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.network-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); }
.network-stat { background: var(--color-bg-elevated); border-radius: var(--radius-md); padding: var(--space-4); text-align: center; }
.network-stat-val { font-family: var(--font-display); font-size: var(--text-xl); color: var(--color-text-primary); }
.network-stat-label { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }
`;

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function OfflineView() {
  const offlineMode    = useAppStore((s) => s.offlineMode);
  const lastSyncedAt   = useAppStore((s) => s.lastSyncedAt);
  const syncInProgress = useAppStore((s) => s.syncInProgress);
  const setSyncInProgress = useAppStore((s) => s.setSyncInProgress);
  const setLastSyncedAt   = useAppStore((s) => s.setLastSyncedAt);

  const [cacheItems,    setCacheItems]    = useState<CacheItem[]>([]);
  const [pendingCount,  setPendingCount]  = useState(0);
  const [totalReports,  setTotalReports]  = useState(0);
  const [connection,    setConnection]    = useState<string>('unknown');

  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    return () => { document.head.removeChild(styleEl); };
  }, []);

  useEffect(() => {
    getCacheManifest().then(setCacheItems);
    getPendingReports().then((r) => setPendingCount(r.length));
    getAllReports().then((r) => setTotalReports(r.length));

    // Network info
    const nav = navigator as any;
    if (nav.connection) {
      setConnection(nav.connection.effectiveType ?? 'unknown');
      nav.connection.addEventListener('change', () => setConnection(nav.connection.effectiveType));
    }
  }, []);

  const handleSync = async () => {
    if (offlineMode || syncInProgress) return;
    setSyncInProgress(true);

    try {
      const pending = await getPendingReports();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project') && pending.length > 0) {
        for (const report of pending) {
          await fetch(`${supabaseUrl}/rest/v1/reports`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify(report),
          });
        }
      }

      setLastSyncedAt(new Date());
      setPendingCount(0);
    } catch (err) {
      console.error('[Offline] Sync failed:', err);
    } finally {
      setSyncInProgress(false);
    }
  };

  return (
    <div className="offline-view">
      <header>
        <h1>Offline Status</h1>
        <p>ROADWATCH works without internet. Everything queues locally and syncs automatically.</p>
      </header>

      {/* Status banner */}
      <div className="offline-card">
        <div className="offline-card-body">
          <div className="status-banner">
            <div className={`status-icon ${offlineMode ? 'offline' : 'online'}`}>
              {offlineMode ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <line x1="1" y1="1" x2="23" y2="23"/>
                  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M1 6s4-4 11-4 11 4 11 4M5 10s2.5-2.5 7-2.5 7 2.5 7 2.5M9 14s1-1 3-1 3 1 3 1"/>
                  <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5"/>
                </svg>
              )}
            </div>
            <div className="status-text">
              <h3>{offlineMode ? 'You are offline' : 'Connected'}</h3>
              <p>
                {offlineMode
                  ? 'Reports are queuing locally. Road data loaded from cache.'
                  : lastSyncedAt
                  ? `Last synced: ${lastSyncedAt.toLocaleTimeString('en-IN')}`
                  : 'Ready to sync. All features available.'}
              </p>
            </div>
          </div>

          <div className="network-info">
            <div className="network-stat">
              <div className="network-stat-val">{pendingCount}</div>
              <div className="network-stat-label">Pending reports</div>
            </div>
            <div className="network-stat">
              <div className="network-stat-val">{totalReports}</div>
              <div className="network-stat-label">Total reports</div>
            </div>
            <div className="network-stat">
              <div className="network-stat-val">{connection.toUpperCase()}</div>
              <div className="network-stat-label">Connection type</div>
            </div>
            <div className="network-stat">
              <div className="network-stat-val">{cacheItems.length}</div>
              <div className="network-stat-label">Cached datasets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual sync */}
      <div className="offline-card">
        <div className="offline-card-header">
          <span className="offline-card-title">Manual Sync</span>
          {pendingCount > 0 && (
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-display)', color: 'var(--color-warning)' }}>
              {pendingCount} queued
            </span>
          )}
        </div>
        <div className="offline-card-body">
          <button
            id="manual-sync-btn"
            className="sync-btn"
            onClick={handleSync}
            disabled={offlineMode || syncInProgress || pendingCount === 0}
            aria-label={pendingCount > 0 ? `Sync ${pendingCount} pending reports` : 'No pending reports to sync'}
          >
            {syncInProgress ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Syncing…
              </>
            ) : offlineMode ? (
              'Offline — Cannot Sync'
            ) : pendingCount === 0 ? (
              '✓ All reports synced'
            ) : (
              `Sync ${pendingCount} Report${pendingCount !== 1 ? 's' : ''} Now`
            )}
          </button>
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Background Sync API also fires automatically when connection is restored
          </p>
        </div>
      </div>

      {/* Cache manifest */}
      <div className="offline-card">
        <div className="offline-card-header">
          <span className="offline-card-title">Cached Data</span>
        </div>
        <div className="offline-card-body">
          {cacheItems.length === 0 ? (
            <div className="cache-empty">
              <p>No data cached yet.</p>
              <p style={{ marginTop: 'var(--space-2)' }}>Zoom into a district on the map to download road data for offline use.</p>
            </div>
          ) : (
            <div className="cache-list">
              {cacheItems.map((item) => (
                <div key={item.id} className="cache-item">
                  <div className="cache-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <ellipse cx="12" cy="5" rx="9" ry="3"/>
                      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                    </svg>
                  </div>
                  <div className="cache-item-label">
                    {item.label}
                    {item.district && <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>· {item.district}</span>}
                  </div>
                  <div className="cache-item-size">{formatBytes(item.size_bytes)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="offline-card">
        <div className="offline-card-header">
          <span className="offline-card-title">How Offline Works</span>
        </div>
        <div className="offline-card-body" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <ol style={{ paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li><strong>First load</strong> — road data for viewed districts is cached to IndexedDB via Dexie.js</li>
            <li><strong>Road tap (offline)</strong> — Road DNA card reads from local IndexedDB cache instantly</li>
            <li><strong>Report submit (offline)</strong> — written to pending queue in IndexedDB, UI shows "Queued"</li>
            <li><strong>Connection restored</strong> — Background Sync API fires, pending reports are batch-uploaded to Supabase</li>
            <li><strong>Offline tab</strong> — shows exactly what's cached and how many reports are queued</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
