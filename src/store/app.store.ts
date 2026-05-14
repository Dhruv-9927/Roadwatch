/**
 * ROADWATCH — Zustand Global Store
 *
 * Single store, sliced by domain.
 * Components read directly from store — no prop drilling.
 */

import { create } from 'zustand';
import type { RoadDNA, Report, TabId, CountryCode, CacheItem } from '../types';

interface AppStore {
  // ── Map ──────────────────────────────────────────────
  selectedRoadId:  string | null;
  heatmapVisible:  boolean;
  activeTab:       TabId;
  mapLoaded:       boolean;
  mapCenter:       [number, number]; // [lng, lat]
  mapZoom:         number;

  // ── Road data cache (in-memory, backed by IndexedDB) ─
  roadCache:       Map<string, RoadDNA>;
  roadsLoading:    boolean;
  roadsError:      string | null;

  // ── Reports ───────────────────────────────────────────
  pendingReports:    Report[];
  submittedReports:  Report[];
  reportDraft:       Partial<Report> | null;

  // ── Offline ───────────────────────────────────────────
  offlineMode:       boolean;
  lastSyncedAt:      Date | null;
  cacheManifest:     CacheItem[];
  syncInProgress:    boolean;

  // ── Country ───────────────────────────────────────────
  activeCountry:     CountryCode;

  // ── Actions ───────────────────────────────────────────
  setActiveTab:        (tab: TabId) => void;
  setSelectedRoadId:   (id: string | null) => void;
  toggleHeatmap:       () => void;
  setMapLoaded:        (loaded: boolean) => void;
  setMapCenter:        (center: [number, number], zoom?: number) => void;

  setRoadsLoading:     (loading: boolean) => void;
  setRoadsError:       (error: string | null) => void;
  addRoadsToCache:     (roads: RoadDNA[]) => void;
  getRoadFromCache:    (id: string) => RoadDNA | undefined;

  addPendingReport:    (report: Report) => void;
  markReportSynced:    (id: string) => void;
  setReportDraft:      (draft: Partial<Report> | null) => void;

  setOfflineMode:      (offline: boolean) => void;
  setLastSyncedAt:     (date: Date) => void;
  setCacheManifest:    (items: CacheItem[]) => void;
  setSyncInProgress:   (inProgress: boolean) => void;

  setActiveCountry:    (country: CountryCode) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // ── Initial state ───────────────────────────────────────────────────────────
  selectedRoadId:    null,
  heatmapVisible:    false,
  activeTab:         'map',
  mapLoaded:         false,
  mapCenter:         [78.96, 20.59], // Geographic centre of India
  mapZoom:           5,

  roadCache:         new Map(),
  roadsLoading:      false,
  roadsError:        null,

  pendingReports:    [],
  submittedReports:  [],
  reportDraft:       null,

  offlineMode:       !navigator.onLine,
  lastSyncedAt:      null,
  cacheManifest:     [],
  syncInProgress:    false,

  activeCountry:     'IN',

  // ── Actions ─────────────────────────────────────────────────────────────────
  setActiveTab:      (tab)    => set({ activeTab: tab }),
  setSelectedRoadId: (id)     => set({ selectedRoadId: id }),
  toggleHeatmap:     ()       => set((s) => ({ heatmapVisible: !s.heatmapVisible })),
  setMapLoaded:      (loaded) => set({ mapLoaded: loaded }),
  setMapCenter:      (center, zoom) =>
    set((s) => ({ mapCenter: center, mapZoom: zoom ?? s.mapZoom })),

  setRoadsLoading: (loading) => set({ roadsLoading: loading }),
  setRoadsError:   (error)   => set({ roadsError: error }),
  addRoadsToCache: (roads) =>
    set((s) => {
      const next = new Map(s.roadCache);
      roads.forEach((r) => next.set(r.osm_way_id, r));
      return { roadCache: next };
    }),
  getRoadFromCache: (id) => get().roadCache.get(id),

  addPendingReport:  (report) =>
    set((s) => ({ pendingReports: [...s.pendingReports, report] })),
  markReportSynced:  (id) =>
    set((s) => ({
      pendingReports:   s.pendingReports.filter((r) => r.id !== id),
      submittedReports: [
        ...s.submittedReports,
        { ...s.pendingReports.find((r) => r.id === id)!, status: 'synced' },
      ],
    })),
  setReportDraft: (draft) => set({ reportDraft: draft }),

  setOfflineMode:    (offline)    => set({ offlineMode: offline }),
  setLastSyncedAt:   (date)       => set({ lastSyncedAt: date }),
  setCacheManifest:  (items)      => set({ cacheManifest: items }),
  setSyncInProgress: (inProgress) => set({ syncInProgress: inProgress }),

  setActiveCountry:  (country)   => set({ activeCountry: country }),
}));

// ── Listen for online/offline events ────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('online',  () => useAppStore.getState().setOfflineMode(false));
  window.addEventListener('offline', () => useAppStore.getState().setOfflineMode(true));
}
