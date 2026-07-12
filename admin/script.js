/* ============================================================
   Panel de control — lógica del formulario.
   ------------------------------------------------------------
   ITERACIÓN 1: recoge los valores y hace POST a /api/config con el
   token en la cabecera Authorization. Muestra el resultado en el log.
   La persistencia real (D1) se implementa en próximas iteraciones.
   ============================================================ */

'use strict';

function logLine(msg) {
  const log = document.getElementById('log');
  const time = new Date().toLocaleTimeString('es-ES');
  log.textContent += `\n[${time}] ${msg}`;
  log.scrollTop = log.scrollHeight;
}

document.getElementById('config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = document.getElementById('admin-token').value.trim();
  const saveHint = document.getElementById('save-hint');

  if (!token) {
    saveHint.textContent = 'Falta el token de administrador.';
    saveHint.style.color = '#ffb000';
    return;
  }

  const config = {
    dropThreshold: Number(document.getElementById('dropThreshold').value),
    intervalMinutes: Number(document.getElementById('intervalMinutes').value),
    weights: {
      spread: Number(document.getElementById('w-spread').value),
      velocity: Number(document.getElementById('w-velocity').value),
      imbalance: Number(document.getElementById('w-imbalance').value),
      volume: Number(document.getElementById('w-volume').value),
    },
    channels: {
      browser: document.getElementById('ch-browser').checked,
      telegram: document.getElementById('ch-telegram').checked,
    },
  };

  saveHint.textContent = 'Enviando…';
  saveHint.style.color = '';
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (res.ok) {
      saveHint.textContent = 'Guardado correctamente.';
      saveHint.style.color = '#00ff6a';
      logLine('Config guardada: ' + JSON.stringify(data.config));
    } else {
      saveHint.textContent = data.message || 'Error al guardar.';
      saveHint.style.color = '#ff3b3b';
      logLine('Error: ' + (data.message || res.status));
    }
  } catch (err) {
    // En apertura local (file://) no hay backend: se informa con claridad.
    saveHint.textContent = 'Sin conexión con la API (¿abriste el archivo localmente?).';
    saveHint.style.color = '#ffb000';
    logLine('No se pudo contactar /api/config: ' + err.message);
  }
});
