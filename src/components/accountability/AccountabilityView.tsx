import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchNHProjects } from '../../lib/live-data';
import { getAllNHProjects } from '../../lib/offline-db';
import type { DistrictData } from '../../types';

const css = `
.acc-view { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-6); max-width: 960px; margin: 0 auto; width: 100%; }
.acc-view h1 { font-size: var(--text-xl); color: var(--color-text-primary); margin-bottom: 2px; }
.acc-view > header p { font-size: var(--text-sm); color: var(--color-text-muted); }
.acc-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); }
@media (max-width: 640px) { .acc-stats-row { grid-template-columns: repeat(2, 1fr); } }
.acc-stat-chip { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: var(--space-4) var(--space-5); }
.acc-stat-val { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--color-text-primary); }
.acc-stat-label { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 4px; line-height: 1.4; }
.acc-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--color-border); }
.acc-tab { padding: var(--space-3) var(--space-5); font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--color-text-muted); background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-family: var(--font-body); transition: all var(--duration-normal); margin-bottom: -2px; white-space: nowrap; }
.acc-tab.active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
.acc-card { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); overflow: hidden; }
.acc-card-header { padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); }
.acc-card-title { font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--color-text-primary); }
.acc-card-sub { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 3px; }
.acc-card-body { padding: var(--space-5); }
.scatter-wrap { width: 100%; overflow: hidden; }
.scatter-wrap svg { width: 100%; display: block; }
.scatter-tooltip { position: fixed; background: var(--color-bg-elevated); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); font-size: var(--text-xs); color: var(--color-text-primary); pointer-events: none; z-index: var(--z-modal); box-shadow: var(--shadow-lg); max-width: 220px; line-height: 1.7; }
.project-list { display: flex; flex-direction: column; gap: var(--space-3); }
.project-card { background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); transition: border-color var(--duration-normal); }
.project-card:hover { border-color: var(--color-border-strong); }
.project-name { font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--color-text-primary); line-height: 1.3; }
.project-meta { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.project-meta-item { font-size: var(--text-xs); color: var(--color-text-muted); }
.project-meta-item strong { color: var(--color-text-secondary); }
.project-status { font-size: var(--text-xs); font-family: var(--font-display); padding: 2px 8px; border-radius: var(--radius-pill); flex-shrink: 0; }
.project-status.completed  { background: rgba(82,183,136,0.15); color: var(--color-success); border: 1px solid rgba(82,183,136,0.3); }
.project-status.on_track   { background: rgba(76,201,240,0.15); color: var(--color-info); border: 1px solid rgba(76,201,240,0.3); }
.project-status.delayed    { background: rgba(249,199,79,0.15); color: var(--color-warning); border: 1px solid rgba(249,199,79,0.3); }
.project-status.overdue    { background: rgba(230,57,70,0.15); color: var(--color-danger); border: 1px solid rgba(230,57,70,0.3); }
.project-overdue { font-size: var(--text-xs); color: var(--color-danger); font-family: var(--font-display); }
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
`;

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

function SpendSafetyScatter({ data }: { data: DistrictData[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const W = svgRef.current.parentElement!.clientWidth || 560;
    const H = 420;
    const margin = { top: 32, right: 32, bottom: 56, left: 64 };
    const iw = W - margin.left - margin.right;
    const ih = H - margin.top  - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('aria-label', 'Scatter: Budget utilization vs Accident rate by district');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0.4, 1.05]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, 18]).range([ih, 0]);

    // Quadrant shading
    g.append('rect').attr('x', 0).attr('y', 0).attr('width', x(0.725)).attr('height', y(9))
      .style('fill', 'rgba(230,57,70,0.04)');
    g.append('rect').attr('x', x(0.725)).attr('y', 0).attr('width', iw - x(0.725)).attr('height', y(9))
      .style('fill', 'rgba(82,183,136,0.04)');

    // Quadrant dividers
    const ql = 'rgba(255,255,255,0.08)';
    g.append('line').attr('x1', x(0.725)).attr('x2', x(0.725)).attr('y1', 0).attr('y2', ih).style('stroke', ql).style('stroke-dasharray', '5,4');
    g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(9)).attr('y2', y(9)).style('stroke', ql).style('stroke-dasharray', '5,4');

    // Quadrant labels
    const qf = 'rgba(255,255,255,0.18)', qfs = '10px', qff = '"DM Mono", monospace';
    g.append('text').attr('x', iw - 6).attr('y', 14).attr('text-anchor', 'end').style('fill', 'rgba(82,183,136,0.6)').style('font-size', qfs).style('font-family', qff).text('✓ High spend, safe');
    g.append('text').attr('x', 6).attr('y', 14).attr('text-anchor', 'start').style('fill', qf).style('font-size', qfs).style('font-family', qff).text('Low spend, safe');
    g.append('text').attr('x', iw - 6).attr('y', ih - 6).attr('text-anchor', 'end').style('fill', 'rgba(230,57,70,0.6)').style('font-size', qfs).style('font-family', qff).text('✗ High spend, unsafe');
    g.append('text').attr('x', 6).attr('y', ih - 6).attr('text-anchor', 'start').style('fill', 'rgba(230,57,70,0.4)').style('font-size', qfs).style('font-family', qff).text('Worst quadrant');

    // Axes
    g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('.0%')))
      .call((a) => { a.select('.domain').style('stroke', 'rgba(255,255,255,0.15)'); a.selectAll('text').style('fill', 'rgba(255,255,255,0.4)').style('font-size', '11px'); });
    g.append('g').call(d3.axisLeft(y).ticks(6))
      .call((a) => { a.select('.domain').style('stroke', 'rgba(255,255,255,0.15)'); a.selectAll('text').style('fill', 'rgba(255,255,255,0.4)').style('font-size', '11px'); });
    g.append('text').attr('x', iw / 2).attr('y', ih + 44).attr('text-anchor', 'middle').style('fill', 'rgba(255,255,255,0.35)').style('font-size', '11px').text('Budget Utilization (%)');
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -50).attr('text-anchor', 'middle').style('fill', 'rgba(255,255,255,0.35)').style('font-size', '11px').text('Accident Rate / 100 km / yr');

    const tip = d3.select(tipRef.current!);
    const colorFn = (d: DistrictData) =>
      d.accident_rate > 9 && d.budget_utilization < 0.72 ? '#E63946' :
      d.accident_rate > 9 ? '#F4A261' :
      d.budget_utilization > 0.85 ? '#52B788' : '#4CC9F0';

    g.selectAll('circle').data(data).enter().append('circle')
      .attr('cx', (d) => x(d.budget_utilization)).attr('cy', (d) => y(d.accident_rate))
      .attr('r', (d) => 7 + d.road_count / 22)
      .style('fill', colorFn).style('opacity', 0.85).style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('r', 13).style('opacity', 1);
        tip.style('display', 'block').html(
          `<strong style="color:var(--color-text-primary)">${d.district}</strong><br/>
           Budget used: <strong>${Math.round(d.budget_utilization * 100)}%</strong><br/>
           Accidents: <strong>${d.accident_rate}/100km/yr</strong><br/>
           Roads: <strong>${d.road_count}</strong>`
        );
      })
      .on('mousemove', (event) => { tip.style('left', (event.clientX + 14) + 'px').style('top', (event.clientY - 36) + 'px'); })
      .on('mouseout', function (_, d) { d3.select(this).attr('r', 7 + d.road_count / 22).style('opacity', 0.85); tip.style('display', 'none'); });

    g.selectAll('.district-label').data(data).enter().append('text')
      .attr('class', 'district-label')
      .attr('x', (d) => x(d.budget_utilization) + 10).attr('y', (d) => y(d.accident_rate) + 4)
      .style('fill', 'rgba(255,255,255,0.55)').style('font-size', '10px').style('font-family', '"DM Mono", monospace')
      .text((d) => d.district);
  }, [data]);

  return (
    <>
      <div ref={tipRef} className="scatter-tooltip" style={{ display: 'none' }} />
      <div className="scatter-wrap">
        <svg ref={svgRef} aria-label="Budget vs Safety scatter" />
      </div>
    </>
  );
}

export default function AccountabilityView() {
  const [tab,     setTab]     = useState<'scatter' | 'tracker' | 'leaderboard'>('scatter');
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

  const filtered = projects.filter((p) =>
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

  return (
    <div className="acc-view">
      <header>
        <h1>Accountability Dashboard</h1>
        <p>Budget transparency, project tracking, and district rankings — sourced from MoRTH &amp; NHAI</p>
      </header>

      {/* Summary stats */}
      <div className="acc-stats-row">
        {[
          { val: '₹8,510 Cr', label: 'Active NH Budget (HP)' },
          { val: '4',         label: 'Projects Tracked' },
          { val: '78%',       label: 'Avg Budget Utilization' },
          { val: '312',       label: 'Accidents (Mandi, 2022)' },
        ].map(({ val, label }) => (
          <div key={label} className="acc-stat-chip">
            <div className="acc-stat-val">{val}</div>
            <div className="acc-stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="acc-tabs" role="tablist">
        {(['scatter', 'tracker', 'leaderboard'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t}
            className={`acc-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)} id={`acc-tab-${t}`}>
            {t === 'scatter' ? 'Spend vs Safety' : t === 'tracker' ? 'Project Tracker' : 'District Rankings'}
          </button>
        ))}
      </div>

      {/* Scatter */}
      {tab === 'scatter' && (
        <div className="acc-card" role="tabpanel">
          <div className="acc-card-header">
            <div className="acc-card-title">Budget Utilization vs Accident Rate</div>
            <div className="acc-card-sub">HP districts · MoRTH 2022, data.gov.in · Hover dots for details</div>
          </div>
          <div className="acc-card-body">
            <SpendSafetyScatter data={DISTRICT_DATA} />
          </div>
        </div>
      )}

      {/* Project Tracker */}
      {tab === 'tracker' && (
        <div className="acc-card" role="tabpanel">
          <div className="acc-card-header">
            <div className="acc-card-title">NH Project Status</div>
            <div className="acc-card-sub">Live from data.gov.in · NHAI Annual Report 2022-23</div>
          </div>
          <div className="acc-card-body">
            <input id="project-search" className="search-input" type="search"
              placeholder="Search project name or NH number…"
              value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              aria-label="Search NH projects" />
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

      {/* District Rankings — fully scrollable */}
      {tab === 'leaderboard' && (
        <div className="acc-card" role="tabpanel">
          <div className="acc-card-header">
            <div className="acc-card-title">District Transparency Ranking</div>
            <div className="acc-card-sub">Score = transparency × resolution rate · MoRTH 2022</div>
          </div>
          <div className="leaderboard-scroll">
            <table className="leaderboard-table" aria-label="District transparency leaderboard">
              <thead>
                <tr>
                  <th>#</th>
                  <th>District</th>
                  <th>Transparency</th>
                  <th>Resolution</th>
                  <th>Roads</th>
                  <th>Score</th>
                </tr>
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
