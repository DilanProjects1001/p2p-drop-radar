/* ============================================================
   P2P Drop Radar — Worker programado (Cloudflare Cron Trigger)
   ------------------------------------------------------------
   Se ejecuta periódicamente (cron). En cada disparo:
     1. Captura un snapshot (Binance P2P o, si falla, sintético).
     2. Calcula la probabilidad de caída con el modelo.
     3. Lo inserta en la tabla `snapshots` de D1.
     4. Si la probabilidad supera el umbral de config, registra una
        alerta en la tabla `alerts` (y la enviará por Telegram cuando
        haya credenciales).

   La lógica pesada vive en src/snapshot.js y se comparte con las
   Pages Functions. Este archivo solo expone los handlers del Worker.
   ============================================================ */

'use strict';

import { collectAndStore } from './snapshot.js';
import { riskLabel } from './model.js';

async function tick(env) {
  const snap = await collectAndStore(env);
  return { ...snap, risk: riskLabel(snap.probability) };
}

export default {
  // Disparador cron (frecuencia definida en wrangler.toml).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env));
  },
  // Accesible por HTTP para depuración manual.
  async fetch(request, env) {
    const result = await tick(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  },
};

export { tick };
