-- ============================================================
-- P2P Drop Radar — Migración 0001: creación de tablas
-- Base de datos: Cloudflare D1 (SQLite serverless)
-- ============================================================

-- Serie temporal de snapshots del mercado VES/USDT.
CREATE TABLE IF NOT EXISTS snapshots (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp         TEXT UNIQUE,          -- ISO 8601
  best_buy_price    REAL,                 -- mejor precio de compra (VES/USDT)
  best_sell_price   REAL,                 -- mejor precio de venta  (VES/USDT)
  total_buy_orders  INTEGER,              -- nº de anuncios de compra
  total_sell_orders INTEGER,              -- nº de anuncios de venta
  total_buy_volume  REAL,                 -- volumen disponible lado compra (USDT)
  total_sell_volume REAL,                 -- volumen disponible lado venta  (USDT)
  spread            REAL,                 -- spread relativo
  imbalance         REAL,                 -- desequilibrio oferta/demanda [-1,1]
  speed             REAL,                 -- velocidad de cambio del precio
  probability       REAL,                 -- probabilidad de caída 0-100
  source            TEXT                  -- 'real' | 'synthetic'
);

CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON snapshots (timestamp DESC);

-- Alertas generadas cuando la probabilidad supera el umbral.
CREATE TABLE IF NOT EXISTS alerts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp  TEXT,                        -- ISO 8601
  type       TEXT,                        -- 'telegram' | 'browser'
  message    TEXT,
  sent       INTEGER DEFAULT 0            -- 0 = pendiente, 1 = enviada
);

CREATE INDEX IF NOT EXISTS idx_alerts_sent ON alerts (sent, timestamp DESC);

-- Configuración clave/valor (pesos del modelo, umbrales, credenciales de alerta).
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Valores por defecto de configuración.
INSERT OR IGNORE INTO config (key, value) VALUES
  ('model_weights_spread',    '0.3'),
  ('model_weights_speed',     '0.25'),
  ('model_weights_imbalance', '0.25'),
  ('model_weights_volume',    '0.2'),
  ('alert_threshold',         '70'),
  ('poll_interval',           '5'),
  ('telegram_bot_token',      ''),
  ('telegram_chat_id',        '');
