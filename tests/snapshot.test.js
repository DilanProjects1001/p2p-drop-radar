/* ============================================================
   Tests de src/snapshot.js — cableado de pesos desde `config`.
   Verifica (de forma determinista, sin red ni Cloudflare) que
   calculateProbability() lee los pesos de la tabla config y que
   cae a los valores por defecto cuando la DB no responde.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProbability, loadWeights } from '../src/snapshot.js';
import { computeDropProbability, DEFAULT_WEIGHTS } from '../src/model.js';

/** Crea un env falso cuya DB devuelve los pesos indicados en `config`. */
function mockEnv(configRows) {
  return {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async all() {
                return { results: configRows };
              },
            };
          },
        };
      },
    },
  };
}

const signals = { spread: 0.02, velocity: -0.02, imbalance: 0.4, volume: 0.9 };

test('calculateProbability usa los pesos guardados en config', async () => {
  // Config con TODO el peso en "volume" (la señal de volumen manda).
  const env = mockEnv([
    { key: 'model_weights_spread', value: '0' },
    { key: 'model_weights_speed', value: '0' },
    { key: 'model_weights_imbalance', value: '0' },
    { key: 'model_weights_volume', value: '1' },
  ]);
  const got = await calculateProbability(env, signals);
  const expected = computeDropProbability(signals, {
    spread: 0, velocity: 0, imbalance: 0, volume: 1,
  });
  assert.equal(got, expected);
});

test('pesos distintos producen probabilidades distintas', async () => {
  const envVolumen = mockEnv([
    { key: 'model_weights_spread', value: '0' },
    { key: 'model_weights_speed', value: '0' },
    { key: 'model_weights_imbalance', value: '0' },
    { key: 'model_weights_volume', value: '1' },
  ]);
  const envSpread = mockEnv([
    { key: 'model_weights_spread', value: '1' },
    { key: 'model_weights_speed', value: '0' },
    { key: 'model_weights_imbalance', value: '0' },
    { key: 'model_weights_volume', value: '0' },
  ]);
  const a = await calculateProbability(envVolumen, signals);
  const b = await calculateProbability(envSpread, signals);
  assert.notEqual(a, b);
});

test('loadWeights cae a los valores por defecto si la DB falla', async () => {
  const brokenEnv = {
    DB: { prepare() { throw new Error('DB caída'); } },
  };
  const w = await loadWeights(brokenEnv);
  assert.deepEqual(w, DEFAULT_WEIGHTS);
});

test('loadWeights cae a defaults si no hay binding DB', async () => {
  const w = await loadWeights({});
  assert.deepEqual(w, DEFAULT_WEIGHTS);
});
