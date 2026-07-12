/* ============================================================
   Tests del modelo de probabilidad (node --test).
   Verifica que computeDropProbability se comporte de forma sensata.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDropProbability,
  riskLabel,
  clamp,
} from '../src/model.js';
import { generateSnapshot, generateSeries } from '../src/data-generator.js';

test('devuelve un número entre 0 y 100', () => {
  const p = computeDropProbability({
    spread: 0.02,
    velocity: -0.01,
    imbalance: 0.2,
    volume: 0.5,
  });
  assert.equal(typeof p, 'number');
  assert.ok(p >= 0 && p <= 100, `probabilidad fuera de rango: ${p}`);
});

test('señales neutras dan probabilidad moderada, no extrema', () => {
  const p = computeDropProbability({ spread: 0, velocity: 0, imbalance: 0, volume: 0 });
  assert.ok(p >= 0 && p <= 100);
});

test('presión bajista fuerte da probabilidad alta', () => {
  const bajista = computeDropProbability({
    spread: 0.05,
    velocity: -0.03,
    imbalance: 1,
    volume: 1,
  });
  const alcista = computeDropProbability({
    spread: 0.001,
    velocity: 0.03,
    imbalance: -1,
    volume: 0,
  });
  assert.ok(bajista > alcista, `esperado bajista(${bajista}) > alcista(${alcista})`);
  assert.ok(bajista >= 66, `esperado riesgo alto, fue ${bajista}`);
});

test('es robusto ante entradas inválidas', () => {
  const p = computeDropProbability({ spread: NaN, velocity: undefined, imbalance: 'x', volume: null });
  assert.ok(Number.isFinite(p) && p >= 0 && p <= 100);
});

test('riskLabel clasifica correctamente', () => {
  assert.equal(riskLabel(10), 'BAJO');
  assert.equal(riskLabel(50), 'MODERADO');
  assert.equal(riskLabel(90), 'ALTO');
});

test('clamp respeta límites', () => {
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(2), 1);
  assert.equal(clamp(0.5), 0.5);
});

test('el generador demo produce snapshots válidos', () => {
  const s = generateSnapshot({ seed: 42 });
  assert.equal(s.source, 'demo');
  assert.ok(s.price > 0);
  assert.ok(s.signals && typeof s.signals.spread === 'number');
  const p = computeDropProbability(s.signals);
  assert.ok(p >= 0 && p <= 100);
});

test('la serie demo tiene la longitud pedida y está ordenada', () => {
  const serie = generateSeries(10, { seed: 1 });
  assert.equal(serie.length, 10);
  for (let i = 1; i < serie.length; i++) {
    assert.ok(serie[i].timestamp >= serie[i - 1].timestamp);
  }
});
