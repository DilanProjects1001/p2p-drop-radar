/* ============================================================
   P2P Drop Radar — Captura y almacenamiento de snapshots (compartido)
   ------------------------------------------------------------
   Módulo reutilizado por el Worker cron (src/worker.js) y por las
   Pages Functions (functions/api/*). Construye un snapshot CANÓNICO
   con las columnas de la tabla `snapshots`, calcula la probabilidad
   con el modelo (usando los pesos guardados en la tabla `config`) y
   lo inserta en D1. Nunca se rompe: si Binance falla, cae a datos
   sintéticos (source = 'synthetic').
   ============================================================ */

'use strict';

import { computeDropProbability, DEFAULT_WEIGHTS } from './model.js';
import { generateSnapshot, generateSeries } from './data-generator.js';

const BINANCE_P2P_URL =
  'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

// Correspondencia entre las claves de la tabla `config` y las señales
// que espera el modelo. Ojo: en config, "speed" == "velocity" del modelo.
const WEIGHT_KEYS = {
  spread: 'model_weights_spread',
  velocity: 'model_weights_speed',
  imbalance: 'model_weights_imbalance',
  volume: 'model_weights_volume',
};

/**
 * Lee los pesos del modelo desde la tabla `config`.
 * Cae a los valores por defecto si la fila no existe o si la DB falla.
 * @param {Object} env  Entorno con binding DB.
 * @returns {Promise<Object>} pesos { spread, velocity, imbalance, volume }.
 */
export async function loadWeights(env) {
  const defaults = { ...DEFAULT_WEIGHTS };
  if (!env || !env.DB) return defaults;
  try {
    const keys = Object.values(WEIGHT_KEYS);
    const placeholders = keys.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT key, value FROM config WHERE key IN (${placeholders})`
    ).bind(...keys).all();

    const byKey = {};
    for (const row of results) byKey[row.key] = parseFloat(row.value);

    const weights = {};
    for (const [signal, cfgKey] of Object.entries(WEIGHT_KEYS)) {
      const v = byKey[cfgKey];
      weights[signal] = Number.isFinite(v) ? v : defaults[signal];
    }
    return weights;
  } catch {
    return defaults;
  }
}

/**
 * Calcula la probabilidad de caída usando los pesos guardados en config.
 * @param {Object} env      Entorno con binding DB.
 * @param {Object} signals  Señales { spread, velocity, imbalance, volume }.
 * @returns {Promise<number>} probabilidad 0..100.
 */
export async function calculateProbability(env, signals) {
  const weights = await loadWeights(env);
  return computeDropProbability(signals, weights);
}

/** Consulta un lado del mercado en Binance P2P. */
async function fetchBinanceSide(tradeType) {
  const body = {
    asset: 'USDT',
    fiat: 'VES',
    tradeType,
    page: 1,
    rows: 20,
    payTypes: [],
    countries: [],
    publisherType: null,
  };
  const res = await fetch(BINANCE_P2P_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

/** Convierte el objeto demo (data-generator) al snapshot canónico. */
function canonicalFromDemo(demo, isoTs, weights = DEFAULT_WEIGHTS) {
  const spread = demo.spread;
  const price = demo.price;
  const bestBuy = +(price * (1 - spread / 2)).toFixed(2);
  const bestSell = +(price * (1 + spread / 2)).toFixed(2);
  const volSell = demo.volumeUsdt;
  const volBuy = Math.round(volSell * (demo.buyAds / Math.max(1, demo.sellAds)));
  const probability = computeDropProbability(demo.signals, weights);
  return {
    timestamp: isoTs || new Date(demo.timestamp).toISOString(),
    best_buy_price: bestBuy,
    best_sell_price: bestSell,
    total_buy_orders: demo.buyAds,
    total_sell_orders: demo.sellAds,
    total_buy_volume: volBuy,
    total_sell_volume: volSell,
    spread: +spread.toFixed(4),
    imbalance: demo.signals.imbalance,
    speed: demo.signals.velocity,
    probability,
    source: 'synthetic',
  };
}

/** Construye un snapshot sintético (modo demo) con los pesos de config. */
export async function buildSyntheticSnapshot(env) {
  const weights = await loadWeights(env);
  return canonicalFromDemo(generateSnapshot(), undefined, weights);
}

/** Construye un snapshot real a partir de Binance P2P. */
export async function buildRealSnapshot(prevPrice = null, weights = DEFAULT_WEIGHTS) {
  const [buy, sell] = await Promise.all([
    fetchBinanceSide('BUY'),
    fetchBinanceSide('SELL'),
  ]);
  if (buy.length === 0 || sell.length === 0) {
    throw new Error('Datos insuficientes de Binance');
  }

  const buyPrices = buy.map((a) => parseFloat(a.adv.price));
  const sellPrices = sell.map((a) => parseFloat(a.adv.price));
  const bestBuy = Math.max(...buyPrices);
  const bestSell = Math.min(...sellPrices);
  const mid = (bestBuy + bestSell) / 2;
  const spread = Math.abs(bestSell - bestBuy) / mid;

  const volBuy = buy.reduce(
    (a, x) => a + parseFloat(x.adv.surplusAmount || '0'), 0);
  const volSell = sell.reduce(
    (a, x) => a + parseFloat(x.adv.surplusAmount || '0'), 0);
  const imbalance = (sell.length - buy.length) / (sell.length + buy.length);

  // Velocidad: variación relativa respecto al precio previo (0 si no hay).
  const speed = prevPrice ? (mid - prevPrice) / prevPrice : 0;

  const signals = {
    spread,
    velocity: speed,
    imbalance,
    volume: Math.min(1, volSell / 50000),
  };
  const probability = computeDropProbability(signals, weights);

  return {
    timestamp: new Date().toISOString(),
    best_buy_price: +bestBuy.toFixed(2),
    best_sell_price: +bestSell.toFixed(2),
    total_buy_orders: buy.length,
    total_sell_orders: sell.length,
    total_buy_volume: Math.round(volBuy),
    total_sell_volume: Math.round(volSell),
    spread: +spread.toFixed(4),
    imbalance: +imbalance.toFixed(3),
    speed: +speed.toFixed(4),
    probability,
    source: 'real',
  };
}

/** Obtiene el precio medio del último snapshot (para calcular velocidad). */
async function lastMidPrice(env) {
  if (!env || !env.DB) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT best_buy_price, best_sell_price FROM snapshots ORDER BY timestamp DESC LIMIT 1'
    ).first();
    if (!row) return null;
    return (row.best_buy_price + row.best_sell_price) / 2;
  } catch {
    return null;
  }
}

/** Intenta un snapshot real; si falla, cae a sintético. Usa pesos de config. */
export async function buildSnapshot(env) {
  const weights = await loadWeights(env);
  try {
    const prev = await lastMidPrice(env);
    return await buildRealSnapshot(prev, weights);
  } catch {
    return canonicalFromDemo(generateSnapshot(), undefined, weights);
  }
}

/** Inserta un snapshot canónico en D1. */
export async function insertSnapshot(env, snap) {
  if (!env || !env.DB) return;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO snapshots
       (timestamp, best_buy_price, best_sell_price, total_buy_orders,
        total_sell_orders, total_buy_volume, total_sell_volume, spread,
        imbalance, speed, probability, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      snap.timestamp, snap.best_buy_price, snap.best_sell_price,
      snap.total_buy_orders, snap.total_sell_orders, snap.total_buy_volume,
      snap.total_sell_volume, snap.spread, snap.imbalance, snap.speed,
      snap.probability, snap.source
    )
    .run();
}

/** Lee el umbral de alerta desde la tabla config (por defecto 70). */
export async function getAlertThreshold(env) {
  if (!env || !env.DB) return 70;
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM config WHERE key = 'alert_threshold'"
    ).first();
    return row ? parseFloat(row.value) : 70;
  } catch {
    return 70;
  }
}

/** Inserta una alerta pendiente en D1. */
export async function insertAlert(env, snap, type = 'browser') {
  if (!env || !env.DB) return;
  const message =
    `Probabilidad de caída ${snap.probability}% — precio medio ` +
    `${((snap.best_buy_price + snap.best_sell_price) / 2).toFixed(2)} VES/USDT ` +
    `(${snap.source})`;
  await env.DB.prepare(
    'INSERT INTO alerts (timestamp, type, message, sent) VALUES (?, ?, ?, 0)'
  )
    .bind(snap.timestamp, type, message)
    .run();
}

/**
 * Ciclo completo: captura, calcula, guarda y (si aplica) alerta.
 * Devuelve el snapshot almacenado.
 */
export async function collectAndStore(env) {
  const snap = await buildSnapshot(env);
  await insertSnapshot(env, snap);
  const threshold = await getAlertThreshold(env);
  if (snap.probability >= threshold) {
    await insertAlert(env, snap, 'browser');
  }
  return snap;
}

/**
 * Si la tabla snapshots está vacía, la siembra con una serie sintética
 * para que el tablero y la gráfica tengan datos desde el primer momento.
 */
export async function seedIfEmpty(env, points = 48) {
  if (!env || !env.DB) return false;
  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM snapshots'
  ).first();
  if (count && count.n > 0) return false;

  const weights = await loadWeights(env);
  const threshold = await getAlertThreshold(env);
  const series = generateSeries(points);
  for (const demo of series) {
    const snap = canonicalFromDemo(demo, undefined, weights);
    await insertSnapshot(env, snap);
    if (snap.probability >= threshold) await insertAlert(env, snap, 'browser');
  }
  return true;
}
