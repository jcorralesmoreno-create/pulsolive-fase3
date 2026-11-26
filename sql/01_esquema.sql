-- sql/01_esquema.sql
-- Modelo de datos de PulsoLive (módulo 068)

CREATE TABLE IF NOT EXISTS usuarios (
  id          BIGSERIAL PRIMARY KEY,
  alias       TEXT        NOT NULL UNIQUE,
  es_creador  BOOLEAN     NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billeteras (
  usuario_id     BIGINT PRIMARY KEY REFERENCES usuarios(id),
  saldo_monedas  BIGINT NOT NULL CHECK (saldo_monedas >= 0)
);

CREATE TABLE IF NOT EXISTS bloqueos (
  creador_id     BIGINT NOT NULL REFERENCES usuarios(id),
  espectador_id  BIGINT NOT NULL REFERENCES usuarios(id),
  PRIMARY KEY (creador_id, espectador_id)
);

CREATE TABLE IF NOT EXISTS propinas (
  id                 BIGSERIAL PRIMARY KEY,
  clave_idempotencia TEXT        NOT NULL,
  espectador_id      BIGINT      NOT NULL REFERENCES usuarios(id),
  creador_id         BIGINT      NOT NULL REFERENCES usuarios(id),
  monto              BIGINT      NOT NULL,
  comision           BIGINT      NOT NULL,
  neto_creador       BIGINT      NOT NULL,
  destacada          BOOLEAN     NOT NULL,
  mensaje            TEXT,
  creada_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (espectador_id, clave_idempotencia)
);