import { lazy, Suspense } from 'react';
import './index.css';
import NavBar from './components/shared/NavBar';
import { useAppStore } from './store/app.store';

// Lazy load all tab views
const MapView            = lazy(() => import('./components/map/MapView'));
// Placeholder components — will be built next
const ScanView           = lazy(() => import('./components/scan/ScanView'));
const ReportView         = lazy(() => import('./components/report/ReportView'));
const AccountabilityView = lazy(() => import('./components/accountability/AccountabilityView'));
const IntelligenceView   = lazy(() => import('./components/intelligence/IntelligenceView'));
const OfflineView        = lazy(() => import('./components/offline/OfflineView'));

function LoadingSpinner() {
  return (
    <div className="placeholder-view">
      <div className="icon-wrap">
        <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
      <p>Loading…</p>
    </div>
  );
}

export default function App() {
  const activeTab   = useAppStore((s) => s.activeTab);
  const offlineMode = useAppStore((s) => s.offlineMode);

  return (
    <div className="app-shell">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="app-header" role="banner">
        <a href="/" className="app-logo" aria-label="ROADWATCH home">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <path d="M9 22V12h6v10"/>
              <path d="M12 2v4M8 6l4-4 4 4"/>
            </svg>
          </div>
          <span className="logo-wordmark">ROAD<span>WATCH</span></span>
        </a>

        <div className="app-header-right">
          <div className="online-badge" aria-live="polite">
            <div className={`online-dot${offlineMode ? ' offline' : ''}`} />
            {offlineMode ? 'Offline' : 'Live'}
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="app-content" role="main" aria-label="Main content">
        {/* Map — Tab 1 (always mounted, never unmounted for perf) */}
        <div
          className={`tab-panel${activeTab === 'map' ? ' active' : ''}`}
          id="tab-panel-map"
          role="tabpanel"
          aria-labelledby="nav-map"
          aria-hidden={activeTab !== 'map'}
        >
          <Suspense fallback={<LoadingSpinner />}>
            <MapView />
          </Suspense>
        </div>

        {/* Scan — Tab 2 */}
        <div
          className={`tab-panel${activeTab === 'scan' ? ' active' : ''}`}
          id="tab-panel-scan"
          role="tabpanel"
          aria-labelledby="nav-scan"
          aria-hidden={activeTab !== 'scan'}
        >
          <Suspense fallback={<LoadingSpinner />}>
            {activeTab === 'scan' && <ScanView />}
          </Suspense>
        </div>

        {/* Report — Tab 3 */}
        <div
          className={`tab-panel${activeTab === 'report' ? ' active' : ''}`}
          id="tab-panel-report"
          role="tabpanel"
          aria-labelledby="nav-report"
          aria-hidden={activeTab !== 'report'}
        >
          <Suspense fallback={<LoadingSpinner />}>
            {activeTab === 'report' && <ReportView />}
          </Suspense>
        </div>

        {/* Accountability — Tab 4 */}
        <div
          className={`tab-panel${activeTab === 'accountability' ? ' active' : ''}`}
          id="tab-panel-accountability"
          role="tabpanel"
          aria-labelledby="nav-accountability"
          aria-hidden={activeTab !== 'accountability'}
        >
          <Suspense fallback={<LoadingSpinner />}>
            {activeTab === 'accountability' && <AccountabilityView />}
          </Suspense>
        </div>

        {/* Intelligence — Tab 5 */}
        <div
          className={`tab-panel${activeTab === 'intelligence' ? ' active' : ''}`}
          id="tab-panel-intelligence"
          role="tabpanel"
          aria-labelledby="nav-intelligence"
          aria-hidden={activeTab !== 'intelligence'}
        >
          <Suspense fallback={<LoadingSpinner />}>
            {activeTab === 'intelligence' && <IntelligenceView />}
          </Suspense>
        </div>

        {/* Offline — Tab 6 */}
        <div
          className={`tab-panel${activeTab === 'offline' ? ' active' : ''}`}
          id="tab-panel-offline"
          role="tabpanel"
          aria-labelledby="nav-offline"
          aria-hidden={activeTab !== 'offline'}
        >
          <Suspense fallback={<LoadingSpinner />}>
            {activeTab === 'offline' && <OfflineView />}
          </Suspense>
        </div>
      </main>

      {/* ── Bottom navigation ────────────────────────────────────── */}
      <NavBar />
    </div>
  );
}
