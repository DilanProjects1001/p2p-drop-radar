/* ============================================================
   P2P Drop Radar — Worker programado (Cloudflare Cron Trigger)
   ------------------------------------------------------------
   Se ejecuta cada 5 minutos (ver wrangler.toml). En cada disparo:
     1. Consulta la API pública de Binance P2P (sin autenticación).
     2. Si falla, cae al generador sintético (modo demo).
     3. Calcula las señales de mercado y la probabilidad de caída.
     4. Guarda el snapshot en la base de datos D1 (serie temporal).
     5. Si la probabilidad supera el umbral, registra una alerta y,
        opcionalmente, la envía por Telegram.

   ITERACIÓN 1: esqueleto funcional. La escritura en D1 y el envío
   de alertas están implementados de forma defensiva pero se pulirán
   en iteraciones siguientes (esquema de tablas, migraciones, etc.).
   ============================================================ */

'use strict';

import { computeDropProbability, riskLabel } from './model.js';
import { generateSnapshot } from './data-generator.js';

// Endpoint público de Binance P2P (búsqueda de anuncios).
const BINANCE_P2P_URL =
  'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

/**
 * Consulta anuncios de Binance P2P para VES/USDT en un lado (BUY/SELL).
 * @param {'BUY'|'SELL'} tradeType
 * @returns {Promise<Array>} lista de anuncios (data[]) o [] si falla.
 */
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
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

/**
 * Construye un snapshot real a partir de los anuncios de Binance.
 * Lanza error si no hay datos suficientes (para caer a modo demo).
 */
async function buildRealSnapshot() {
  const [buy, sell] = await Promise.all([
    fetchBinanceSide('BUY'),
    fetchBinanceSide('SELL'),
  ]);
  if (buy.length === 0 || sell.length === 0) {
    throw new Error('Datos insuficientes de Binance');
  }

  const buyPrices = buy.map((a) => parseFloat(a.adv.price));
  const sellPrices = sell.map((a) => parseFloat(a.adv.price));
  const bestBuy = Math.max(...buyPrices);   // mejor precio para vender USDT
  const bestSell = Math.min(...sellPrices); // mejor precio para comprar USDT
  const mid = (bestBuy + bestSell) / 2;
  const spread = Math.abs(bestSell - bestBuy) / mid;

  // Volumen disponible aproximado (suma de cantidades USDT del lado venta).
  const volumeUsdt = sell.reduce(
    (acc, a) => acc + parseFloat(a.adv.surplusAmount || '0'),
    0
  );

  const imbalance = (sell.length - buy.length) / (sell.length + buy.length);

  return {
    timestamp: Date.now(),
    pair: 'VES/USDT',
    price: +mid.toFixed(2),
    spread: +spread.toFixed(4),
    buyAds: buy.length,
    sellAds: sell.length,
    volumeUsdt: Math.round(volumeUsdt),
    // velocity se calcula comparando con el snapshot previo en D1 (pendiente);
    // por ahora 0 hasta tener histórico.
    signals: {
      spread: +spread.toFixed(4),
      velocity: 0,
      imbalance: +imbalance.toFixed(3),
      volume: Math.min(1, volumeUsdt / 50000),
    },
    source: 'binance',
  };
}

/**
 * Obtiene el snapshot actual: intenta Binance, cae a demo si falla.
 */
async function getSnapshot() {
  try {
    return await buildRealSnapshot();
  } catch (err) {
    // Resiliencia: nunca se rompe. Modo demo.
    const demo = generateSnapshot();
    demo.error = String(err && err.message ? err.message : err);
    return demo;
  }
}

/**
 * Guarda el snapshot en D1 (si el binding existe).
 */
async function persistSnapshot(env, snapshot, probability) {
  if (!env || !env.DB) return; // sin D1 configurada aún: no-op seguro.
  try {
    await env.DB.prepare(
      `INSERT INTO snapshots
         (ts, price, spread, buy_ads, sell_ads, volume_usdt, probability, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        snapshot.timestamp,
        snapshot.price,
        snapshot.spread,
        snapshot.buyAds,
        snapshot.sellAds,
        snapshot.volumeUsdt,
        probability,
        snapshot.source
      )
      .run();
  } catch (err) {
    console.error('Error guardando snapshot en D1:', err);
  }
}

/**
 * Registra una alerta en D1 y la envía por Telegram si corresponde.
 */
async function maybeAlert(env, snapshot, probability) {
  const threshold = parseFloat((env && env.DROP_THRESHOLD) || '70');
  if (probability < threshold) return;

  const message =
    `🔻 P2P Drop Radar — Probabilidad de caída ${probability}% (${riskLabel(
      probability
    )})\n` +
    `Par: ${snapshot.pair} · Precio: ${snapshot.price} VES · Spread: ${(
      snapshot.spread * 100
    ).toFixed(2)}%\n` +
    `Origen: ${snapshot.source}`;

  // Guardar en D1.
  if (env && env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO alerts (ts, probability, price, message) VALUES (?, ?, ?, ?)`
      )
        .bind(snapshot.timestamp, probability, snapshot.price, message)
        .run();
    } catch (err) {
      console.error('Error guardando alerta:', err);
    }
  }

  // Enviar por Telegram si hay credenciales.
  if (env && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: message,
          }),
        }
      );
    } catch (err) {
      console.error('Error enviando alerta a Telegram:', err);
    }
  }
}

/**
 * Ciclo principal: obtener, calcular, persistir, alertar.
 */
async function tick(env) {
  const snapshot = await getSnapshot();
  const probability = computeDropProbability(snapshot.signals);
  await persistSnapshot(env, snapshot, probability);
  await maybeAlert(env, snapshot, probability);
  return { ...snapshot, probability };
}

export default {
  // Disparador cron (cada 5 min según wrangler.toml).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env));
  },
  // También accesible por HTTP para depuración manual.
  async fetch(request, env) {
    const result = await tick(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'content-type': 'application/json' },
    });
  },
};

// Exportado para tests.
export { tick, getSnapshot, buildRealSnapshot };
