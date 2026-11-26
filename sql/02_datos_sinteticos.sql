-- sql/02_datos_sinteticos.sql
-- 5 050 usuarios: los 50 primeros son creadores
INSERT INTO usuarios (alias, es_creador)
SELECT 'u' || g, g <= 50 FROM generate_series(1, 5050) g;

INSERT INTO billeteras (usuario_id, saldo_monedas)
SELECT id, CASE WHEN es_creador THEN 0 ELSE 100000 END FROM usuarios;

-- 2 000 000 de propinas históricas
INSERT INTO propinas (clave_idempotencia, espectador_id, creador_id, monto, comision,
                      neto_creador, destacada, mensaje, creada_en)
SELECT 'seed-' || g,
       51 + (random() * 4999)::int,
       1 + (g % 50),
       m,
       (m * 1500 + 9999) / 10000,
       m - (m * 1500 + 9999) / 10000,
       m >= 500,
       'gg ' || g,
       now() - (g || ' seconds')::interval
FROM (SELECT g, 10 + (random() * 990)::int AS m FROM generate_series(1, 2000000) g) s;

ANALYZE;