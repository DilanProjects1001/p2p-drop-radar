/* ============================================================
   GET /api/alerts — Alertas pendientes (últimas 50 con sent=0).
   ============================================================ */

'use strict';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env || !env.DB) {
    return json({ status: 'ok', alerts: [] });
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM alerts WHERE sent = 0 ORDER BY timestamp DESC LIMIT 50'
    ).all();
    return json({ status: 'ok', count: results.length, alerts: results });
  } catch (err) {
    return json({ status: 'error', alerts: [], message: String(err && err.message ? err.message : err) }, 200);
  }
}
