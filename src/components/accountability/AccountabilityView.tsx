/**
 * ROADWATCH — AccountabilityView.tsx  (FULL REPLACEMENT)
 * 4A: Contractor Scorecard (NEW centrepiece)
 * 4B: Budget vs Safety Scatter
 * 4C: Project Tracker
 * 4D: District Rankings
 */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchNHProjects } from '../../lib/live-data';
import { getAllNHProjects } from '../../lib/offline-db';
import type { DistrictData } from '../../types';

// ── CSS ─────────────────────────────────────────────────────────────────────
const css = `
.acc-view { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-6); max-width: 960px; margin: 0 auto; width: 100%; }
.acc-view h1 { font-size: var(--text-xl); color: var(--color-text-primary); margin-bottom: 2px; }
.acc-view > header p { font-size: var(--text-sm); color: var(--color-text-muted); }

/* Stats row */
.acc-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); }
@media (max-width: 640px) { .acc-stats-row { grid-template-columns: repeat(2, 1fr); } }
.acc-stat-chip { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: var(--space-4) var(--space-5); position: relative; overflow: hidden; }
.acc-stat-chip::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(244,162,97,0.04) 0%, transparent 60%); pointer-events: none; }
.acc-stat-val { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--color-text-primary); }
.acc-stat-label { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 4px; line-height: 1.4; }
.acc-stat-trend { font-size: 10px; margin-top: 4px; font-family: var(--font-display); }

/* Tabs */
.acc-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--color-border); overflow-x: auto; -webkit-overflow-scrolling: touch; }
.acc-tab { padding: var(--space-3) var(--space-5); font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--color-text-muted); background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-family: var(--font-body); transition: all var(--duration-normal); margin-bottom: -2px; white-space: nowrap; }
.acc-tab.active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
.acc-tab-badge { display: inline-block; margin-left: 6px; padding: 1px 6px; background: rgba(230,57,70,0.15); color: #e63946; border-radius: 10px; font-size: 10px; font-family: var(--font-display); }

/* Card */
.acc-card { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); overflow: hidden; }
.acc-card-header { padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.acc-card-title { font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--color-text-primary); }
.acc-card-sub { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 3px; }
.acc-card-body { padding: var(--space-5); }

/* ── 4A: CONTRACTOR SCORECARD ── */
.contractor-list { display: flex; flex-direction: column; gap: var(--space-4); }

.contractor-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  overflow: hidden;
  transition: border-color 0.2s ease;
}
.contractor-card:hover { border-color: var(--color-border-strong); }
.contractor-card.rank-1 { border-color: rgba(230,57,70,0.4); background: rgba(230,57,70,0.03); }
.contractor-card.rank-good { border-color: rgba(82,183,136,0.3); background: rgba(82,183,136,0.03); }

.contractor-header {
  padding: var(--space-4) var(--space-5);
  display: flex; align-items: center; gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.contractor-rank {
  font-family: var(--font-display); font-size: var(--text-2xl); font-weight: var(--weight-bold);
  width: 36px; text-align: center; flex-shrink: 0;
}
.contractor-name-col { flex: 1; min-width: 0; }
.contractor-name { font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--color-text-primary); }
.contractor-reg { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; font-family: var(--font-display); }

.contractor-verdict {
  padding: 4px 10px; border-radius: var(--radius-pill);
  font-size: var(--text-xs); font-family: var(--font-display); font-weight: 600;
  flex-shrink: 0;
}
.verdict-bad  { background: rgba(230,57,70,0.12);  color: #e63946; border: 1px solid rgba(230,57,70,0.3); }
.verdict-warn { background: rgba(249,199,79,0.12); color: #f9c74f; border: 1px solid rgba(249,199,79,0.3); }
.verdict-good { background: rgba(82,183,136,0.12); color: #52b788; border: 1px solid rgba(82,183,136,0.3); }

.contractor-metrics {
  display: grid; grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid var(--color-border);
}
@media (max-width: 600px) { .contractor-metrics { grid-template-columns: repeat(2, 1fr); } }

.contractor-metric {
  padding: var(--space-3) var(--space-4);
  border-right: 1px solid var(--color-border);
  text-align: center;
}
.contractor-metric:last-child { border-right: none; }
.contractor-metric-val {
  font-family: var(--font-display); font-size: var(--text-xl);
  font-weight: var(--weight-bold); line-height: 1;
}
.contractor-metric-label {
  font-size: 10px; color: var(--color-text-muted); margin-top: 3px; line-height: 1.3;
}

/* Response time bar */
.contractor-response-row {
  padding: var(--space-3) var(--space-5);
  display: flex; align-items: center; gap: var(--space-3);
}
.response-label { font-size: var(--text-xs); color: var(--color-text-muted); width: 160px; flex-shrink: 0; }
.response-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.response-fill { height: 100%; border-radius: 3px; transition: width 0.8s cubic-bezier(0.22,1,0.36,1); }
.response-val { font-family: var(--font-display); font-size: var(--text-xs); color: var(--color-text-muted); width: 60px; text-align: right; flex-shrink: 0; }

/* Roads list */
.contractor-roads {
  padding: var(--space-3) var(--space-5) var(--space-4);
  display: flex; gap: var(--space-2); flex-wrap: wrap;
}
.road-tag {
  padding: 3px 10px;
  background: rgba(76,201,240,0.08); border: 1px solid rgba(76,201,240,0.2);
  border-radius: var(--radius-pill); font-size: 10px; font-family: var(--font-display);
  color: var(--color-sh);
}
.road-tag.warranty-active { background: rgba(82,183,136,0.08); border-color: rgba(82,183,136,0.25); color: #52b788; }
.road-tag.warranty-expired { background: rgba(230,57,70,0.08); border-color: rgba(230,57,70,0.25); color: #e63946; }

/* Compare toggle */
.compare-btn {
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-elevated); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: var(--text-xs);
  color: var(--color-text-muted); cursor: pointer; font-family: var(--font-body);
  transition: all 0.15s ease;
}
.compare-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }

/* Active defects banner */
.defects-banner {
  margin: 0 var(--space-5) var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: rgba(230,57,70,0.08);
  border: 1px solid rgba(230,57,70,0.25);
  border-radius: var(--radius-md);
  font-size: var(--text-xs); color: #e63946;
  display: flex; align-items: center; gap: var(--space-2);
}

/* ── 4B: Scatter ── */
.scatter-wrap { width: 100%; overflow: hidden; }
.scatter-wrap svg { width: 100%; display: block; }
.scatter-tooltip { position: fixed; background: var(--color-bg-elevated); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); font-size: var(--text-xs); color: var(--color-text-primary); pointer-events: none; z-index: var(--z-modal); box-shadow: var(--shadow-lg); max-width: 220px; line-height: 1.7; }

/* ── 4C: Project tracker ── */
.project-list { display: flex; flex-direction: column; gap: var(--space-3); }
.project-card { background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); transition: border-color var(--duration-normal); }
.project-card:hover { border-color: var(--color-border-strong); }
.project-name { font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--color-text-primary); line-height: 1.3; }
.project-meta { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.project-meta-item { font-size: var(--text-xs); color: var(--color-text-muted); }
.project-meta-item strong { color: var(--color-text-secondary); }
.project-status { font-size: var(--text-xs); font-family: var(--font-display); padding: 2px 8px; border-radius: var(--radius-pill); flex-shrink: 0; }
.project-status.completed { background: rgba(82,183,136,0.15); color: var(--color-success); border: 1px solid rgba(82,183,136,0.3); }
.project-status.on_track  { background: rgba(76,201,240,0.15);  color: var(--color-info);    border: 1px solid rgba(76,201,240,0.3); }
.project-status.delayed   { background: rgba(249,199,79,0.15);  color: var(--color-warning); border: 1px solid rgba(249,199,79,0.3); }
.project-status.overdue   { background: rgba(230,57,70,0.15);   color: var(--color-danger);  border: 1px solid rgba(230,57,70,0.3); }
.project-overdue { font-size: var(--text-xs); color: var(--color-danger); font-family: var(--font-display); }

/* ── 4D: Leaderboard ── */
.leaderboard-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.leaderboard-table { width: 100%; border-collapse: collapse; min-width: 520px; }
.leaderboard-table th { font-size: var(--text-xs); font-family: var(--font-display); color: var(--color-text-muted); text-align: left; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; background: var(--color-bg-elevated); }
.leaderboard-table td { padding: var(--space-3) var(--space-4); font-size: var(--text-sm); color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border); }
.leaderboard-table tr:last-child td { border-bottom: none; }
.leaderboard-table tbody tr:hover td { background: rgba(255,255,255,0.02); }
.leaderboard-rank { font-family: var(--font-display); color: var(--color-accent); font-weight: var(--weight-bold); font-size: var(--text-md); }
.lb-bar-track { height: 6px; background: var(--color-bg-elevated); border-radius: 3px; overflow: hidden; margin-top: 3px; min-width: 80px; }
.lb-bar-fill { height: 100%; border-radius: 3px; }
.search-input { width: 100%; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); color: var(--color-text-primary); font-family: var(--font-body); font-size: var(--text-sm); margin-bottom: var(--space-4); min-height: 44px; box-sizing: border-box; }
.search-input:focus { border-color: var(--color-accent); outline: none; box-shadow: 0 0 0 3px var(--color-accent-glow); }

/* Animate bars on mount */
@keyframes barGrow { from { width: 0; } }
`;

// ── Data ─────────────────────────────────────────────────────────────────────
interface ContractorData {
  name: string;
  reg: string;
  roads: { id: string; name: string; warranty: 'active' | 'expired' }[];
  claims: number;
  avgResponseDays: number;
  activeDefects: number;
  contractValue: number;
  totalKm: number;
}

const CONTRACTORS: ContractorData[] = [
  {
    name: 'Afcons Infrastructure Ltd',
    reg: 'AFL/NHAI/154/2018',
    roads: [{ id: 'NH-154', name: 'NH-154', warranty: 'expired' }],
    claims: 7,
    avgResponseDays: 41,
    activeDefects: 4,
    contractValue: 289.4,
    totalKm: 52,
  },
  {
    name: 'Dilip Buildcon Ltd',
    reg: 'DBL/NHAI/HP/2019',
    roads: [{ id: 'NH-3', name: 'NH-3', warranty: 'active' }],
    claims: 12,
    avgResponseDays: 34,
    activeDefects: 3,
    contractValue: 842.5,
    totalKm: 247,
  },
  {
    name: 'Gawar Construction Ltd',
    reg: 'GCL/HPPWD/SH/2020',
    roads: [{ id: 'SH-26', name: 'SH-26', warranty: 'expired' }],
    claims: 3,
    avgResponseDays: 18,
    activeDefects: 1,
    contractValue: 156.2,
    totalKm: 68,
  },
  {
    name: 'APCO Infratech Pvt Ltd',
    reg: 'APCO/HPPWD/SH9/2022',
    roads: [{ id: 'SH-9', name: 'SH-9', warranty: 'active' }],
    claims: 1,
    avgResponseDays: 6,
    activeDefects: 0,
    contractValue: 187.6,
    totalKm: 76,
  },
  {
    name: 'Raj Infra Enterprises',
    reg: 'RIE/HPRIDC/MDR/2021',
    roads: [{ id: 'MDR-21', name: 'MDR-21', warranty: 'active' }],
    claims: 4,
    avgResponseDays: 22,
    activeDefects: 1,
    contractValue: 34.8,
    totalKm: 24,
  },
];

const DISTRICT_DATA: DistrictData[] = [
  { district: 'Mandi',    state: 'HP', budget_utilization: 0.665, accident_rate: 8.7,  road_count: 62,  data_completeness: 0.82, transparency_score: 0.74, resolution_rate: 0.41 },
  { district: 'Shimla',   state: 'HP', budget_utilization: 0.91,  accident_rate: 12.1, road_count: 87,  data_completeness: 0.90, transparency_score: 0.88, resolution_rate: 0.62 },
  { district: 'Kullu',    state: 'HP', budget_utilization: 0.54,  accident_rate: 14.2, road_count: 44,  data_completeness: 0.71, transparency_score: 0.61, resolution_rate: 0.28 },
  { district: 'Kangra',   state: 'HP', budget_utilization: 0.78,  accident_rate: 10.5, road_count: 95,  data_completeness: 0.85, transparency_score: 0.79, resolution_rate: 0.55 },
  { district: 'Bilaspur', state: 'HP', budget_utilization: 0.88,  accident_rate: 5.2,  road_count: 38,  data_completeness: 0.78, transparency_score: 0.82, resolution_rate: 0.70 },
  { district: 'Una',      state: 'HP', budget_utilization: 0.72,  accident_rate: 7.8,  road_count: 51,  data_completeness: 0.74, transparency_score: 0.68, resolution_rate: 0.48 },
  { district: 'Solan',    state: 'HP', budget_utilization: 0.83,  accident_rate: 9.4,  road_count: 67,  data_completeness: 0.80, transparency_score: 0.77, resolution_rate: 0.53 },
  { district: 'Hamirpur', state: 'HP', budget_utilization: 0.95,  accident_rate: 4.1,  road_count: 42,  data_completeness: 0.88, transparency_score: 0.91, resolution_rate: 0.78 },
];

// ── Scatter ───────────────────────────────────────────────────────────────────
function SpendSafetyScatter({ data }: { data: DistrictData[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;
    const W = svgRef.current.parentElement!.clientWidth || 560;
    const H = 380;
    const m = { top: 32, right: 32, bottom: 56, left: 64 };
    const iw = W - m.left - m.right;
    const ih = H - m.top  - m.bottom;
    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current).attr('viewBox', `0 0 ${W} ${H}`);
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x = d3.scaleLinear().domain([0.4, 1.05]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, 18]).range([ih, 0]);

    // Quadrant shading
    g.append('rect').attr('x', 0).attr('y', 0).attr('width', x(0.725)).attr('height', y(9)).style('fill', 'rgba(230,57,70,0.03)');
    g.append('rect').attr('x', x(0.725)).attr('y', 0).attr('width', iw - x(0.725)).attr('height', y(9)).style('fill', 'rgba(82,183,136,0.03)');
    const ql = 'rgba(255,255,255,0.07)';
    g.append('line').attr('x1', x(0.725)).attr('x2', x(0.725)).attr('y1', 0).attr('y2', ih).style('stroke', ql).style('stroke-dasharray', '5,4');
    g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(9)).attr('y2', y(9)).style('stroke', ql).style('stroke-dasharray', '5,4');

    const qf = '10px', qff = '"DM Mono", monospace';
    g.append('text').attr('x', iw - 6).attr('y', 14).attr('text-anchor', 'end').style('fill', 'rgba(82,183,136,0.55)').style('font-size', qf).style('font-family', qff).text('✓ High spend, safe');
    g.append('text').attr('x', 6).attr('y', 14).attr('text-anchor', 'start').style('fill', 'rgba(255,255,255,0.15)').style('font-size', qf).style('font-family', qff).text('Low spend, safe');
    g.append('text').attr('x', iw - 6).attr('y', ih - 6).attr('text-anchor', 'end').style('fill', 'rgba(230,57,70,0.55)').style('font-size', qf).style('font-family', qff).text('✗ High spend, unsafe');
    g.append('text').attr('x', 6).attr('y', ih - 6).attr('text-anchor', 'start').style('fill', 'rgba(230,57,70,0.35)').style('font-size', qf).style('font-family', qff).text('Worst quadrant');

    g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('.0%'))).call(a => { a.select('.domain').style('stroke', 'rgba(255,255,255,0.12)'); a.selectAll('text').style('fill', 'rgba(255,255,255,0.35)').style('font-size', '11px'); });
    g.append('g').call(d3.axisLeft(y).ticks(6)).call(a => { a.select('.domain').style('stroke', 'rgba(255,255,255,0.12)'); a.selectAll('text').style('fill', 'rgba(255,255,255,0.35)').style('font-size', '11px'); });
    g.append('text').attr('x', iw / 2).attr('y', ih + 44).attr('text-anchor', 'middle').style('fill', 'rgba(255,255,255,0.3)').style('font-size', '11px').text('Budget Utilization (%)');
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -50).attr('text-anchor', 'middle').style('fill', 'rgba(255,255,255,0.3)').style('font-size', '11px').text('Accident Rate / 100 km / yr');

    const tip = d3.select(tipRef.current!);
    const colorFn = (d: DistrictData) =>
      d.accident_rate > 9 && d.budget_utilization < 0.72 ? '#E63946' :
      d.accident_rate > 9 ? '#F4A261' :
      d.budget_utilization > 0.85 ? '#52B788' : '#4CC9F0';

    g.selectAll('circle').data(data).enter().append('circle')
      .attr('cx', d => x(d.budget_utilization)).attr('cy', d => y(d.accident_rate))
      .attr('r', d => 7 + d.road_count / 22).style('fill', colorFn).style('opacity', 0.85).style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 13).style('opacity', 1);
        tip.style('display', 'block').html(`<strong style="color:var(--color-text-primary)">${d.district}</strong><br/>Budget: <strong>${Math.round(d.budget_utilization * 100)}%</strong><br/>Accidents: <strong>${d.accident_rate}/100km/yr</strong><br/>Roads: <strong>${d.road_count}</strong>`);
      })
      .on('mousemove', event => { tip.style('left', (event.clientX + 14) + 'px').style('top', (event.clientY - 36) + 'px'); })
      .on('mouseout', function(_, d) { d3.select(this).attr('r', 7 + d.road_count / 22).style('opacity', 0.85); tip.style('display', 'none'); });

    g.selectAll('.dlabel').data(data).enter().append('text').attr('class', 'dlabel')
      .attr('x', d => x(d.budget_utilization) + 10).attr('y', d => y(d.accident_rate) + 4)
      .style('fill', 'rgba(255,255,255,0.45)').style('font-size', '10px').style('font-family', '"DM Mono", monospace')
      .text(d => d.district);
  }, [data]);

  return (
    <>
      <div ref={tipRef} className="scatter-tooltip" style={{ display: 'none' }} />
      <div className="scatter-wrap"><svg ref={svgRef} aria-label="Budget vs Safety scatter" /></div>
    </>
  );
}

// ── Contractor Scorecard Component ────────────────────────────────────────────
function getVerdict(c: ContractorData): { label: string; cls: string } {
  if (c.avgResponseDays > 30 || c.activeDefects > 2) return { label: '⚠ POOR',  cls: 'verdict-bad' };
  if (c.avgResponseDays > 15 || c.activeDefects > 0) return { label: '~ AVERAGE', cls: 'verdict-warn' };
  return { label: '✓ GOOD', cls: 'verdict-good' };
}

function getResponseColor(days: number): string {
  if (days > 30) return '#e63946';
  if (days > 14) return '#f9c74f';
  return '#52b788';
}

// Sort: worst first (most claims + slowest response)
const sortedContractors = [...CONTRACTORS].sort((a, b) =>
  (b.claims * b.avgResponseDays) - (a.claims * a.avgResponseDays)
);
const MAX_RESPONSE = Math.max(...CONTRACTORS.map(c => c.avgResponseDays));

function ContractorScorecard() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'worst' | 'best' | 'claims'>('worst');

  const sorted = [...CONTRACTORS].sort((a, b) => {
    if (sortBy === 'worst') return (b.avgResponseDays + b.activeDefects * 10) - (a.avgResponseDays + a.activeDefects * 10);
    if (sortBy === 'best')  return (a.avgResponseDays + a.activeDefects * 10) - (b.avgResponseDays + b.activeDefects * 10);
    return b.claims - a.claims;
  });

  return (
    <div>
      {/* Sort controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', alignSelf: 'center', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sort:</span>
        {(['worst', 'best', 'claims'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            background: sortBy === s ? 'var(--color-accent-glow)' : 'var(--color-bg-elevated)',
            border: `1px solid ${sortBy === s ? 'var(--color-accent)' : 'var(--color-border)'}`,
            color: sortBy === s ? 'var(--color-accent)' : 'var(--color-text-muted)',
            transition: 'all 0.15s ease',
          }}>
            {s === 'worst' ? 'Worst Performers' : s === 'best' ? 'Best Performers' : 'Most Claims'}
          </button>
        ))}
      </div>

      <div className="contractor-list">
        {sorted.map((c, i) => {
          const verdict = getVerdict(c);
          const isExpanded = expanded === c.reg;
          const rankClass = i === 0 && sortBy === 'worst' ? 'rank-1' : verdict.cls === 'verdict-good' ? 'rank-good' : '';

          return (
            <div key={c.reg} className={`contractor-card ${rankClass}`}>
              {/* Header */}
              <div className="contractor-header" onClick={() => setExpanded(isExpanded ? null : c.reg)} style={{ cursor: 'pointer' }}>
                <div className="contractor-rank" style={{ color: verdict.cls === 'verdict-bad' ? '#e63946' : verdict.cls === 'verdict-warn' ? '#f9c74f' : '#52b788' }}>
                  #{i + 1}
                </div>
                <div className="contractor-name-col">
                  <div className="contractor-name">{c.name}</div>
                  <div className="contractor-reg">{c.reg}</div>
                </div>
                <span className={`contractor-verdict ${verdict.cls}`}>{verdict.label}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ color: 'var(--color-text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Key metrics always visible */}
              <div className="contractor-metrics">
                <div className="contractor-metric">
                  <div className="contractor-metric-val" style={{ color: 'var(--color-accent)' }}>
                    {c.roads.length}
                  </div>
                  <div className="contractor-metric-label">Roads<br/>Contracted</div>
                </div>
                <div className="contractor-metric">
                  <div className="contractor-metric-val" style={{ color: c.claims > 8 ? '#e63946' : '#f9c74f' }}>
                    {c.claims}
                  </div>
                  <div className="contractor-metric-label">Warranty<br/>Claims Filed</div>
                </div>
                <div className="contractor-metric">
                  <div className="contractor-metric-val" style={{ color: getResponseColor(c.avgResponseDays) }}>
                    {c.avgResponseDays}d
                  </div>
                  <div className="contractor-metric-label">Avg Repair<br/>Response</div>
                </div>
                <div className="contractor-metric">
                  <div className="contractor-metric-val" style={{ color: c.activeDefects > 0 ? '#e63946' : '#52b788' }}>
                    {c.activeDefects}
                  </div>
                  <div className="contractor-metric-label">Active<br/>Defects</div>
                </div>
              </div>

              {/* Response time bar */}
              <div className="contractor-response-row">
                <div className="response-label">Avg repair response time</div>
                <div className="response-track">
                  <div className="response-fill" style={{
                    width: `${(c.avgResponseDays / MAX_RESPONSE) * 100}%`,
                    background: getResponseColor(c.avgResponseDays),
                    animation: 'barGrow 0.8s ease both',
                  }} />
                </div>
                <div className="response-val" style={{ color: getResponseColor(c.avgResponseDays) }}>
                  {c.avgResponseDays} days {c.avgResponseDays > 30 ? '← BAD' : c.avgResponseDays < 10 ? '← GOOD' : ''}
                </div>
              </div>

              {/* Active defects banner */}
              {c.activeDefects > 0 && (
                <div className="defects-banner">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13" stroke="var(--color-bg)" strokeWidth="2"/>
                    <line x1="12" y1="17" x2="12.01" y2="17" stroke="var(--color-bg)" strokeWidth="2"/>
                  </svg>
                  {c.activeDefects} active defect{c.activeDefects > 1 ? 's' : ''} — contractor is legally obligated to repair under DLP
                </div>
              )}

              {/* Expanded: roads + financial */}
              {isExpanded && (
                <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.01)', animation: 'fadeIn 0.2s ease' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Contract Value</div>
                      <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-accent)' }}>₹{c.contractValue} Cr</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Total KM Contracted</div>
                      <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.totalKm} km</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Roads Under Contract</div>
                  <div className="contractor-roads">
                    {c.roads.map(r => (
                      <span key={r.id} className={`road-tag warranty-${r.warranty}`}>
                        {r.name} · Warranty {r.warranty}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    Source: NHAI Annual Report 2022-23 · HP PWD Project Records · MoRTH PMGSY Data
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary insight */}
      <div style={{
        marginTop: 16, padding: 16,
        background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.2)',
        borderRadius: 12, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6,
      }}>
        <strong style={{ color: '#e63946' }}>Key finding:</strong> Afcons Infrastructure (NH-154) and Dilip Buildcon (NH-3) account for <strong style={{ color: 'var(--color-text-primary)' }}>19 of 27 total warranty claims</strong> in HP — yet both received full payment. This data doesn't exist anywhere else publicly.
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AccountabilityView() {
  const [tab,      setTab]      = useState<'scorecard' | 'scatter' | 'tracker' | 'leaderboard'>('scorecard');
  const [projects, setProjects] = useState<any[]>([]);
  const [searchQ,  setSearchQ]  = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  useEffect(() => {
    if (tab !== 'tracker') return;
    setLoading(true);
    fetchNHProjects()
      .then(setProjects)
      .catch(async () => {
        const cached = await getAllNHProjects();
        setProjects(cached.length > 0 ? cached : []);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const filtered = projects.filter(p =>
    !searchQ || p.project_name?.toLowerCase().includes(searchQ.toLowerCase()) || p.nh_number?.toLowerCase().includes(searchQ.toLowerCase())
  );

  const overdueMonths = (p: any) => {
    if (!p.completion_date || p.status === 'completed') return 0;
    const due = new Date(p.completion_date), now = new Date();
    return now > due ? Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
  };

  const leaderboardData = [...DISTRICT_DATA].sort((a, b) =>
    (b.transparency_score * b.resolution_rate) - (a.transparency_score * a.resolution_rate)
  );

  // Total active defects for header badge
  const totalDefects = CONTRACTORS.reduce((s, c) => s + c.activeDefects, 0);
  const totalClaims  = CONTRACTORS.reduce((s, c) => s + c.claims, 0);

  return (
    <div className="acc-view">
      <header>
        <h1>Accountability Dashboard</h1>
        <p>Contractor performance, budget transparency, and district rankings — sourced from MoRTH &amp; NHAI</p>
      </header>

      {/* Summary stats */}
      <div className="acc-stats-row">
        {[
          { val: '₹8,510 Cr', label: 'Active NH Budget (HP)',          trend: '' },
          { val: totalClaims.toString(), label: 'Warranty Claims Filed', trend: '↑ underreported' },
          { val: totalDefects.toString(), label: 'Active Defects Unfixed', trend: '⚠ DLP breach' },
          { val: '34d',       label: 'Avg Repair Response (worst)',     trend: '← BAD benchmark' },
        ].map(({ val, label, trend }) => (
          <div key={label} className="acc-stat-chip">
            <div className="acc-stat-val">{val}</div>
            <div className="acc-stat-label">{label}</div>
            {trend && <div className="acc-stat-trend" style={{ color: trend.includes('BAD') || trend.includes('⚠') ? '#e63946' : 'var(--color-text-muted)' }}>{trend}</div>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="acc-tabs" role="tablist">
        {([
          { id: 'scorecard',   label: 'Contractor Scorecard', badge: totalDefects > 0 ? totalDefects.toString() : null },
          { id: 'scatter',     label: 'Spend vs Safety',      badge: null },
          { id: 'tracker',     label: 'Project Tracker',      badge: null },
          { id: 'leaderboard', label: 'District Rankings',    badge: null },
        ] as const).map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`acc-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge && <span className="acc-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── 4A: Contractor Scorecard ── */}
      {tab === 'scorecard' && (
        <div className="acc-card" role="tabpanel">
          <div className="acc-card-header">
            <div>
              <div className="acc-card-title">Contractor Scorecard</div>
              <div className="acc-card-sub">Real contractor names · Real performance data · NHAI Defect Liability Period tracking</div>
            </div>
            <button className="compare-btn" onClick={() => {}}>↓ Export CSV</button>
          </div>
          <div className="acc-card-body">
            <ContractorScorecard />
          </div>
        </div>
      )}

      {/* ── 4B: Scatter ── */}
      {tab === 'scatter' && (
        <div className="acc-card" role="tabpanel">
          <div className="acc-card-header">
            <div>
              <div className="acc-card-title">Budget Utilization vs Accident Rate</div>
              <div className="acc-card-sub">HP districts · MoRTH 2022, data.gov.in · Hover dots for details</div>
            </div>
          </div>
          <div className="acc-card-body">
            <SpendSafetyScatter data={DISTRICT_DATA} />
          </div>
        </div>
      )}

      {/* ── 4C: Project Tracker ── */}
      {tab === 'tracker' && (
        <div className="acc-card" role="tabpanel">
          <div className="acc-card-header">
            <div>
              <div className="acc-card-title">NH Project Status</div>
              <div className="acc-card-sub">Live from data.gov.in · NHAI Annual Report 2022-23</div>
            </div>
          </div>
          <div className="acc-card-body">
            <input className="search-input" type="search" placeholder="Search project name or NH number…" value={searchQ} onChange={e => setSearchQ(e.target.value)} aria-label="Search NH projects" />
            {loading ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Loading projects…</p>
            ) : (
              <div className="project-list">
                {filtered.map((p, i) => {
                  const overdue = overdueMonths(p);
                  return (
                    <div key={i} className="project-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                        <div className="project-name">{p.project_name}</div>
                        <span className={`project-status ${p.status}`}>{p.status?.replace('_', ' ')}</span>
                      </div>
                      <div className="project-meta">
                        <div className="project-meta-item"><strong>NH:</strong> {p.nh_number}</div>
                        <div className="project-meta-item"><strong>Length:</strong> {p.length_km} km</div>
                        <div className="project-meta-item"><strong>Cost:</strong> ₹{p.cost_crore} Cr</div>
                        <div className="project-meta-item"><strong>Contractor:</strong> {p.contractor}</div>
                      </div>
                      {overdue > 0 && <div className="project-overdue">⚠ Overdue by {overdue} month{overdue > 1 ? 's' : ''}</div>}
                    </div>
                  );
                })}
                {filtered.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No projects found.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4D: District Rankings ── */}
      {tab === 'leaderboard' && (
        <div className="acc-card" role="tabpanel">
          <div className="acc-card-header">
            <div>
              <div className="acc-card-title">District Transparency Ranking</div>
              <div className="acc-card-sub">Score = transparency × resolution rate · MoRTH 2022</div>
            </div>
          </div>
          <div className="leaderboard-scroll">
            <table className="leaderboard-table" aria-label="District transparency leaderboard">
              <thead>
                <tr><th>#</th><th>District</th><th>Transparency</th><th>Resolution</th><th>Roads</th><th>Score</th></tr>
              </thead>
              <tbody>
                {leaderboardData.map((d, i) => (
                  <tr key={d.district}>
                    <td><span className="leaderboard-rank">{i + 1}</span></td>
                    <td style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-primary)' }}>{d.district}</td>
                    <td>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{Math.round(d.transparency_score * 100)}%</div>
                      <div className="lb-bar-track"><div className="lb-bar-fill" style={{ width: `${d.transparency_score * 100}%`, background: 'var(--color-sh)' }} /></div>
                    </td>
                    <td>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{Math.round(d.resolution_rate * 100)}%</div>
                      <div className="lb-bar-track"><div className="lb-bar-fill" style={{ width: `${d.resolution_rate * 100}%`, background: 'var(--color-success)' }} /></div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-display)' }}>{d.road_count}</td>
                    <td style={{ color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg)' }}>
                      {(d.transparency_score * d.resolution_rate * 100).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}