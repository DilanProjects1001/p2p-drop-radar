/* ============================================================
   GET /api/status — Último snapshot del mercado (con probabilidad).
   ------------------------------------------------------------
   Devuelve el snapshot más reciente de D1. Si la base está vacía,
   la auto-siembra con una serie sintética (modo demo) para que el
   tablero nunca aparezca en blanco. Nunca se rompe.
   ============================================================ */

'use strict';

import { seedIfEmpty, buildSyntheticSnapshot } from '../../src/snapshot.js';
import { riskLabel } from '../../src/model.js';

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

  // Sin D1 (apertura local sin binding): devuelve un snapshot sintético.
  if (!env || !env.DB) {
    const snap = buildSyntheticSnapshot();
    return json({ status: 'ok', mode: 'demo', ...snap, risk: riskLabel(snap.probability) });
  }

  try {
    await seedIfEmpty(env);
    const row = await env.DB.prepare(
      'SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1'
    ).first();

    if (!row) {
      const snap = buildSyntheticSnapshot();
      return json({ status: 'ok', mode: 'demo', ...snap, risk: riskLabel(snap.probability) });
    }

    return json({
      status: 'ok',
      mode: row.source === 'real' ? 'live' : 'demo',
      ...row,
      risk: riskLabel(row.probability),
    });
  } catch (err) {
    // Resiliencia: ante cualquier fallo de D1, snapshot sintético.
    const snap = buildSyntheticSnapshot();
    return json({
      status: 'ok',
      mode: 'demo',
      ...snap,
      risk: riskLabel(snap.probability),
      warning: String(err && err.message ? err.message : err),
    });
  }
}
