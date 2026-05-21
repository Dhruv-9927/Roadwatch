import { useRef, useState, useEffect, useCallback } from 'react';
import './ScanView.css';
import { useAppStore } from '../../store/app.store';

// ── Types ────────────────────────────────────────────────────────────────────
interface AccelSample {
  t: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

interface DetectionEvent {
  id: string;
  timestamp: number;
  lat: number | null;
  lon: number | null;
  magnitude: number;
  type: 'pothole' | 'speedbump' | 'rough';
  speed_kmh: number | null;
  confidence: number;
  status: 'queued' | 'sent' | 'verified';
}

interface CameraResult {
  score: number;               // 0–100 edge density score
  label: string;
  color: string;
  description: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BUFFER_SIZE      = 120;   // samples kept in ring buffer (2s @ 60Hz)
const THRESHOLD_HIGH   = 18;    // m/s² delta → definite pothole
const THRESHOLD_MED    = 12;    // m/s² delta → rough road / speed-bump
const THRESHOLD_LOW    = 8;     // m/s² delta → minor jolt
const GRAPH_HEIGHT     = 120;
const GRAPH_WIDTH      = 340;
const LOW_PASS_ALPHA   = 0.85;  // gravity filter coefficient

// ── Utility: classify a jolt ─────────────────────────────────────────────────
function classifyJolt(
  delta: number,
  speed: number | null
): { type: DetectionEvent['type']; confidence: number } {
  if (delta >= THRESHOLD_HIGH) return { type: 'pothole', confidence: Math.min(0.97, 0.70 + delta * 0.01) };
  if (delta >= THRESHOLD_MED && speed !== null && speed < 30)
    return { type: 'speedbump', confidence: 0.75 };
  return { type: 'rough', confidence: Math.min(0.85, 0.50 + delta * 0.02) };
}

// ── Camera: edge-density analysis (Sobel) ────────────────────────────────────
function analyzeFrame(canvas: HTMLCanvasElement): CameraResult {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { score: 0, label: 'Unknown', color: '#888', description: 'Canvas unavailable' };

  const W = canvas.width;
  const H = canvas.height;
  const img = ctx.getImageData(0, 0, W, H);
  const d   = img.data;

  // Build greyscale array
  const grey = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    grey[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  }

  // Sobel edge detection — measure edge density in lower 60% of frame
  let edgeSum = 0;
  let edgeCount = 0;
  const startY = Math.floor(H * 0.4);
  for (let y = startY + 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx =
        -grey[(y - 1) * W + (x - 1)] + grey[(y - 1) * W + (x + 1)]
        - 2 * grey[y * W + (x - 1)] + 2 * grey[y * W + (x + 1)]
        - grey[(y + 1) * W + (x - 1)] + grey[(y + 1) * W + (x + 1)];
      const gy =
        grey[(y - 1) * W + (x - 1)] + 2 * grey[(y - 1) * W + x] + grey[(y - 1) * W + (x + 1)]
        - grey[(y + 1) * W + (x - 1)] - 2 * grey[(y + 1) * W + x] - grey[(y + 1) * W + (x + 1)];
      edgeSum += Math.sqrt(gx * gx + gy * gy);
      edgeCount++;
    }
  }

  // Variance of brightness (texture measure)
  let mean = 0;
  for (let i = 0; i < grey.length; i++) mean += grey[i];
  mean /= grey.length;
  let variance = 0;
  for (let i = 0; i < grey.length; i++) variance += (grey[i] - mean) ** 2;
  variance /= grey.length;

  const avgEdge      = edgeCount > 0 ? edgeSum / edgeCount : 0;
  const edgeDensity  = Math.min(1, avgEdge / 60);  // normalise
  const textureScore = Math.min(1, Math.sqrt(variance) / 50);

  // Combined pothole score
  const rawScore = edgeDensity * 0.65 + textureScore * 0.35;
  const score    = Math.round(Math.min(100, rawScore * 160));

  if (score >= 70) return {
    score, label: 'Pothole / Severe Damage',
    color: '#E63946',
    description: 'High edge density and texture irregularity detected in road surface. Matches pothole or severe crack pattern.',
  };
  if (score >= 45) return {
    score, label: 'Surface Damage / Cracking',
    color: '#F4A261',
    description: 'Moderate surface irregularity. Possible longitudinal cracking or patched area. Monitor for progression.',
  };
  if (score >= 25) return {
    score, label: 'Minor Wear',
    color: '#F9C74F',
    description: 'Low-level surface texture variation. Normal road aging — no immediate intervention required.',
  };
  return {
    score, label: 'Good Condition',
    color: '#52B788',
    description: 'Road surface appears uniform. No significant edge features or texture anomalies detected.',
  };
}

// ── Draw overlay on canvas ────────────────────────────────────────────────────
function drawOverlay(canvas: HTMLCanvasElement, result: CameraResult) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  // Scan region box (lower 60%)
  const boxTop = Math.floor(H * 0.4);
  ctx.strokeStyle = result.color;
  ctx.lineWidth   = 2;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(12, boxTop, W - 24, H - boxTop - 12);
  ctx.setLineDash([]);

  // Corner brackets
  const BL = 20;
  ctx.lineWidth = 3;
  [[12, boxTop], [W - 12, boxTop], [12, H - 12], [W - 12, H - 12]].forEach(([cx, cy]) => {
    ctx.beginPath();
    const dx = cx < W / 2 ? BL : -BL;
    const dy = cy < H / 2 ? BL : -BL;
    ctx.moveTo(cx + dx, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy);
    ctx.stroke();
  });

  // Score bar
  const barW = Math.round((result.score / 100) * (W - 40));
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, boxTop + 8, W - 24, 22);
  ctx.fillStyle = result.color;
  ctx.fillRect(14, boxTop + 10, barW - 4, 18);

  // Label
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 11px "DM Mono", monospace';
  ctx.fillText(`${result.label.toUpperCase()}  ${result.score}/100`, 18, boxTop + 24);

  // Analysis zone label
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '10px "DM Mono", monospace';
  ctx.fillText('ANALYSIS ZONE', 18, H - 20);
}

// ── Signal Graph ──────────────────────────────────────────────────────────────
function SignalGraph({
  samples,
  threshold,
  latestJolt,
}: {
  samples: AccelSample[];
  threshold: number;
  latestJolt: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Threshold line
    const thresholdY = H - (threshold / 30) * H;
    ctx.strokeStyle = 'rgba(230,57,70,0.45)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(W, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Threshold label
    ctx.fillStyle = 'rgba(230,57,70,0.7)';
    ctx.font      = '9px "DM Mono", monospace';
    ctx.fillText(`${threshold}m/s²`, W - 44, thresholdY - 3);

    if (samples.length < 2) return;

    // Draw signal
    const maxVal = 30;
    const step   = W / (BUFFER_SIZE - 1);

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(82,183,136,0.3)';
    ctx.lineWidth   = 1;

    samples.forEach((s, i) => {
      const x = i * step;
      const y = H - Math.min(1, s.magnitude / maxVal) * H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under curve
    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = i * step;
      const y = H - Math.min(1, s.magnitude / maxVal) * H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo((samples.length - 1) * step, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(82,183,136,0.25)');
    grad.addColorStop(1, 'rgba(82,183,136,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Highlight spikes above threshold
    samples.forEach((s, i) => {
      if (s.magnitude >= threshold) {
        const x = i * step;
        const y = H - Math.min(1, s.magnitude / maxVal) * H;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#E63946';
        ctx.fill();
      }
    });

    // Latest jolt indicator
    if (latestJolt !== null) {
      const latestIdx = samples.findLastIndex((s) => s.magnitude === latestJolt);
      if (latestIdx >= 0) {
        const x = latestIdx * step;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.strokeStyle = 'rgba(230,57,70,0.6)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [samples, threshold, latestJolt]);

  return (
    <canvas
      ref={canvasRef}
      width={GRAPH_WIDTH}
      height={GRAPH_HEIGHT}
      className="signal-canvas"
      aria-label="Accelerometer signal graph"
    />
  );
}

// ── Evidence Card ─────────────────────────────────────────────────────────────
function EvidenceCard({ event, onVerify }: { event: DetectionEvent; onVerify: (id: string) => void }) {
  const timeStr = new Date(event.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const typeColor = event.type === 'pothole' ? '#E63946' : event.type === 'speedbump' ? '#F9C74F' : '#F4A261';
  const typeEmoji = event.type === 'pothole' ? '🕳' : event.type === 'speedbump' ? '⚠️' : '〰️';

  return (
    <div className={`evidence-card ${event.type}`} style={{ borderLeftColor: typeColor }}>
      <div className="evidence-card-row">
        <span className="evidence-type" style={{ color: typeColor }}>
          {typeEmoji} {event.type.toUpperCase()}
        </span>
        <span className="evidence-time">{timeStr}</span>
      </div>
      <div className="evidence-card-row evidence-meta">
        <span>
          Δ <strong style={{ color: typeColor }}>{event.magnitude.toFixed(1)}</strong> m/s²
        </span>
        {event.speed_kmh !== null && <span>{Math.round(event.speed_kmh)} km/h</span>}
        <span className="evidence-conf">{Math.round(event.confidence * 100)}% conf.</span>
      </div>
      {event.lat !== null && (
        <div className="evidence-gps">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
          </svg>
          {event.lat.toFixed(5)}, {event.lon!.toFixed(5)}
        </div>
      )}
      <div className="evidence-card-footer">
        <span className={`evidence-status status-${event.status}`}>
          {event.status === 'queued' ? '● Queued' : event.status === 'sent' ? '✓ Sent' : '✓ Verified'}
        </span>
        {event.status === 'queued' && (
          <button className="evidence-verify-btn" onClick={() => onVerify(event.id)}>
            Verify &amp; Send →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main ScanView ─────────────────────────────────────────────────────────────
export default function ScanView() {
  // ── Refs
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  // ── Accel state
  const bufferRef       = useRef<AccelSample[]>([]);
  const gravRef         = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const lastJoltTimeRef = useRef<number>(0);
  const positionRef     = useRef<GeolocationPosition | null>(null);
  const [samples,       setSamples]       = useState<AccelSample[]>([]);
  const [_detecting,     setDetecting]     = useState(false);
  const [accelActive,   setAccelActive]   = useState(false);
  const [accelError,    setAccelError]    = useState<string | null>(null);
  const [events,        setEvents]        = useState<DetectionEvent[]>([]);
  const [latestJolt,    setLatestJolt]    = useState<number | null>(null);
  const [currentMag,    setCurrentMag]    = useState(0);
  const [flashRed,      setFlashRed]      = useState(false);
  const [threshold,     setThreshold]     = useState(THRESHOLD_HIGH);
  const [sensitivity,   setSensitivity]   = useState<'low' | 'medium' | 'high'>('medium');
  const [isSimDriveActive, setIsSimDriveActive] = useState(false);

  // ── Camera state
  const [activeTab,     setActiveTabLocal] = useState<'accel' | 'camera'>('accel');
  const [hasCamera,     setHasCamera]     = useState(false);
  const [camError,      setCamError]      = useState<string | null>(null);
  const [scanning,      setScanning]      = useState(false);
  const [cameraResult,  setCameraResult]  = useState<CameraResult | null>(null);

  const setAppActiveTab   = useAppStore((s) => s.setActiveTab);
  const setReportDraft    = useAppStore((s) => s.setReportDraft);

  // ── GPS watcher
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => { positionRef.current = pos; },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Sensitivity → threshold
  useEffect(() => {
    setThreshold(
      sensitivity === 'high' ? THRESHOLD_LOW :
      sensitivity === 'medium' ? THRESHOLD_HIGH :
      THRESHOLD_HIGH + 6
    );
  }, [sensitivity]);

  // ── Simulator Hooks
  const simulateJolt = useCallback((customType?: DetectionEvent['type'], magnitudeMultiplier = 1) => {
    const magnitude = parseFloat((threshold + 3 + Math.random() * 8 * magnitudeMultiplier).toFixed(2));
    const now = Date.now();

    setLatestJolt(magnitude);
    setFlashRed(true);
    setTimeout(() => setFlashRed(false), 200);
    setCurrentMag(magnitude);

    const newSample: AccelSample = {
      t: now,
      x: (Math.random() - 0.5) * 5,
      y: (Math.random() - 0.5) * 5,
      z: magnitude,
      magnitude
    };
    bufferRef.current = [...bufferRef.current.slice(-(BUFFER_SIZE - 1)), newSample];
    setSamples([...bufferRef.current]);

    const speed = 45 + Math.floor(Math.random() * 15);
    const type = customType || (magnitude >= threshold + 5 ? 'pothole' : 'rough');
    const confidence = parseFloat((0.75 + Math.random() * 0.2).toFixed(2));

    // Simulated GPS coords in Mandi, India
    const latOffset = (Math.random() - 0.5) * 0.003;
    const lonOffset = (Math.random() - 0.5) * 0.003;
    const simLat = 31.5892 + latOffset;
    const simLon = 76.9182 + lonOffset;

    const newEvent: DetectionEvent = {
      id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      lat: simLat,
      lon: simLon,
      magnitude,
      type,
      speed_kmh: speed,
      confidence,
      status: 'queued',
    };

    setEvents((prev) => [newEvent, ...prev].slice(0, 20));
  }, [threshold]);

  // 10Hz micro-vibrations stream during test drive
  useEffect(() => {
    if (!isSimDriveActive || !accelActive) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const baseVib = 1.5 + Math.random() * 3.5;
      setCurrentMag(baseVib);

      const sample: AccelSample = {
        t: now,
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: baseVib,
        magnitude: baseVib,
      };

      bufferRef.current = [...bufferRef.current.slice(-(BUFFER_SIZE - 1)), sample];
      setSamples([...bufferRef.current]);
    }, 100);

    return () => clearInterval(interval);
  }, [isSimDriveActive, accelActive]);

  // Periodic random road anomalies (6s interval)
  useEffect(() => {
    if (!isSimDriveActive || !accelActive) return;

    const interval = setInterval(() => {
      const isSpeedbump = Math.random() > 0.8;
      simulateJolt(isSpeedbump ? 'speedbump' : 'pothole');
    }, 6000);

    return () => clearInterval(interval);
  }, [isSimDriveActive, accelActive, simulateJolt]);

  // ── Accelerometer start/stop
  const startAccelerometer = useCallback(async () => {
    // iOS 13+ requires permission
    const DeviceMotionEvent = (window as any).DeviceMotionEvent;
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceMotionEvent.requestPermission();
        if (perm !== 'granted') {
          setAccelError('Motion sensor permission denied. Please allow in browser settings.');
          return;
        }
      } catch (e) {
        setAccelError('Could not request motion permission.');
        return;
      }
    }

    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

      const ax = acc.x!, ay = acc.y!, az = acc.z!;

      // Low-pass filter to isolate gravity
      gravRef.current.x = LOW_PASS_ALPHA * gravRef.current.x + (1 - LOW_PASS_ALPHA) * ax;
      gravRef.current.y = LOW_PASS_ALPHA * gravRef.current.y + (1 - LOW_PASS_ALPHA) * ay;
      gravRef.current.z = LOW_PASS_ALPHA * gravRef.current.z + (1 - LOW_PASS_ALPHA) * az;

      // High-pass: remove gravity
      const lx = ax - gravRef.current.x;
      const ly = ay - gravRef.current.y;
      const lz = az - gravRef.current.z;
      const magnitude = Math.sqrt(lx * lx + ly * ly + lz * lz);

      const sample: AccelSample = { t: Date.now(), x: lx, y: ly, z: lz, magnitude };

      // Ring buffer
      bufferRef.current = [...bufferRef.current.slice(-(BUFFER_SIZE - 1)), sample];
      setSamples([...bufferRef.current]);
      setCurrentMag(magnitude);

      // Jolt detection with debounce (500ms)
      const now = Date.now();
      if (magnitude >= threshold && now - lastJoltTimeRef.current > 500) {
        lastJoltTimeRef.current = now;
        setLatestJolt(magnitude);
        setFlashRed(true);
        setTimeout(() => setFlashRed(false), 200);

        const pos = positionRef.current;
        const speed = pos?.coords.speed != null
          ? Math.round(pos.coords.speed * 3.6)  // m/s → km/h
          : null;

        const { type, confidence } = classifyJolt(magnitude, speed as number | null);

        const newEvent: DetectionEvent = {
          id:        `${now}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: now,
          lat:       pos?.coords.latitude  ?? null,
          lon:       pos?.coords.longitude ?? null,
          magnitude: parseFloat(magnitude.toFixed(2)),
          type,
          speed_kmh: speed,
          confidence,
          status:    'queued',
        };
        setEvents((prev) => [newEvent, ...prev].slice(0, 20));
      }
    };

    window.addEventListener('devicemotion', handler as EventListener, true);
    setAccelActive(true);
    setAccelError(null);
    return () => window.removeEventListener('devicemotion', handler as EventListener, true);
  }, [threshold]);

  const stopAccelerometer = useCallback(() => {
    setAccelActive(false);
    setDetecting(false);
    setIsSimDriveActive(false);
    bufferRef.current = [];
    setSamples([]);
    setCurrentMag(0);
  }, []);

  const handleToggleAccel = useCallback(() => {
    if (accelActive) {
      stopAccelerometer();
    } else {
      setDetecting(true);
      startAccelerometer();
    }
  }, [accelActive, startAccelerometer, stopAccelerometer]);

  // ── Camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setHasCamera(true);
        setCamError(null);
      }
    } catch {
      setCamError('Camera access denied. Please allow camera permission and try again.');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera();
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setHasCamera(false);
      setCameraResult(null);
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [activeTab, startCamera]);

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !hasCamera) return;
    setScanning(true);
    setCameraResult(null);

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 360;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Brief processing delay for UX
    await new Promise((r) => setTimeout(r, 320));

    const result = analyzeFrame(canvas);
    drawOverlay(canvas, result);
    setCameraResult(result);
    setScanning(false);
  };

  const resetCamera = () => {
    setCameraResult(null);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleVerify = (id: string) => {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, status: 'sent' } : e));
    // In production: POST to backend with evidence packet
  };

  // const handleGenerateReport = (event: DetectionEvent) => {
  //   setReportDraft({
  //     description: `Passive accelerometer detection: ${event.type} at Δ${event.magnitude}m/s² confidence ${Math.round(event.confidence * 100)}%.${event.lat ? ` GPS: ${event.lat.toFixed(5)}, ${event.lon!.toFixed(5)}.` : ''} Auto-logged by ROADWATCH.`,
  //     severity: event.type === 'pothole' ? 'critical' : event.type === 'speedbump' ? 'medium' : 'high',
  //   });
  //   setAppActiveTab('report');
  // };

  // Stats
  const totalDetections = events.length;
  const potholeCount    = events.filter((e) => e.type === 'pothole').length;
  const queuedCount     = events.filter((e) => e.status === 'queued').length;

  return (
    <div className={`scan-view${flashRed ? ' flash-red' : ''}`}>

      {/* ── Tab switcher ── */}
      <div className="scan-tabs">
        <button
          className={`scan-tab${activeTab === 'accel' ? ' active' : ''}`}
          onClick={() => setActiveTabLocal('accel')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          Passive Detect
          {queuedCount > 0 && <span className="scan-tab-badge">{queuedCount}</span>}
        </button>
        <button
          className={`scan-tab${activeTab === 'camera' ? ' active' : ''}`}
          onClick={() => setActiveTabLocal('camera')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          Visual Verify
        </button>
      </div>

      {/* ════════════════════════════════════════════════════
          TAB 1 — ACCELEROMETER
      ════════════════════════════════════════════════════ */}
      {activeTab === 'accel' && (
        <div className="accel-panel">

          {/* Hero status */}
          <div className={`accel-status-hero ${accelActive ? 'active' : 'idle'}`}>
            <div className="accel-status-icon">
              {accelActive ? (
                <div className="pulse-ring">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                </div>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              )}
            </div>
            <div className="accel-status-text">
              <div className="accel-status-label">
                {accelActive ? 'MONITORING · JUST DRIVE' : 'PASSIVE DETECTION'}
              </div>
              <div className="accel-status-sub">
                {accelActive
                  ? 'Accelerometer active — potholes auto-logged with GPS'
                  : 'No camera needed. Phone in pocket. App watches.'}
              </div>
            </div>
            {accelActive && (
              <div className="accel-live-mag" style={{
                color: currentMag >= threshold ? '#E63946' : currentMag >= threshold * 0.5 ? '#F4A261' : '#52B788'
              }}>
                {currentMag.toFixed(1)}
                <span>m/s²</span>
              </div>
            )}
          </div>

          {accelError && (
            <div className="accel-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {accelError}
            </div>
          )}

          {/* Signal graph */}
          <div className="signal-graph-wrap">
            <div className="signal-graph-header">
              <span className="signal-graph-title">LIVE ACCELEROMETER SIGNAL</span>
              <span className="signal-graph-axis">0 — 30 m/s²</span>
            </div>
            <div className="signal-canvas-container">
              <SignalGraph samples={samples} threshold={threshold} latestJolt={latestJolt} />
              {!accelActive && samples.length === 0 && (
                <div className="signal-idle-overlay">
                  <span>Start detection to see live signal</span>
                </div>
              )}
            </div>
            <div className="signal-graph-footer">
              <div className="signal-legend-item">
                <div style={{ width: 20, height: 2, background: '#52B788', borderRadius: 1 }} />
                <span>Z-axis jolt</span>
              </div>
              <div className="signal-legend-item">
                <div style={{ width: 20, height: 1, background: '#E63946', borderStyle: 'dashed', borderTop: '1px dashed #E63946' }} />
                <span>Threshold {threshold} m/s²</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="accel-stats-row">
            <div className="accel-stat">
              <div className="accel-stat-val" style={{ color: '#F4A261' }}>{totalDetections}</div>
              <div className="accel-stat-label">Total Detected</div>
            </div>
            <div className="accel-stat">
              <div className="accel-stat-val" style={{ color: '#E63946' }}>{potholeCount}</div>
              <div className="accel-stat-label">Potholes</div>
            </div>
            <div className="accel-stat">
              <div className="accel-stat-val" style={{ color: '#F9C74F' }}>{queuedCount}</div>
              <div className="accel-stat-label">Queued</div>
            </div>
          </div>

          {/* Sensitivity + start/stop */}
          <div className="accel-controls">
            <div className="sensitivity-row">
              <span className="sensitivity-label">Sensitivity</span>
              <div className="sensitivity-btns">
                {(['low', 'medium', 'high'] as const).map((s) => (
                  <button
                    key={s}
                    className={`sensitivity-btn${sensitivity === s ? ' active' : ''}`}
                    onClick={() => setSensitivity(s)}
                    style={{ borderColor: sensitivity === s ? (s === 'high' ? '#E63946' : s === 'medium' ? '#F4A261' : '#52B788') : undefined }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <span className="sensitivity-note">≥{threshold} m/s²</span>
            </div>

            <button
              className={`accel-main-btn ${accelActive ? 'stop' : 'start'}`}
              onClick={handleToggleAccel}
              aria-label={accelActive ? 'Stop passive detection' : 'Start passive detection'}
            >
              {accelActive ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                  Stop Monitoring
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  Start Passive Detection
                </>
              )}
            </button>

            {/* Desktop / Test Simulator Panel */}
            {accelActive && (
              <div className="simulator-panel">
                <div className="simulator-header">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                  <span>TELEMETRY SIMULATOR</span>
                  <span className="sim-badge">TESTING TOOL</span>
                </div>
                <div className="simulator-buttons">
                  <button
                    className="sim-btn jolt"
                    onClick={() => simulateJolt('pothole', 1.5)}
                    title="Simulate sudden deep pothole impact"
                  >
                    💥 Jolt Pothole
                  </button>
                  <button
                    className={`sim-btn drive ${isSimDriveActive ? 'active' : ''}`}
                    onClick={() => setIsSimDriveActive(!isSimDriveActive)}
                    title="Simulate driving with road micro-vibrations and random pothole occurrences"
                  >
                    {isSimDriveActive ? (
                      <>
                        <svg className="spin-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                        Test Driving...
                      </>
                    ) : (
                      '🚗 Start Test Drive'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Evidence queue */}
          {events.length > 0 && (
            <div className="evidence-section">
              <div className="evidence-section-header">
                <span>EVIDENCE QUEUE</span>
                <span className="evidence-count">{events.length} detections</span>
              </div>
              <div className="evidence-list">
                {events.map((ev) => (
                  <EvidenceCard key={ev.id} event={ev} onVerify={handleVerify} />
                ))}
              </div>
            </div>
          )}

          {/* Engineering note */}
          <div className="engineering-note">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>
              Low-pass gravity filter (α=0.85) · High-pass jolt isolation · 500ms debounce ·
              Speed-bump vs pothole classification via speed proxy · DeviceMotion API (W3C)
            </span>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          TAB 2 — CAMERA VISUAL VERIFICATION
      ════════════════════════════════════════════════════ */}
      {activeTab === 'camera' && (
        <div className="camera-panel">
          <div className="camera-header">
            <p className="camera-subtitle">
              Point at road surface · Sobel edge-density analysis detects damage
            </p>
          </div>

          {/* Camera viewport */}
          <div className="camera-wrap">
            {camError ? (
              <div className="camera-error-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <p>{camError}</p>
                <button className="camera-allow-btn" onClick={startCamera}>Allow Camera</button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="camera-video"
                  playsInline
                  muted
                  autoPlay
                  aria-label="Camera feed for road surface scanning"
                />
                <canvas
                  ref={canvasRef}
                  className={`camera-canvas${cameraResult ? ' has-result' : ''}`}
                  aria-label="Edge detection overlay"
                />
                {hasCamera && !cameraResult && !scanning && (
                  <div className="camera-scan-bracket" aria-hidden="true">
                    <div className="bracket-tl" />
                    <div className="bracket-tr" />
                    <div className="bracket-bl" />
                    <div className="bracket-br" />
                    <div className="camera-scan-hint">Point at road surface</div>
                  </div>
                )}
                {scanning && (
                  <div className="camera-scanning-overlay" aria-label="Analyzing">
                    <div className="scan-line-anim" />
                    <div className="scanning-label">RUNNING EDGE ANALYSIS…</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Camera controls */}
          <div className="camera-controls">
            <button
              className="camera-capture-btn"
              onClick={captureAndAnalyze}
              disabled={!hasCamera || scanning}
              aria-label="Capture and analyze road surface"
            >
              {scanning ? (
                <>
                  <svg className="spin-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Analysing…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
                  </svg>
                  Analyse Road Surface
                </>
              )}
            </button>
            {cameraResult && (
              <button className="camera-reset-btn" onClick={resetCamera}>
                Reset
              </button>
            )}
          </div>

          {/* Camera result */}
          {cameraResult && (
            <div className="camera-result-card" style={{ borderLeftColor: cameraResult.color }}>
              <div className="camera-result-header">
                <div>
                  <div className="camera-result-label" style={{ color: cameraResult.color }}>
                    {cameraResult.label}
                  </div>
                  <div className="camera-result-desc">{cameraResult.description}</div>
                </div>
                <div className="camera-score-circle" style={{ borderColor: cameraResult.color, color: cameraResult.color }}>
                  {cameraResult.score}
                  <span>/ 100</span>
                </div>
              </div>

              {/* Score bar */}
              <div className="camera-score-track">
                <div
                  className="camera-score-fill"
                  style={{ width: `${cameraResult.score}%`, background: cameraResult.color }}
                />
              </div>
              <div className="camera-score-labels">
                <span style={{ color: '#52B788' }}>Good</span>
                <span style={{ color: '#F9C74F' }}>Wear</span>
                <span style={{ color: '#F4A261' }}>Damage</span>
                <span style={{ color: '#E63946' }}>Critical</span>
              </div>

              {/* Source citation */}
              <div className="camera-source-cite">
                ↳ Sobel gradient operator · Edge density in lower 60% of frame · Texture variance · Ref: IRC:SP:16-2004
              </div>

              {cameraResult.score >= 45 && (
                <button
                  className="camera-report-btn"
                  onClick={() => {
                    const pos = positionRef.current;
                    setReportDraft({
                      description: `Visual scan: ${cameraResult.label} (edge score ${cameraResult.score}/100).${pos ? ` GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}.` : ''} Detected via Sobel edge analysis.`,
                      severity: cameraResult.score >= 70 ? 'critical' : cameraResult.score >= 45 ? 'high' : 'medium',
                    });
                    setAppActiveTab('report');
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Generate Complaint Report
                </button>
              )}
            </div>
          )}

          {/* Camera tech note */}
          <div className="engineering-note">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>
              Method: Sobel edge detection (Gx/Gy) · Analysis zone: lower 60% of frame (road surface) ·
              Combines edge density (65%) + texture variance (35%) · No cloud API · Runs on-device
            </span>
          </div>
        </div>
      )}
    </div>
  );
}