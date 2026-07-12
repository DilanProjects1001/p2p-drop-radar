/* ============================================================
   P2P Drop Radar — Generador de datos sintéticos (modo demo)
   ------------------------------------------------------------
   Cuando la API pública de Binance P2P falla o no está disponible,
   el sistema NO se rompe: cae a este generador, que produce datos
   realistas de VES/USDT (precios altos y volátiles, típicos del
   bolívar). La UI indica claramente "MODO DEMO".

   Es determinista opcional (semilla) para pruebas reproducibles.
   ============================================================ */

'use strict';

// Generador pseudoaleatorio simple (mulberry32) para reproducibilidad.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Genera un snapshot sintético del mercado VES/USDT.
 * @param {Object} [opts]
 * @param {number} [opts.basePrice=40]  Precio base VES por USDT.
 * @param {number} [opts.seed]          Semilla opcional (reproducible).
 * @param {number} [opts.now]           Timestamp base (ms).
 * @returns {Object} snapshot de mercado.
 */
function generateSnapshot(opts = {}) {
  const rnd = opts.seed !== undefined ? mulberry32(opts.seed) : Math.random;
  const base = opts.basePrice ?? 40;
  const now = opts.now ?? Date.now();

  // Precio con ruido +-2%.
  const jitter = (rnd() - 0.5) * 0.04;
  const price = +(base * (1 + jitter)).toFixed(2);

  // Spread 0.3% - 3%.
  const spread = +(0.003 + rnd() * 0.027).toFixed(4);

  // Anuncios de compra/venta.
  const buyAds = Math.floor(20 + rnd() * 60);
  const sellAds = Math.floor(20 + rnd() * 60);

  // Volumen disponible (USDT).
  const volumeRaw = Math.floor(5000 + rnd() * 45000);

  // Señales derivadas.
  const imbalance = +(((sellAds - buyAds) / (sellAds + buyAds))).toFixed(3);
  const velocity = +(((rnd() - 0.5) * 0.06)).toFixed(4); // -3%..+3%
  const volume = +clamp01(volumeRaw / 50000).toFixed(3);

  return {
    timestamp: now,
    pair: 'VES/USDT',
    price,
    spread,
    buyAds,
    sellAds,
    volumeUsdt: volumeRaw,
    signals: { spread, velocity, imbalance, volume },
    source: 'demo',
  };
}

/**
 * Genera una serie histórica de N snapshots con caminata aleatoria.
 * @param {number} points  Número de puntos.
 * @param {Object} [opts]
 * @returns {Object[]} serie ordenada del más antiguo al más reciente.
 */
function generateSeries(points = 48, opts = {}) {
  const stepMs = opts.stepMs ?? 5 * 60 * 1000; // 5 min
  const now = opts.now ?? Date.now();
  let base = opts.basePrice ?? 40;
  const series = [];
  for (let i = points - 1; i >= 0; i--) {
    const seed = opts.seed !== undefined ? opts.seed + i : undefined;
    // Caminata aleatoria suave del precio base.
    base = base * (1 + (mulberry32((seed ?? i) + 7)() - 0.5) * 0.02);
    const snap = generateSnapshot({
      basePrice: base,
      seed,
      now: now - i * stepMs,
    });
    series.push(snap);
  }
  return series;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export { generateSnapshot, generateSeries };
export default { generateSnapshot, generateSeries };
