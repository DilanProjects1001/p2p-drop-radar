/* ============================================================
   /api/config — Configuración del sistema.
   ------------------------------------------------------------
   GET  : devuelve la configuración pública actual (umbrales, pesos,
          intervalo). No expone secretos.
   POST : actualiza la configuración. Protegido con token simple
          (cabecera Authorization: Bearer <ADMIN_TOKEN>). El token
          se guarda como variable de entorno, nunca en el código.

   ITERACIÓN 1: la configuración se mantiene en memoria/valores por
   defecto; en próximas iteraciones se persiste en D1.
   ============================================================ */

'use strict';

// Configuración por defecto (se persistirá en D1 más adelante).
const DEFAULT_CONFIG = {
  dropThreshold: 70, // % a partir del cual se dispara alerta
  intervalMinutes: 5, // frecuencia del worker
  weights: { spread: 0.25, velocity: 0.35, imbalance: 0.25, volume: 0.15 },
  channels: { browser: true, telegram: false },
};

/** Verifica el token de administrador de forma segura. */
function isAuthorized(request, env) {
  const expected = env && env.ADMIN_TOKEN;
  if (!expected) return false; // sin token configurado => denegado.
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 && token === expected;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function onRequestGet() {
  // La configuración pública no expone secretos.
  return json({ status: 'ok', config: DEFAULT_CONFIG });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAuthorized(request, env)) {
    return json({ status: 'error', message: 'No autorizado.' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ status: 'error', message: 'JSON inválido.' }, 400);
  }

  // ITERACIÓN 1: validación básica y eco. La persistencia en D1 llega después.
  const updated = { ...DEFAULT_CONFIG, ...body };
  return json({
    status: 'ok',
    message: 'Configuración recibida (persistencia pendiente).',
    config: updated,
  });
}
