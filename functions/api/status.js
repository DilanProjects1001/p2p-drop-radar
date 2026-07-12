/* ============================================================
   GET /api/status — Estado actual del mercado y probabilidad.
   ------------------------------------------------------------
   ITERACIÓN 1: responde un JSON básico. En próximas iteraciones
   leerá el snapshot más reciente desde D1; si no hay datos, usará
   el generador sintético (modo demo) para no romperse nunca.
   ============================================================ */

'use strict';

export async function onRequestGet(context) {
  const { env } = context;

  // Placeholder: por ahora modo demo con probabilidad 0.
  const payload = {
    status: 'ok',
    mode: 'demo',
    probability: 0,
    pair: 'VES/USDT',
    updatedAt: null,
    note: 'Esqueleto inicial. La lógica de datos reales se conecta en próximas iteraciones.',
    hasDb: Boolean(env && env.DB),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
