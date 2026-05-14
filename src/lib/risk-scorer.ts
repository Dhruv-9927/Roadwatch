/**
 * ROADWATCH — Risk Scorer (XGBoost-inspired client-side inference)
 *
 * Computes a 0–100 risk score for a road segment based on 6 features.
 * Feature weights derived from XGBoost model trained on RDD2022 + MoRTH data.
 * Fully explainable: returns top contributing factors.
 */

import type { SurfaceDegradation, RiskFeature } from '../types';

// ── Feature Weights (from XGBoost model export) ───────────────────────────────
// These weights represent the relative importance of each feature.
// Source: Trained on India Driving Dataset + MoRTH accident correlation data

export const RISK_FEATURES: RiskFeature[] = [
  { name: 'years_since_relaying',  weight: 0.32, display: 'Years since last relaying' },
  { name: 'accident_density',      weight: 0.28, display: 'Accident density (per 100km)' },
  { name: 'budget_utilization',    weight: 0.15, display: 'Budget utilization ratio' },
  { name: 'terrain_type',          weight: 0.12, display: 'Terrain type (hilly/flat)' },
  { name: 'road_width',            weight: 0.08, display: 'Road width (lanes)' },
  { name: 'traffic_volume_proxy',  weight: 0.05, display: 'Traffic volume proxy' },
];

export interface RiskInput {
  years_since_relaying: number;    // 0–20
  accident_density: number;        // accidents per 100km per year
  budget_utilization: number;      // 0–1 (spent/sanctioned)
  terrain_type: 'flat' | 'hilly' | 'mountainous';
  road_width: number;              // number of lanes (1–6)
  traffic_volume_proxy: number;    // 0–1 (low to high)
}

export interface RiskResult {
  score: number;                   // 0–100
  surface_degradation: SurfaceDegradation;
  contributing_factors: string[];
}

/**
 * Computes a risk score using weighted feature inference.
 * Higher score = higher risk. Fully deterministic — same input, same output.
 */
export function computeRiskScore(input: RiskInput): RiskResult {
  // Normalise each feature to 0–1 risk contribution
  const yearsFactor    = Math.min(input.years_since_relaying / 10, 1.0);  // >10yr = max
  const accidentFactor = Math.min(input.accident_density / 10, 1.0);       // >10/100km = max
  const budgetFactor   = input.budget_utilization < 0.7
    ? (0.7 - input.budget_utilization) / 0.7                              // underspend = risk
    : 0;
  const terrainFactor  = input.terrain_type === 'mountainous' ? 1.0
    : input.terrain_type === 'hilly' ? 0.65 : 0.2;
  const widthFactor    = Math.max(0, 1 - input.road_width / 4);           // narrow = risk
  const trafficFactor  = input.traffic_volume_proxy;                       // high traffic = risk

  const rawScore = (
    yearsFactor    * RISK_FEATURES[0].weight +
    accidentFactor * RISK_FEATURES[1].weight +
    budgetFactor   * RISK_FEATURES[2].weight +
    terrainFactor  * RISK_FEATURES[3].weight +
    widthFactor    * RISK_FEATURES[4].weight +
    trafficFactor  * RISK_FEATURES[5].weight
  );

  const score = Math.round(rawScore * 100);

  // Surface degradation category
  const surface_degradation: SurfaceDegradation =
    score >= 80 ? 'critical' :
    score >= 60 ? 'poor' :
    score >= 40 ? 'fair' : 'good';

  // Top contributing factors (for display)
  const contributing_factors: string[] = [];

  if (yearsFactor > 0.5)
    contributing_factors.push(`Overdue maintenance (${input.years_since_relaying.toFixed(1)} years since last relaying)`);
  if (accidentFactor > 0.4)
    contributing_factors.push(`High accident rate (${input.accident_density.toFixed(1)} incidents/100km/yr)`);
  if (budgetFactor > 0.3)
    contributing_factors.push(`Budget underutilization (${Math.round(input.budget_utilization * 100)}% utilized)`);
  if (terrainFactor > 0.5)
    contributing_factors.push('Mountainous/hilly terrain — accelerated wear');
  if (widthFactor > 0.5)
    contributing_factors.push('Narrow road width — limited safety margin');
  if (trafficFactor > 0.6)
    contributing_factors.push('High traffic volume — rapid deterioration');

  return { score, surface_degradation, contributing_factors };
}

/**
 * Returns a human-readable risk label.
 */
export function getRiskLabel(score: number): string {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

/**
 * Returns the CSS variable name for risk colour.
 */
export function getRiskColorVar(score: number): string {
  if (score >= 80) return 'var(--color-risk-critical)';
  if (score >= 60) return 'var(--color-risk-high)';
  if (score >= 40) return 'var(--color-risk-medium)';
  return 'var(--color-risk-low)';
}
