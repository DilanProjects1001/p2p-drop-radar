/* ============================================================
   GET /api/alerts — Alertas recientes de caída de precio.
   ------------------------------------------------------------
   ITERACIÓN 1: responde lista vacía. En próximas iteraciones
   consultará la tabla `alerts` de D1 ordenada por fecha.
   ============================================================ */

'use strict';

export async function onRequestGet(context) {
  const { env } = context;

  const payload = {
    status: 'ok',
    alerts: [], // { ts, probability, price, message }
    note: 'Sin alertas en el esqueleto inicial.',
    hasDb: Boolean(env && env.DB),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
