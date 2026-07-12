# 📡 P2P Drop Radar

**Detector automático de caídas de precio en tiempo real para VES/USDT en Binance P2P.**

> ⚠️ **Aviso importante (disclaimer):** Este es un proyecto **educativo / de muestra**
> para portafolio. **No ejecuta operaciones, no mueve dinero y no constituye asesoría
> financiera.** Puede funcionar con datos simulados (modo demo) cuando la API pública
> no está disponible. Úsalo solo con fines demostrativos.

## 🌐 Demo en vivo

**https://agc-p2p-drop-radar.pages.dev**

Endpoints de la API:
- `GET /api/status` — último snapshot y probabilidad de caída
- `GET /api/history` — últimos 100 snapshots (serie temporal)
- `GET /api/alerts` — alertas pendientes
- `GET /api/config` — configuración actual · `POST /api/config` (requiere token)

---

## ¿Qué es? (en simple)

Un tablero tipo "terminal financiera" que vigila el mercado peer-to-peer (P2P) de
Binance para el par **bolívar/USDT** y estima, con un modelo transparente, la
**probabilidad de que el precio esté por caer** (0–100%). Muestra un medidor, una
gráfica del precio, métricas del mercado y un feed de alertas.

## Estado del proyecto

🚧 **En construcción (iteración 2).** Ya está **desplegado y funcionando en vivo**:
base de datos D1 con migraciones, API conectada a D1 (status/history/alerts/config),
tablero que consume la API en tiempo real (gauge, gráfica y alertas con datos), modelo
con tests que pasan y generador de datos demo. Pendiente: conectar el muestreo real de
Binance mediante Worker con cron y afinar el panel de administración.

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
│  ├─ worker.js       Worker cron (handlers scheduled/fetch)
│  ├─ snapshot.js     Captura/almacenado compartido (Binance→modelo→D1→alertas)
│  ├─ model.js        Modelo de probabilidad (transparente y ajustable)
│  └─ data-generator.js  Generador de datos demo
├─ migrations/        Migraciones SQL de D1 (0001_create_tables.sql)
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

## Despliegue

El proyecto ya está **desplegado en Cloudflare Pages** con base de datos D1.

```bash
# 1) Crear la base de datos D1 (una sola vez)
npx wrangler d1 create agc-p2p-drop-radar-db
#    -> copiar el database_id a wrangler.toml

# 2) Aplicar migraciones (crea tablas + config por defecto)
npx wrangler d1 migrations apply agc-p2p-drop-radar-db --local
npx wrangler d1 migrations apply agc-p2p-drop-radar-db --remote

# 3) Configurar el token del panel (secreto, no va en el repo)
npx wrangler pages secret put ADMIN_TOKEN --project-name=agc-p2p-drop-radar

# 4) Desplegar
npx wrangler pages deploy public --project-name=agc-p2p-drop-radar --branch=main
```

La base se **auto-siembra** con una serie sintética la primera vez, de modo que el
tablero muestra datos desde el primer momento aunque el muestreo real aún no corra.

## Licencia

MIT.
