import './NavBar.css';
import type { TabId } from '../../types';
import { useAppStore } from '../../store/app.store';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const MapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z"/><path d="M9 4v13M15 7v13"/>
  </svg>
);

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
    <circle cx="12" cy="12" r="3"/><path d="M8 12H3M21 12h-5M12 8V3M12 21v-5"/>
  </svg>
);

const ReportIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);

const AccountIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const IntelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 8v4M12 16h.01"/>
  </svg>
);

const OfflineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 6s4-4 11-4 11 4 11 4"/><path d="M5 10s2.5-2.5 7-2.5 7 2.5 7 2.5"/>
    <path d="M9 14s1-1 3-1 3 1 3 1"/><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
);

const TABS: Tab[] = [
  { id: 'map',            label: 'Map',         icon: <MapIcon /> },
  { id: 'scan',           label: 'Scan',        icon: <ScanIcon /> },
  { id: 'report',         label: 'Report',      icon: <ReportIcon /> },
  { id: 'accountability', label: 'Registry',    icon: <AccountIcon /> },
  { id: 'intelligence',   label: 'Insights',    icon: <IntelIcon /> },
  { id: 'offline',        label: 'Offline',        icon: <OfflineIcon /> },
];

export default function NavBar() {
  const activeTab    = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const pendingCount = useAppStore((s) => s.pendingReports.length);
  const offlineMode  = useAppStore((s) => s.offlineMode);

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const showBadge =
          (tab.id === 'report' && pendingCount > 0) ||
          (tab.id === 'offline' && offlineMode);

        return (
          <button
            key={tab.id}
            id={`nav-${tab.id}`}
            className={`navbar-tab${isActive ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            {showBadge && (
              <span className="navbar-badge" aria-label={
                tab.id === 'report' ? `${pendingCount} pending reports` : 'Offline'
              }>
                {tab.id === 'report' ? pendingCount : '!'}
              </span>
            )}
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
