/**
 * ROADWATCH — Offline Database (Dexie.js)
 *
 * All IndexedDB operations through a typed Dexie schema.
 * This is what powers offline-first: everything hits IndexedDB first.
 */

import Dexie, { type Table } from 'dexie';
import type { RoadDNA, Report, CacheItem } from '../types';

// ── Schema ────────────────────────────────────────────────────────────────────

export class RoadwatchDB extends Dexie {
  roads!:          Table<RoadDNA, string>;          // keyed by osm_way_id
  reports!:        Table<Report, string>;           // keyed by id
  cache_manifest!: Table<CacheItem, string>;        // keyed by id
  accident_stats!: Table<AccidentStatRecord, string>; // keyed by district
  nh_projects!:    Table<NHProjectRecord, string>;  // keyed by project_name

  constructor() {
    super('roadwatch');
    this.version(1).stores({
      roads:          'osm_way_id, name, road_type, district, state',
      reports:        'id, road_id, status, created_at',
      cache_manifest: 'id, type, district',
      accident_stats: 'district, state, year',
      nh_projects:    'project_name, nh_number, state, status',
    });
  }
}

export interface AccidentStatRecord {
  district: string;
  state: string;
  total_accidents: number;
  fatal_accidents: number;
  year: number;
  cached_at: string;
}

export interface NHProjectRecord {
  project_name: string;
  nh_number: string;
  state: string;
  length_km: number;
  cost_crore: number;
  status: string;
  completion_date: string;
  contractor: string;
  cached_at: string;
}

export const db = new RoadwatchDB();

// ── Road operations ───────────────────────────────────────────────────────────

/** Cache roads fetched from Overpass API */
export async function cacheRoads(roads: RoadDNA[]): Promise<void> {
  await db.roads.bulkPut(roads);
}

/** Get all cached roads for a district */
export async function getRoadsByDistrict(district: string): Promise<RoadDNA[]> {
  return db.roads.where('district').equalsIgnoreCase(district).toArray();
}

/** Get a specific road by OSM way ID */
export async function getRoadById(osmWayId: string): Promise<RoadDNA | undefined> {
  return db.roads.get(osmWayId);
}

/** Search roads by name */
export async function searchRoads(query: string): Promise<RoadDNA[]> {
  const q = query.toLowerCase();
  return db.roads
    .filter((r) => r.name.toLowerCase().includes(q) || r.osm_way_id.includes(q))
    .toArray();
}

// ── Report operations ─────────────────────────────────────────────────────────

/** Save a new report (offline queue) */
export async function saveReport(report: Report): Promise<void> {
  await db.reports.put(report);
}

/** Get all pending (unsynced) reports */
export async function getPendingReports(): Promise<Report[]> {
  return db.reports.where('status').equals('pending').toArray();
}

/** Update report status after sync */
export async function markReportSynced(id: string, syncedAt: string): Promise<void> {
  await db.reports.update(id, { status: 'synced', synced_at: syncedAt });
}

/** Get all reports */
export async function getAllReports(): Promise<Report[]> {
  return db.reports.orderBy('created_at').reverse().toArray();
}

// ── Accident stats ─────────────────────────────────────────────────────────────

export async function cacheAccidentStats(stats: AccidentStatRecord[]): Promise<void> {
  await db.accident_stats.bulkPut(stats);
}

export async function getAccidentStatForDistrict(district: string): Promise<AccidentStatRecord | undefined> {
  return db.accident_stats.get(district);
}

// ── NH projects ───────────────────────────────────────────────────────────────

export async function cacheNHProjects(projects: NHProjectRecord[]): Promise<void> {
  await db.nh_projects.bulkPut(projects);
}

export async function getAllNHProjects(): Promise<NHProjectRecord[]> {
  return db.nh_projects.toArray();
}

export async function searchNHProjects(query: string): Promise<NHProjectRecord[]> {
  const q = query.toLowerCase();
  return db.nh_projects
    .filter((p) => p.project_name.toLowerCase().includes(q) || p.nh_number.toLowerCase().includes(q))
    .toArray();
}

// ── Cache manifest ────────────────────────────────────────────────────────────

export async function updateCacheManifest(item: CacheItem): Promise<void> {
  await db.cache_manifest.put(item);
}

export async function getCacheManifest(): Promise<CacheItem[]> {
  return db.cache_manifest.toArray();
}

/** Check if we have any road data cached (first-load detection) */
export async function hasRoadCache(): Promise<boolean> {
  const count = await db.roads.count();
  return count > 0;
}
