# 📡 P2P Drop Radar

**Detector automático de caídas de precio en tiempo real para VES/USDT en Binance P2P.**

> ⚠️ **Aviso importante (disclaimer):** Este es un proyecto **educativo / de muestra**
> para portafolio. **No ejecuta operaciones, no mueve dinero y no constituye asesoría
> financiera.** Puede funcionar con datos simulados (modo demo) cuando la API pública
> no está disponible. Úsalo solo con fines demostrativos.

---

## ¿Qué es? (en simple)

Un tablero tipo "terminal financiera" que vigila el mercado peer-to-peer (P2P) de
Binance para el par **bolívar/USDT** y estima, con un modelo transparente, la
**probabilidad de que el precio esté por caer** (0–100%). Muestra un medidor, una
gráfica del precio, métricas del mercado y un feed de alertas.

## Estado del proyecto

🚧 **En construcción (iteración 1).** Ya existe la estructura completa y el esqueleto
funcional: frontend con estilo oscuro, API (Pages Functions), worker con cron, modelo
de probabilidad con tests que pasan, generador de datos demo y panel de administración.
La conexión de datos reales y el despliegue en vivo llegan en las siguientes iteraciones.

## Arquitectura (resumen)

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Frontend (Cloudflare Pages)│        │  Worker cron (cada 5 min)    │
│  public/  index.html + JS   │◀──────▶│  src/worker.js               │
│  gauge · gráfica · alertas  │  API   │   ├─ consulta Binance P2P    │
└──────────────┬──────────────┘        │   ├─ si falla → datos demo   │
               │                        │   ├─ modelo de probabilidad  │
   Pages Functions (API)                │   └─ guarda en D1 + alertas  │
   functions/api/*.js                   └──────────────┬───────────────┘
   status · history · alerts · config                  │
               │                                        ▼
               └───────────────▶  Cloudflare D1 (SQLite serverless)
                                   snapshots · alerts · config
```

## Stack tecnológico

- **Frontend:** HTML/CSS/JS vanilla, sin frameworks ni CDNs (autocontenido).
- **Backend:** Cloudflare Pages Functions + Worker con Cron Trigger.
- **Base de datos:** Cloudflare D1 (SQLite serverless) para series temporales.
- **Alertas:** Webhook de Telegram y notificaciones de navegador.
- **Tests:** `node --test` sobre la lógica del modelo.

## Estructura de carpetas

```
p2p-drop-radar/
├─ public/            Tablero (frontend estático)
│  ├─ index.html · style.css · script.js
├─ admin/             Panel de administración
│  ├─ index.html · style.css · script.js
├─ functions/api/     API (Pages Functions)
│  ├─ status.js · history.js · alerts.js · config.js
├─ src/               Lógica de servidor
│  ├─ worker.js       Worker cron (Binance → modelo → D1 → alertas)
│  ├─ model.js        Modelo de probabilidad (transparente y ajustable)
│  └─ data-generator.js  Generador de datos demo
├─ tests/             Tests del modelo (node --test)
├─ wrangler.toml      Configuración de Cloudflare (Pages + Worker + D1 + cron)
├─ package.json · .env.example · .gitignore
└─ README.md
```

## El modelo de probabilidad

No es una caja negra. Combina cuatro señales normalizadas mediante una **suma
ponderada** y una **función logística**:

| Señal          | Qué mide                                   | Peso por defecto |
|----------------|--------------------------------------------|------------------|
| `spread`       | Tensión venta/compra                       | 0.25             |
| `velocity`     | Velocidad de cambio reciente del precio    | 0.35             |
| `imbalance`    | Desequilibrio oferta/demanda               | 0.25             |
| `volume`       | Volumen disponible anómalo                 | 0.15             |

Los pesos y el umbral de alerta se ajustan desde el **panel de administración**.

## Cómo probarlo localmente

```bash
# Ejecutar los tests del modelo
npm test

# Ver el tablero: abre public/index.html en el navegador
```

## Despliegue (previsto)

Cloudflare Pages + Worker con prefijo `agc-` (proyecto `agc-p2p-drop-radar`).
Las instrucciones detalladas se añadirán al completar el despliegue en vivo.

## Licencia

MIT.
