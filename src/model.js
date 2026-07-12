/* ============================================================
   P2P Drop Radar — Modelo de probabilidad de caída
   ------------------------------------------------------------
   Modelo TRANSPARENTE y AJUSTABLE. No es una "caja negra": combina
   cuatro señales de mercado normalizadas a [0,1] mediante una suma
   ponderada, y el resultado se pasa por una función logística suave
   para obtener una probabilidad final en [0,100].

   Señales (todas orientadas a "mayor => más probable la caída"):
     - spread:     diferencia relativa venta/compra. Un spread alto
                   sugiere tensión y posible corrección a la baja.
     - velocity:   velocidad de cambio reciente del precio. Caídas
                   rápidas recientes aumentan la probabilidad.
     - imbalance:  desequilibrio entre oferta y demanda (más vendedores
                   que compradores => presión bajista).
     - volume:     volumen disponible anómalo (mucha oferta acumulada
                   => presión bajista).

   Los pesos son configurables desde el panel de administración.
   ============================================================ */

'use strict';

// Pesos por defecto (suman 1). Editables desde /admin.
const DEFAULT_WEIGHTS = {
  spread: 0.25,
  velocity: 0.35,
  imbalance: 0.25,
  volume: 0.15,
};

/** Recorta un número al rango [min, max]. */
function clamp(x, min = 0, max = 1) {
  if (Number.isNaN(x) || !Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

/** Función logística centrada en 0.5 para dar forma sigmoidal. */
function logistic(x, steepness = 8) {
  return 1 / (1 + Math.exp(-steepness * (x - 0.5)));
}

/**
 * Calcula la probabilidad de caída de precio.
 *
 * @param {Object} signals  Señales crudas del mercado.
 * @param {number} signals.spread     Spread relativo (ej. 0.02 = 2%).
 * @param {number} signals.velocity   Cambio relativo reciente (negativo = bajando).
 * @param {number} signals.imbalance  (vendedores - compradores) / total, en [-1,1].
 * @param {number} signals.volume     Volumen normalizado 0..1 (1 = mucha oferta).
 * @param {Object} [weights]          Pesos opcionales.
 * @returns {number}  Probabilidad en [0, 100].
 */
function computeDropProbability(signals = {}, weights = DEFAULT_WEIGHTS) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  // Normalización de cada señal a [0,1] orientada a "presión bajista".
  // spread: 0% -> 0, 5% o más -> 1.
  const nSpread = clamp((signals.spread ?? 0) / 0.05);

  // velocity: velocidad negativa (precio cayendo) aumenta la señal.
  // -3% o más rápido -> 1 ; +3% (subiendo) -> 0.
  const v = signals.velocity ?? 0;
  const nVelocity = clamp((-v + 0.03) / 0.06);

  // imbalance: [-1,1] -> [0,1]. +1 (solo vendedores) -> 1.
  const nImbalance = clamp(((signals.imbalance ?? 0) + 1) / 2);

  // volume: ya viene 0..1.
  const nVolume = clamp(signals.volume ?? 0);

  // Suma ponderada.
  const score =
    w.spread * nSpread +
    w.velocity * nVelocity +
    w.imbalance * nImbalance +
    w.volume * nVolume;

  // Forma sigmoidal para acentuar extremos, luego a porcentaje.
  const prob = logistic(clamp(score)) * 100;
  return Math.round(clamp(prob, 0, 100) * 10) / 10; // 1 decimal
}

/**
 * Devuelve una etiqueta legible según la probabilidad.
 * @param {number} p  Probabilidad 0..100.
 */
function riskLabel(p) {
  if (p < 33) return 'BAJO';
  if (p < 66) return 'MODERADO';
  return 'ALTO';
}

// Exportación como módulo ES (usado por el worker de Cloudflare y por los tests).
export { computeDropProbability, riskLabel, DEFAULT_WEIGHTS, clamp, logistic };
export default { computeDropProbability, riskLabel, DEFAULT_WEIGHTS, clamp, logistic };
