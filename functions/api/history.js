/* ============================================================
   GET /api/history — Serie temporal (últimos 100 snapshots).
   ------------------------------------------------------------
   Devuelve los últimos 100 snapshots ordenados por fecha DESC.
   Auto-siembra la base si está vacía (modo demo).
   ============================================================ */

'use strict';

import { seedIfEmpty } from '../../src/snapshot.js';

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
    return json({ status: 'ok', mode: 'demo', points: [] });
  }

  try {
    await seedIfEmpty(env);
    const { results } = await env.DB.prepare(
      'SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 100'
    ).all();
    return json({ status: 'ok', count: results.length, points: results });
  } catch (err) {
    return json({ status: 'error', points: [], message: String(err && err.message ? err.message : err) }, 200);
  }
}
