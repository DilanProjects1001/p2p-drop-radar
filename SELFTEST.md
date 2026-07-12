# SELFTEST — P2P Drop Radar

Documento de verificación: qué se probó, cómo ejecutarlo y una lista de comprobación
manual del despliegue en vivo.

## 1. Tests automáticos

Se ejecutan con el runner nativo de Node (sin dependencias externas):

```bash
node --test tests/**/*.test.js
```

Resultado esperado: **12 tests en verde, 0 fallos.**

### `tests/model.test.js` — lógica del modelo (8 tests)

- La probabilidad devuelta es un número dentro de `[0, 100]`.
- Señales neutras producen una probabilidad no extrema.
- Presión bajista fuerte da probabilidad **alta** (> alcista, ≥ 66).
- Robustez ante entradas inválidas (`NaN`, `undefined`, strings, `null`).
- `riskLabel()` clasifica correctamente (BAJO / MODERADO / ALTO).
- `clamp()` respeta los límites `[0, 1]`.
- El generador demo produce snapshots válidos (precio > 0, señales numéricas).
- La serie demo tiene la longitud pedida y viene ordenada por fecha.

### `tests/snapshot.test.js` — integración con D1 / config (4 tests)

Usan un `env.DB` **simulado** (sin red ni Cloudflare) para verificar el cableado de la
configuración con el modelo:

- `calculateProbability()` usa los pesos guardados en la tabla `config`.
- Pesos distintos producen probabilidades distintas sobre las mismas señales.
- `loadWeights()` cae a los valores por defecto si la DB lanza error.
- `loadWeights()` cae a los valores por defecto si no hay binding `DB`.

## 2. Verificación de integración en vivo (D1 + Worker)

Prueba determinista de que el snapshot usa los pesos de `config` en producción:

1. `POST /api/config` con todos los pesos a `0`.
2. Llamar al Worker (`/`) varias veces → la probabilidad queda fija en **≈ 1.8 %**
   (score = 0 → logística), sin importar que las señales cambien.
3. Restaurar los pesos por defecto → la probabilidad vuelve a variar.

Evidencia registrada en el reporte de la iteración 3 (1.8 % constante con pesos 0;
24.2 % al restaurar).

## 3. Checklist de verificación manual

| # | Comprobación | Comando / acción | Esperado |
|---|--------------|------------------|----------|
| 1 | El sitio carga | `curl -s -o /dev/null -w "%{http_code}" https://agc-p2p-drop-radar.pages.dev/` | `200` |
| 2 | Panel admin carga | abrir `https://agc-p2p-drop-radar.pages.dev/admin` | 200, formulario visible |
| 3 | API estado | `curl -s .../api/status` | JSON con `probability`, `source`, `risk` |
| 4 | API histórico | `curl -s .../api/history` | JSON con array `points` |
| 5 | API alertas | `curl -s .../api/alerts` | JSON con array `alerts` |
| 6 | Config GET | `curl -s .../api/config` | 8 claves de configuración |
| 7 | Config POST protegido | `POST .../api/config` sin token | `401 No autorizado` |
| 8 | Config POST con token | `POST` con `Authorization: Bearer <ADMIN_TOKEN>` | `200`, config actualizada |
| 9 | Worker cron activo | API de Cloudflare `/workers/scripts/agc-p2p-cron/schedules` | `cron: */5 * * * *` |
| 10 | Modo demo | `source` en `/api/status` | `synthetic` (o `real` si Binance responde) |
| 11 | Disclaimer visible | inspeccionar UI / `curl ... | grep -i disclaimer` | aparece el aviso legal |
| 12 | Tests | `node --test tests/**/*.test.js` | 12/12 en verde |

## 4. Notas

- **Binance P2P** no responde desde el entorno de Cloudflare Workers (bloqueo por
  región/anti-bot); el sistema opera en **modo demo** con datos sintéticos realistas,
  claramente indicado en la interfaz. La lógica de ingesta real está implementada y lista.
- Las notificaciones por Telegram requieren credenciales del usuario
  (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) y no están activas por defecto.
