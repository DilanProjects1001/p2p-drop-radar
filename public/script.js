/* ============================================================
   P2P Drop Radar — Lógica del frontend (dashboard)
   ------------------------------------------------------------
   ITERACIÓN 1: esqueleto visual. Todavía NO consume la API real;
   solo dibuja los placeholders del gauge y la gráfica para que el
   tablero se vea completo. En próximas iteraciones aquí se hará
   el fetch a /api/status, /api/history y /api/alerts.
   ============================================================ */

'use strict';

// Paleta compartida con el CSS (se lee en canvas).
const COLORS = {
  green: '#00ff6a',
  greenDim: '#0a9c48',
  amber: '#ffb000',
  red: '#ff3b3b',
  dim: '#5f7a6b',
  grid: 'rgba(0,255,106,0.10)',
};

/**
 * Dibuja el gauge semicircular de probabilidad (0-100%).
 * @param {number} value  Probabilidad 0..100.
 */
function drawGauge(value) {
  const canvas = document.getElementById('gauge');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = 95;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Arco de fondo (círculo completo tenue).
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#16241c';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
  ctx.stroke();

  // Arco de valor.
  const start = 0.75 * Math.PI;
  const end = start + (value / 100) * 1.5 * Math.PI;
  const color = value < 33 ? COLORS.green : value < 66 ? COLORS.amber : COLORS.red;
  ctx.strokeStyle = color;
  ctx.shadowBlur = 16;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/**
 * Dibuja la rejilla base de la gráfica de precio (placeholder).
 */
function drawChartGrid() {
  const canvas = document.getElementById('price-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let y = 0; y <= canvas.height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = '13px monospace';
  ctx.fillText('Esperando serie de precios…', 16, canvas.height / 2);
}

// Arranque: placeholders (0% y rejilla vacía).
document.addEventListener('DOMContentLoaded', () => {
  drawGauge(0);
  drawChartGrid();
  // El pill de modo se resolverá al conectar la API (próxima iteración).
  const pill = document.getElementById('mode-pill');
  const label = document.getElementById('mode-label');
  if (pill && label) {
    pill.classList.add('demo');
    label.textContent = 'DEMO';
  }
});
