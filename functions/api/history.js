/* ============================================================
   GET /api/history — Serie temporal histórica de precios/probabilidad.
   ------------------------------------------------------------
   ITERACIÓN 1: responde una serie vacía. En próximas iteraciones
   consultará la tabla `snapshots` de D1 con paginación por rango.
   ============================================================ */

'use strict';

export async function onRequestGet(context) {
  const { env } = context;

  const payload = {
    status: 'ok',
    mode: 'demo',
    points: [], // { ts, price, probability }
    note: 'Histórico vacío en el esqueleto inicial.',
    hasDb: Boolean(env && env.DB),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
