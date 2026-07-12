/* ============================================================
   P2P Drop Radar — Lógica del frontend (dashboard)
   ------------------------------------------------------------
   Consume la API (Pages Functions):
     GET /api/status   -> último snapshot + probabilidad
     GET /api/history  -> serie de precios
     GET /api/alerts   -> alertas pendientes
   Dibuja el gauge y la gráfica en canvas propio (sin librerías).
   Si la API no está disponible (p.ej. abriendo el archivo con file://),
   muestra placeholders sin romperse.
   ============================================================ */

'use strict';

const COLORS = {
  green: '#00ff6a',
  greenDim: '#0a9c48',
  amber: '#ffb000',
  red: '#ff3b3b',
  dim: '#5f7a6b',
  grid: 'rgba(0,255,106,0.10)',
};

const REFRESH_MS = 30000; // refresco cada 30 s

/** Dibuja el gauge semicircular de probabilidad (0-100%). */
function drawGauge(value) {
  const canvas = document.getElementById('gauge');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = 95;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 14;
  ctx.strokeStyle = '#16241c';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
  ctx.stroke();

  const start = 0.75 * Math.PI;
  const end = start + (Math.max(0, Math.min(100, value)) / 100) * 1.5 * Math.PI;
  const color = value < 33 ? COLORS.green : value < 66 ? COLORS.amber : COLORS.red;
  ctx.strokeStyle = color;
  ctx.shadowBlur = 16;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const val = document.getElementById('gauge-value');
  if (val) {
    val.textContent = Number.isFinite(value) ? value.toFixed(0) : '--';
    val.style.color = color;
    val.style.textShadow = `0 0 16px ${color}88`;
  }
}

/** Dibuja la gráfica de precio a partir de la serie histórica. */
function drawChart(points) {
  const canvas = document.getElementById('price-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Rejilla.
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let y = 0; y <= H; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  if (!points || points.length < 2) {
    ctx.fillStyle = COLORS.dim;
    ctx.font = '13px monospace';
    ctx.fillText('Esperando serie de precios…', 16, H / 2);
    return;
  }

  // Precio medio por punto, orden cronológico ascendente.
  const serie = points
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((p) => (p.best_buy_price + p.best_sell_price) / 2);

  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const pad = 12;
  const range = max - min || 1;
  const x = (i) => pad + (i / (serie.length - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - ((v - min) / range) * (H - 2 * pad);

  // Área bajo la curva.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(0,255,106,0.25)');
  grad.addColorStop(1, 'rgba(0,255,106,0)');
  ctx.beginPath();
  ctx.moveTo(x(0), y(serie[0]));
  serie.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(serie.length - 1), H - pad);
  ctx.lineTo(x(0), H - pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Línea.
  ctx.beginPath();
  ctx.moveTo(x(0), y(serie[0]));
  serie.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8;
  ctx.shadowColor = COLORS.green;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const last = document.getElementById('price-last');
  if (last) {
    last.textContent =
      `Último: ${serie[serie.length - 1].toFixed(2)} VES · mín ${min.toFixed(2)} · máx ${max.toFixed(2)}`;
  }
}

/** Actualiza el pill de modo (LIVE / DEMO). */
function setMode(mode) {
  const pill = document.getElementById('mode-pill');
  const label = document.getElementById('mode-label');
  if (!pill || !label) return;
  pill.classList.remove('live', 'demo');
  if (mode === 'live') {
    pill.classList.add('live');
    label.textContent = 'EN VIVO';
  } else {
    pill.classList.add('demo');
    label.textContent = 'DEMO';
  }
}

function fmt(n, digits = 2) {
  return Number.isFinite(n) ? Number(n).toFixed(digits) : '--';
}

/** Rellena las métricas de mercado. */
function setMetrics(s) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('m-spread', `${fmt(s.spread * 100)}%`);
  set('m-ads', `${s.total_buy_orders + s.total_sell_orders} (${s.total_buy_orders}▲/${s.total_sell_orders}▼)`);
  set('m-volume', `${Math.round(s.total_sell_volume).toLocaleString('es-ES')} USDT`);
  set('m-velocity', `${fmt(s.speed * 100)}%`);
  set('m-imbalance', fmt(s.imbalance, 2));
  const d = new Date(s.timestamp);
  set('m-updated', isNaN(d) ? '--' : d.toLocaleString('es-ES'));
  const hint = document.getElementById('gauge-hint');
  if (hint) hint.textContent = `Riesgo ${s.risk || '--'} · fuente ${s.source === 'real' ? 'Binance' : 'demo'}`;
}

/** Rellena el feed de alertas. */
function setAlerts(alerts) {
  const feed = document.getElementById('alerts-feed');
  if (!feed) return;
  if (!alerts || alerts.length === 0) {
    feed.innerHTML = '<li class="alert-empty">Sin alertas todavía.</li>';
    return;
  }
  feed.innerHTML = alerts
    .slice(0, 20)
    .map((a) => {
      const d = new Date(a.timestamp);
      const t = isNaN(d) ? '' : d.toLocaleString('es-ES');
      return `<li><strong>🔻 ${t}</strong><br>${a.message}</li>`;
    })
    .join('');
}

/** Carga todos los datos desde la API. */
async function refresh() {
  try {
    const [status, history, alerts] = await Promise.all([
      fetch('/api/status').then((r) => r.json()),
      fetch('/api/history').then((r) => r.json()),
      fetch('/api/alerts').then((r) => r.json()),
    ]);
    setMode(status.mode);
    drawGauge(Number(status.probability));
    setMetrics(status);
    drawChart(history.points || []);
    setAlerts(alerts.alerts || []);
  } catch (err) {
    // Sin backend (file://): placeholders.
    setMode('demo');
    drawGauge(0);
    drawChart([]);
    const hint = document.getElementById('gauge-hint');
    if (hint) hint.textContent = 'API no disponible (abre el sitio publicado).';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  drawGauge(0);
  drawChart([]);
  refresh();
  setInterval(refresh, REFRESH_MS);
});
