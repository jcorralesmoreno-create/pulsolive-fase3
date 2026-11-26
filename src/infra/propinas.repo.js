// src/infra/propinas.repo.js
import crypto from 'node:crypto';
import { pool } from './bd.js';

export async function verificarBloqueo(espectadorId, creadorId, cliente = pool) {
  const res = await cliente.query(
    `SELECT 1 FROM bloqueos
     WHERE (creador_id = $1 AND espectador_id = $2)
        OR (creador_id = $2 AND espectador_id = $1)
     LIMIT 1`,
    [creadorId, espectadorId]
  );
  return res.rowCount > 0;
}

export async function obtenerUsuariosYBilleteras(espectadorId, creadorId, cliente = pool) {
  const res = await cliente.query(
    `SELECT u.id, u.es_creador, b.saldo_monedas
     FROM usuarios u
     JOIN billeteras b ON b.usuario_id = u.id
     WHERE u.id = ANY($1::bigint[])
     ORDER BY u.id ASC
     FOR UPDATE OF b`,
    [[espectadorId, creadorId]]
  );
  return res.rows;
}

export async function ejecutarTransaccionPropina({
  espectadorId,
  creadorId,
  montoBruto,
  comision,
  montoNeto,
  destacada,
  mensaje,
  claveIdempotencia,
  validarConDatosFn,
}) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const hayBloqueo = await verificarBloqueo(espectadorId, creadorId, cliente);
    const filas = await obtenerUsuariosYBilleteras(espectadorId, creadorId, cliente);

    if (validarConDatosFn) {
      validarConDatosFn({ hayBloqueo, filas });
    }

    await cliente.query(
      'UPDATE billeteras SET saldo_monedas = saldo_monedas - $1 WHERE usuario_id = $2',
      [montoBruto, espectadorId]
    );

    await cliente.query(
      'UPDATE billeteras SET saldo_monedas = saldo_monedas + $1 WHERE usuario_id = $2',
      [montoNeto, creadorId]
    );

    const clave = claveIdempotencia ?? crypto.randomUUID();
    const insercion = await cliente.query(
      `INSERT INTO propinas (
        clave_idempotencia, espectador_id, creador_id, monto, comision, neto_creador, destacada, mensaje
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, clave_idempotencia, espectador_id, creador_id, monto, comision, neto_creador, destacada, mensaje, creada_en`,
      [clave, espectadorId, creadorId, montoBruto, comision, montoNeto, destacada, mensaje ?? null]
    );

    await cliente.query('COMMIT');
    return insercion.rows[0];
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

export async function listarPropinasRecientesPorCreador(creadorId, limite = 20) {
  const res = await pool.query(
    `SELECT p.id, u.alias AS espectador, p.monto, p.neto_creador, p.destacada, p.mensaje, p.creada_en
     FROM propinas p
     JOIN usuarios u ON u.id = p.espectador_id
     WHERE p.creador_id = $1
     ORDER BY p.creada_en DESC
     LIMIT $2`,
    [creadorId, limite]
  );
  return res.rows;
}