import { lazy, Suspense, useState } from 'react';
import './index.css';
import NavBar from './components/shared/NavBar';
import SplashScreen from './components/scatter/SplashScreen';
import { useAppStore } from './store/app.store';
import { ChatBot } from './components/chatbot';

// Lazy load views
const MapView            = lazy(() => import('./components/map/MapView'));
const ScanView           = lazy(() => import('./components/scan/ScanView'));
const ReportView         = lazy(() => import('./components/report/ReportView'));
const AccountabilityView = lazy(() => import('./components/accountability/AccountabilityView'));
const IntelligenceView   = lazy(() => import('./components/intelligence/IntelligenceView'));
const OfflineView        = lazy(() => import('./components/offline/OfflineView'));

function LoadingSpinner() {
  return (
    <div className="placeholder-view">
      <div className="icon-wrap">
        <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
  
  // Guard state
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {/* 1. Force Splash to render directly in parallel or as an overlay */}
      {showSplash && (
        <SplashScreen onComplete={() => {
          console.log("Splash animation sequence finished!");
          setShowSplash(false);
        }} />
      )}

      {/* 2. Main App Content (Only show if splash is done) */}
      {!showSplash && (
        <div className="app-shell animate-fade-in">
          <header className="app-header" role="banner">
            <div className="header-content">
              <a href="/" className="app-logo" aria-label="ROADWATCH home">
                <div className="logo-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <path d="M9 22V12h6v10"/>
                    <path d="M12 2v4M8 6l4-4 4 4"/>
                  </svg>
                </div>
                <span className="logo-wordmark">ROAD<span>WATCH</span></span>
              </a>

              <div className="app-header-right">
                <div className="online-badge">
                  <div className={`online-dot${offlineMode ? ' offline' : ''}`} />
                  {offlineMode ? 'Offline' : 'Live'}
                </div>
              </div>
            </div>
          </header>

          <main className="app-content">
            {/* Map — Tab 1 */}
            <div className={`tab-panel${activeTab === 'map' ? ' active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                <MapView />
              </Suspense>
            </div>

            {/* Scan — Tab 2 */}
            <div className={`tab-panel${activeTab === 'scan' ? ' active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                {activeTab === 'scan' && <ScanView />}
              </Suspense>
            </div>

            {/* Report — Tab 3 */}
            <div className={`tab-panel${activeTab === 'report' ? ' active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                {activeTab === 'report' && <ReportView />}
              </Suspense>
            </div>

            {/* Accountability — Tab 4 */}
            <div className={`tab-panel${activeTab === 'accountability' ? ' active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                {activeTab === 'accountability' && <AccountabilityView />}
              </Suspense>
            </div>

            {/* Intelligence — Tab 5 */}
            <div className={`tab-panel${activeTab === 'intelligence' ? ' active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                {activeTab === 'intelligence' && <IntelligenceView />}
              </Suspense>
            </div>

            {/* Offline — Tab 6 */}
            <div className={`tab-panel${activeTab === 'offline' ? ' active' : ''}`}>
              <Suspense fallback={<LoadingSpinner />}>
                {activeTab === 'offline' && <OfflineView />}
              </Suspense>
            </div>
          </main>

          <NavBar />
        </div>
      )}

      {/* SafePath AI — floating chatbot, visible on every tab */}
      {!showSplash && <ChatBot />}
    </>
  );
}