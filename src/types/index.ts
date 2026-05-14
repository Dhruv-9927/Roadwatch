// ROADWATCH — Shared TypeScript Types
// This is the single source of truth for type definitions.

export type RoadType = 'NH' | 'SH' | 'MDR' | 'ODR' | 'VR';
export type TabId = 'map' | 'scan' | 'report' | 'accountability' | 'intelligence' | 'offline';
export type CountryCode = 'IN' | 'KE' | 'NG' | 'VN';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus = 'draft' | 'pending' | 'synced' | 'acknowledged' | 'resolved';
export type ComplaintType = 'standard' | 'warranty_claim' | 'overdue_project';
export type SurfaceDegradation = 'good' | 'fair' | 'poor' | 'critical';
export type ProjectStatus = 'on_track' | 'delayed' | 'completed' | 'overdue';

/** Core authority record */
export type Authority = {
  name: string;
  executive_engineer: string;
  email: string;
  phone: string;
  division?: string;
};

/** The Road DNA — single source of truth for any road segment */
export type RoadDNA = {
  // Identity
  osm_way_id: string;
  name: string;
  road_type: RoadType;
  state: string;
  district: string;

  // Authority routing
  authority: Authority;

  // Budget transparency
  budget: {
    project_name: string;
    sanctioned_inr: number;   // in lakhs
    spent_inr: number;
    source_url: string;
    source_label: string;
    financial_year: string;
    status: ProjectStatus;
    due_date?: string;
  };

  // Maintenance history
  maintenance: {
    last_relayed: string;
    contractor_name: string;
    warranty_expires: string | null;
    warranty_active: boolean;
  };

  // Risk scoring
  risk: {
    score: number;
    accident_count_3yr: number;
    surface_degradation: SurfaceDegradation;
    contributing_factors: string[];
  };

  // Global
  country: CountryCode;
  currency: string;
  data_completeness: number;
  coordinates?: [number, number]; // [lng, lat]
};

/** Routing engine output */
export type ReasoningStep = {
  condition: string;
  result: string;
};

export type RoutingDecision = {
  primary_authority: Authority;
  cc_authorities: Authority[];
  complaint_type: ComplaintType;
  reasoning_steps: ReasoningStep[];
  confidence: number;
};

/** Citizen report */
export type Report = {
  id: string;
  road_id: string | null;
  road_name: string;
  description: string;
  severity: SeverityLevel;
  latitude: number | null;
  longitude: number | null;
  photo_hash: string | null;
  status: ReportStatus;
  routing_decision: RoutingDecision | null;
  created_at: string;
  synced_at: string | null;
};

/** Detection result from ONNX */
export type Detection = {
  class: 'pothole' | 'crack' | 'patch' | 'good';
  confidence: number;
  bbox: [number, number, number, number]; // x, y, w, h
};

/** District data for accountability charts */
export type DistrictData = {
  district: string;
  state: string;
  budget_utilization: number; // 0–1
  accident_rate: number;      // per 100km per year
  road_count: number;
  data_completeness: number;
  transparency_score: number;
  resolution_rate: number;
};

/** Cache manifest item */
export type CacheItem = {
  id: string;
  type: 'tiles' | 'road_data' | 'model';
  label: string;
  size_bytes: number;
  cached_at: string;
  district?: string;
};

/** XGBoost risk feature weights */
export type RiskFeature = {
  name: string;
  weight: number;
  display: string;
};

/** Country dataset reference */
export type CountryDataset = {
  code: CountryCode;
  name: string;
  flag: string;
  data_url: string;
  road_count: number;
  coverage: string;
};
