/* ============================================================
   Panel de control — lógica.
   - Carga la config actual (GET /api/config) en el formulario.
   - Guarda cambios (POST /api/config con Authorization: Bearer token).
   - Muestra el registro de alertas (GET /api/alerts?all=1).
   ============================================================ */

'use strict';

const WEIGHT_IDS = [
  'model_weights_spread',
  'model_weights_speed',
  'model_weights_imbalance',
  'model_weights_volume',
];

function updateWeightsSum() {
  const sum = WEIGHT_IDS.reduce(
    (a, id) => a + (parseFloat(document.getElementById(id).value) || 0), 0);
  const el = document.getElementById('weights-sum');
  el.textContent = `Suma de pesos: ${sum.toFixed(2)}`;
  el.style.color = Math.abs(sum - 1) < 0.001 ? '#5f7a6b' : '#ffb000';
}

/** Carga la configuración actual desde la API en el formulario. */
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    const c = data.config || {};
    const set = (id, v) => { if (v !== undefined && document.getElementById(id)) document.getElementById(id).value = v; };
    set('alert_threshold', c.alert_threshold);
    set('poll_interval', c.poll_interval);
    WEIGHT_IDS.forEach((id) => set(id, c[id]));
    updateWeightsSum();
  } catch (err) {
    // Sin backend (file://): se mantienen los valores por defecto del HTML.
    updateWeightsSum();
  }
}

/** Carga el registro de alertas (todas, incluidas las enviadas). */
async function loadLogs() {
  const log = document.getElementById('log');
  log.textContent = 'Cargando alertas…';
  try {
    const res = await fetch('/api/alerts?all=1');
    const data = await res.json();
    const alerts = data.alerts || [];
    if (alerts.length === 0) {
      log.textContent = 'No hay alertas registradas.';
      return;
    }
    log.innerHTML = alerts
      .map((a) => {
        const d = new Date(a.timestamp);
        const ts = isNaN(d) ? a.timestamp : d.toLocaleString('es-ES');
        const estado = a.sent === 1
          ? '<span class="sent">● enviada</span>'
          : '<span class="pending">● pendiente</span>';
        return `<div class="row"><span class="ts">${ts}</span> · ${estado} · [${a.type}]<br>${a.message}</div>`;
      })
      .join('');
  } catch (err) {
    log.textContent = 'No se pudo cargar el registro (¿abriste el sitio publicado?).';
  }
}

/** Envía la configuración a la API. */
async function saveConfig(e) {
  e.preventDefault();
  const token = document.getElementById('admin-token').value.trim();
  const saveHint = document.getElementById('save-hint');

  if (!token) {
    saveHint.textContent = 'Falta el token de administrador.';
    saveHint.style.color = '#ffb000';
    return;
  }

  const payload = {
    alert_threshold: document.getElementById('alert_threshold').value,
  };
  WEIGHT_IDS.forEach((id) => { payload[id] = document.getElementById(id).value; });

  saveHint.textContent = 'Enviando…';
  saveHint.style.color = '';
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      saveHint.textContent = '✔ Configuración guardada. El próximo snapshot usará estos pesos.';
      saveHint.style.color = '#00ff6a';
    } else {
      saveHint.textContent = data.message || 'Error al guardar.';
      saveHint.style.color = '#ff3b3b';
    }
  } catch (err) {
    saveHint.textContent = 'Sin conexión con la API (¿abriste el archivo localmente?).';
    saveHint.style.color = '#ffb000';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  WEIGHT_IDS.forEach((id) =>
    document.getElementById(id).addEventListener('input', updateWeightsSum));
  document.getElementById('config-form').addEventListener('submit', saveConfig);
  document.getElementById('reload-logs').addEventListener('click', loadLogs);
  loadConfig();
  loadLogs();
});
