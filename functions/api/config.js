/* ============================================================
   /api/config — Configuración del sistema (tabla `config` de D1).
   ------------------------------------------------------------
   GET  : devuelve todos los pares clave/valor de config.
   POST : actualiza claves de config. Protegido con token simple
          (cabecera Authorization: Bearer <ADMIN_TOKEN>). El token vive
          en una variable de entorno, nunca en el código.

   Por seguridad, GET nunca expone credenciales sensibles (los tokens
   de Telegram se devuelven enmascarados).
   ============================================================ */

'use strict';

// Claves cuyo valor no debe exponerse en claro por GET.
const SENSITIVE = new Set(['telegram_bot_token', 'telegram_chat_id']);

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function isAuthorized(request, env) {
  const expected = env && env.ADMIN_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 && token === expected;
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!env || !env.DB) return json({ status: 'ok', config: {} });

  try {
    const { results } = await env.DB.prepare(
      'SELECT key, value FROM config ORDER BY key'
    ).all();
    const config = {};
    for (const row of results) {
      config[row.key] = SENSITIVE.has(row.key)
        ? (row.value ? '••••••' : '')
        : row.value;
    }
    return json({ status: 'ok', config });
  } catch (err) {
    return json({ status: 'error', message: String(err && err.message ? err.message : err) }, 200);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAuthorized(request, env)) {
    return json({ status: 'error', message: 'No autorizado.' }, 401);
  }
  if (!env || !env.DB) {
    return json({ status: 'error', message: 'Base de datos no disponible.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ status: 'error', message: 'JSON inválido.' }, 400);
  }

  // Acepta un objeto plano { clave: valor } y actualiza cada clave existente.
  const entries = Object.entries(body || {});
  if (entries.length === 0) {
    return json({ status: 'error', message: 'Cuerpo vacío.' }, 400);
  }

  try {
    const stmts = entries.map(([key, value]) =>
      env.DB.prepare(
        'INSERT INTO config (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).bind(String(key), String(value))
    );
    await env.DB.batch(stmts);

    const { results } = await env.DB.prepare(
      'SELECT key, value FROM config ORDER BY key'
    ).all();
    const config = {};
    for (const row of results) {
      config[row.key] = SENSITIVE.has(row.key)
        ? (row.value ? '••••••' : '')
        : row.value;
    }
    return json({ status: 'ok', message: 'Configuración actualizada.', config });
  } catch (err) {
    return json({ status: 'error', message: String(err && err.message ? err.message : err) }, 200);
  }
}
