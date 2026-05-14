/**
 * ROADWATCH — Fix Verified Notification System
 * When a road gets fixed, reporters get notified:
 * "Your report contributed to this repair."
 *
 * Channels:
 *  1. In-app celebration toast (animated slide-in)
 *  2. Browser Notification API (works even when tab is backgrounded)
 *  3. Report history card updates to "Fixed ✓" state
 */
import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FixEvent {
  reportId:  string;
  road:      string;
  location:  string;
  fixedDate: string; // ISO string
  authority: string;
  refNo:     string;
}

// ── Browser Notification API helper ──────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

export function fireBrowserNotification(ev: FixEvent) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification('✅ सड़क ठीक हो गई! Road Fixed!', {
    body: `${ev.road} (${ev.location}) — आपकी रिपोर्ट ने यह मरम्मत करवाई।\n"Your report contributed to this repair." Ref #${ev.refNo}`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag:  `fix-${ev.reportId}`,
    requireInteraction: false,
  });
  n.onclick = () => { window.focus(); n.close(); };
}

// ── In-app Toast ──────────────────────────────────────────────────────────────
export function FixVerifiedToast({
  event,
  onDismiss,
}: {
  event: FixEvent;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Mount → slide in
    const t1 = setTimeout(() => setVisible(true), 50);
    // Auto-dismiss after 8 s
    const t2 = setTimeout(() => dismiss(), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 400);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 16, left: '50%',
        transform: `translateX(-50%) translateY(${visible && !exiting ? '0' : '-120px'})`,
        opacity: visible && !exiting ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease',
        zIndex: 9999,
        width: 'min(92vw, 420px)',
        background: 'linear-gradient(135deg, rgba(20,28,20,0.98) 0%, rgba(15,25,20,0.98) 100%)',
        border: '1.5px solid rgba(82,183,136,0.5)',
        borderRadius: 18,
        boxShadow: '0 8px 40px rgba(82,183,136,0.25), 0 2px 12px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
      }}
    >
      {/* Green progress bar at top */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, #52b788, #2d9e6b)',
        animation: 'fixProgress 8s linear forwards',
      }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Checkmark icon */}
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'rgba(82,183,136,0.15)',
            border: '1.5px solid rgba(82,183,136,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            animation: 'fixPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#52b788" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#52b788', fontFamily: 'var(--font-body)', marginBottom: 2 }}>
              सड़क ठीक हो गई ✓
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
              {event.road} · {event.location}
            </div>
          </div>

          <button
            onClick={dismiss}
            aria-label="Dismiss notification"
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Pride message */}
        <div style={{
          margin: '14px 0 0',
          padding: '12px 14px',
          background: 'rgba(82,183,136,0.08)',
          border: '1px solid rgba(82,183,136,0.18)',
          borderRadius: 12,
          animation: 'fadeInUp 0.4s ease 0.5s both',
        }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, margin: 0 }}>
            🏆 <strong style={{ color: '#52b788' }}>Your report contributed to this repair.</strong>
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '6px 0 0', lineHeight: 1.5 }}>
            Fixed by <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{event.authority}</strong> on {new Date(event.fixedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(82,183,136,0.7)', margin: '4px 0 0', fontFamily: 'var(--font-display)' }}>
            Ref #{event.refNo}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fixProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes fixPop {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeInUp {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Fixed Report Card Badge ───────────────────────────────────────────────────
export function FixedBadge({ fixEvent }: { fixEvent: FixEvent }) {
  return (
    <div style={{
      marginTop: 10,
      padding: '10px 12px',
      background: 'rgba(82,183,136,0.06)',
      border: '1px solid rgba(82,183,136,0.25)',
      borderRadius: 10,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#52b788" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#52b788' }}>
          Your report contributed to this repair ✓
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
          Fixed by {fixEvent.authority} · {new Date(fixEvent.fixedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </div>
      </div>
    </div>
  );
}

// ── Demo trigger hook (for hackathon demo) ────────────────────────────────────
export function useFixVerified() {
  const [activeToast, setActiveToast] = useState<FixEvent | null>(null);

  const triggerFix = useCallback(async (ev: FixEvent) => {
    // Fire browser notification
    await requestNotificationPermission();
    fireBrowserNotification(ev);
    // Show in-app toast
    setActiveToast(ev);
  }, []);

  const dismissToast = useCallback(() => setActiveToast(null), []);

  return { activeToast, triggerFix, dismissToast };
}
