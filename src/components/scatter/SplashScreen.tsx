/**
 * ROADWATCH — Opening Splash Screen
 * Netflix-style cinematic intro. Plays once per session.
 * Call onComplete() when animation finishes.
 */
import { useEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const splashCSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@300;400;600;700;800;900&display=swap');

.splash-root {
  position: fixed; inset: 0; z-index: 9999;
  background: #080a0e;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}

/* ── Animated road grid background ── */
.splash-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(244,162,97,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(244,162,97,0.04) 1px, transparent 1px);
  background-size: 60px 60px;
  animation: gridScroll 8s linear infinite;
}
@keyframes gridScroll {
  0%   { transform: translateY(0); }
  100% { transform: translateY(60px); }
}

/* ── Road lane lines ── */
.splash-road {
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 160px; height: 100%;
  display: flex; flex-direction: column; gap: 0;
  pointer-events: none;
}
.splash-road::before,
.splash-road::after {
  content: '';
  position: absolute; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.08), transparent);
}
.splash-road::before { left: 0; }
.splash-road::after  { right: 0; }

.splash-dash-track {
  position: absolute; left: 50%; top: 0; bottom: 0;
  width: 2px; transform: translateX(-50%);
  overflow: hidden;
}
.splash-dashes {
  display: flex; flex-direction: column; gap: 24px;
  animation: dashScroll 0.6s linear infinite;
  padding-top: 0;
}
.splash-dash {
  width: 2px; height: 40px;
  background: rgba(244,162,97,0.25);
  flex-shrink: 0;
}
@keyframes dashScroll {
  0%   { transform: translateY(0); }
  100% { transform: translateY(64px); }
}

/* ── Core content ── */
.splash-content {
  position: relative; z-index: 10;
  display: flex; flex-direction: column; align-items: center;
  gap: 0;
}

/* Logo animation */
.splash-logo-wrap {
  opacity: 0;
  animation: logoReveal 0.8s cubic-bezier(0.22,1,0.36,1) 0.3s forwards;
}
@keyframes logoReveal {
  from { opacity: 0; transform: scale(0.7) translateY(20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.splash-icon {
  width: 80px; height: 80px;
  border-radius: 24px;
  background: linear-gradient(135deg, #f4a261, #e76f51);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 60px rgba(244,162,97,0.5), 0 0 120px rgba(244,162,97,0.2);
  margin: 0 auto 24px;
  animation: iconPulse 3s ease-in-out 1.5s infinite;
}
@keyframes iconPulse {
  0%, 100% { box-shadow: 0 0 60px rgba(244,162,97,0.5), 0 0 120px rgba(244,162,97,0.2); }
  50%       { box-shadow: 0 0 80px rgba(244,162,97,0.7), 0 0 160px rgba(244,162,97,0.3); }
}

/* Title */
.splash-title-wrap {
  opacity: 0;
  animation: titleReveal 0.9s cubic-bezier(0.22,1,0.36,1) 0.7s forwards;
}
@keyframes titleReveal {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}

.splash-title {
  font-size: clamp(48px, 10vw, 80px);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  text-align: center;
  background: linear-gradient(135deg, #ffffff 0%, #f4a261 50%, #e76f51 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.splash-subtitle {
  margin-top: 10px;
  font-size: clamp(13px, 2.5vw, 16px);
  font-weight: 400;
  color: rgba(255,255,255,0.4);
  text-align: center;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-family: 'DM Mono', monospace;
}

/* Stats ticker */
.splash-stats {
  opacity: 0;
  margin-top: 48px;
  animation: statsReveal 0.7s ease 1.2s forwards;
  display: flex; gap: 32px;
  align-items: center;
}
@keyframes statsReveal {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.splash-stat {
  text-align: center;
}
.splash-stat-val {
  font-size: 28px; font-weight: 800;
  font-family: 'DM Mono', monospace;
  color: #f4a261;
  line-height: 1;
}
.splash-stat-label {
  font-size: 10px; margin-top: 4px;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase; letter-spacing: 0.1em;
}
.splash-stat-divider {
  width: 1px; height: 40px;
  background: rgba(255,255,255,0.08);
}

/* Tagline */
.splash-tagline {
  opacity: 0;
  margin-top: 36px;
  animation: taglineReveal 0.7s ease 1.6s forwards;
  text-align: center;
  max-width: 420px;
  padding: 0 24px;
}
@keyframes taglineReveal {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.splash-tagline p {
  font-size: clamp(14px, 3vw, 18px);
  font-weight: 300;
  color: rgba(255,255,255,0.65);
  line-height: 1.6;
  margin: 0;
}
.splash-tagline strong {
  color: #f4a261;
  font-weight: 600;
}

/* Loading bar */
.splash-progress-wrap {
  opacity: 0;
  margin-top: 56px;
  width: min(340px, 80vw);
  animation: progressReveal 0.5s ease 2s forwards;
}
@keyframes progressReveal {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.splash-progress-label {
  display: flex; justify-content: space-between;
  font-size: 10px; font-family: 'DM Mono', monospace;
  color: rgba(255,255,255,0.25);
  margin-bottom: 8px;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.splash-progress-track {
  height: 2px;
  background: rgba(255,255,255,0.06);
  border-radius: 1px;
  overflow: hidden;
}
.splash-progress-fill {
  height: 100%; border-radius: 1px;
  background: linear-gradient(90deg, #f4a261, #e63946);
  transition: width 0.1s linear;
}

/* Shimmer highlight */
.splash-shimmer {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(244,162,97,0.06) 0%, transparent 70%);
  pointer-events: none;
}

/* Exit animation */
.splash-root.exiting {
  animation: splashExit 0.7s cubic-bezier(0.4,0,1,1) forwards;
}
@keyframes splashExit {
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.04); }
}

/* Scanning lines (cinematic) */
.splash-scanlines {
  position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.03) 2px,
    rgba(0,0,0,0.03) 4px
  );
}

/* Bottom badge */
.splash-badge {
  position: absolute; bottom: 32px;
  display: flex; align-items: center; gap: 8px;
  opacity: 0;
  animation: badgeReveal 0.5s ease 2.2s forwards;
}
@keyframes badgeReveal {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.splash-badge-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #52b788;
  animation: badgeDotPulse 1.5s ease-in-out infinite;
}
@keyframes badgeDotPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
.splash-badge-text {
  font-size: 11px; font-family: 'DM Mono', monospace;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.08em;
}

/* Counter animation helper */
.splash-counter {
  display: inline-block;
}
`;

function useCountUp(target: number, duration: number, startDelay: number) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      let start: number | null = null;
      const step = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        setVal(Math.floor(progress * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, startDelay);
    return () => clearTimeout(timeout);
  }, [target, duration, startDelay]);
  return val;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [exiting,  setExiting]  = useState(false);
  const [label,    setLabel]    = useState('Initialising sensors…');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const potholes  = useCountUp(3_842, 1800, 1400);
  const districts = useCountUp(8,     1200, 1400);
  const roads     = useCountUp(5,     900,  1400);

  const LABELS = [
    'Initialising sensors…',
    'Loading road DNA…',
    'Connecting to NHAI data…',
    'Calibrating risk model…',
    'Ready.',
  ];

  useEffect(() => {
    // Inject CSS
    const el = document.createElement('style');
    el.textContent = splashCSS;
    document.head.appendChild(el);

    // Progress bar: starts at 2s, fills over ~2.5s
    const startAt = 2000;
    const fillDur = 2500;
    const fps = 30;
    const step = 100 / (fillDur / (1000 / fps));

    let cur = 0;
    let labelIdx = 0;

    setTimeout(() => {
      intervalRef.current = setInterval(() => {
        cur = Math.min(cur + step + Math.random() * step * 0.5, 100);
        setProgress(cur);
        const newIdx = Math.min(Math.floor((cur / 100) * LABELS.length), LABELS.length - 1);
        if (newIdx !== labelIdx) { labelIdx = newIdx; setLabel(LABELS[newIdx]); }
        if (cur >= 100) {
          clearInterval(intervalRef.current!);
          // Exit after short pause
          setTimeout(() => {
            setExiting(true);
            setTimeout(onComplete, 700);
          }, 500);
        }
      }, 1000 / fps);
    }, startAt);

    return () => {
      clearInterval(intervalRef.current!);
      document.head.removeChild(el);
    };
  }, []); // eslint-disable-line

  // Build dashes array
  const dashes = Array.from({ length: 24 });

  return (
    <div className={`splash-root${exiting ? ' exiting' : ''}`} role="status" aria-label="RoadWatch loading">
      <div className="splash-scanlines" aria-hidden="true" />
      <div className="splash-shimmer" aria-hidden="true" />
      <div className="splash-grid" aria-hidden="true" />

      {/* Road lane */}
      <div className="splash-road" aria-hidden="true">
        <div className="splash-dash-track">
          <div className="splash-dashes">
            {dashes.map((_, i) => <div key={i} className="splash-dash" />)}
          </div>
        </div>
      </div>

      {/* Core content */}
      <div className="splash-content">
        {/* Icon */}
        <div className="splash-logo-wrap">
          <div className="splash-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <path d="M9 21h6M7 17h10" opacity="0.5" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="splash-title-wrap">
          <div className="splash-title">ROADWATCH</div>
          <div className="splash-subtitle">Road Accountability · Himachal Pradesh</div>
        </div>

        {/* Stats */}
        <div className="splash-stats" aria-label="Key statistics">
          <div className="splash-stat">
            <div className="splash-stat-val">{potholes.toLocaleString('en-IN')}+</div>
            <div className="splash-stat-label">Potholes logged</div>
          </div>
          <div className="splash-stat-divider" />
          <div className="splash-stat">
            <div className="splash-stat-val">{districts}</div>
            <div className="splash-stat-label">HP Districts</div>
          </div>
          <div className="splash-stat-divider" />
          <div className="splash-stat">
            <div className="splash-stat-val">{roads}</div>
            <div className="splash-stat-label">NH roads live</div>
          </div>
        </div>

        {/* Tagline */}
        <div className="splash-tagline">
          <p>
            We don't just detect potholes.<br />
            We <strong>predict</strong> them, <strong>report</strong> them,<br />
            and <strong>hold contractors accountable</strong>.
          </p>
        </div>

        {/* Progress */}
        <div className="splash-progress-wrap">
          <div className="splash-progress-label">
            <span>{label}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="splash-progress-track">
            <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Bottom badge */}
      <div className="splash-badge" aria-hidden="true">
        <div className="splash-badge-dot" />
        <div className="splash-badge-text">100% CLIENT-SIDE · WORKS OFFLINE · NHAI DATA 2022-23</div>
      </div>
    </div>
  );
}