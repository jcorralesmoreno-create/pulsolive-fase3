// test/integracion.test.js
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infra/bd.js';
import { calcularReparto, esDestacada } from '../src/dominio/reglas.js';
import { enviarPropina } from '../src/aplicacion/enviar_propina.js';
import { listarPropinasRecientesPorCreador } from '../src/infra/propinas.repo.js';

describe('Integración PulsoLive: envío atómico de propinas y consultas sobre 2M', () => {
  after(async () => {
    await pool.end();
  });

  it('procesa una propina y actualiza saldos de forma atómica', async () => {
    const creadorRes = await pool.query(
      'SELECT id FROM usuarios WHERE es_creador = TRUE LIMIT 1'
    );
    const espectadorRes = await pool.query(
      'SELECT id FROM usuarios WHERE es_creador = FALSE LIMIT 1'
    );

    const creadorId = Number(creadorRes.rows[0].id);
    const espectadorId = Number(espectadorRes.rows[0].id);
    const montoPrueba = 500;
    const reparto = calcularReparto(montoPrueba);
    const comisionEsperada = Number(reparto.comision);
    const netoEsperado = Number(reparto.montoNeto ?? reparto.neto ?? (montoPrueba - comisionEsperada));
    const esperadaDestacada = Boolean(esDestacada(montoPrueba));

    await pool.query(
      'UPDATE billeteras SET saldo_monedas = saldo_monedas + 5000 WHERE usuario_id = $1',
      [espectadorId]
    );
    await pool.query(
      `DELETE FROM bloqueos
       WHERE (creador_id = $1 AND espectador_id = $2)
          OR (creador_id = $2 AND espectador_id = $1)`,
      [creadorId, espectadorId]
    );

    const saldosAntes = await pool.query(
      'SELECT usuario_id, saldo_monedas FROM billeteras WHERE usuario_id = ANY($1::bigint[])',
      [[espectadorId, creadorId]]
    );
    const saldoInicialEspectador = Number(
      saldosAntes.rows.find((r) => Number(r.usuario_id) === espectadorId).saldo_monedas
    );
    const saldoInicialCreador = Number(
      saldosAntes.rows.find((r) => Number(r.usuario_id) === creadorId).saldo_monedas
    );

    const propina = await enviarPropina({
      espectadorId,
      creadorId,
      monto: montoPrueba,
      mensaje: '¡Excelente transmisión en vivo!',
    });

    assert.equal(Number(propina.monto), montoPrueba);
    assert.equal(Number(propina.comision), comisionEsperada);
    assert.equal(Number(propina.neto_creador), netoEsperado);
    assert.equal(propina.destacada, esperadaDestacada);

    const saldosDespues = await pool.query(
      'SELECT usuario_id, saldo_monedas FROM billeteras WHERE usuario_id = ANY($1::bigint[])',
      [[espectadorId, creadorId]]
    );

    const saldoFinalEspectador = Number(
      saldosDespues.rows.find((r) => Number(r.usuario_id) === espectadorId).saldo_monedas
    );
    const saldoFinalCreador = Number(
      saldosDespues.rows.find((r) => Number(r.usuario_id) === creadorId).saldo_monedas
    );

    assert.equal(saldoFinalEspectador, saldoInicialEspectador - montoPrueba);
    assert.equal(saldoFinalCreador, saldoInicialCreador + netoEsperado);
  });

  it('rechaza propinas si existe un bloqueo activo entre espectador y creador', async () => {
    const creadorRes = await pool.query(
      'SELECT id FROM usuarios WHERE es_creador = TRUE LIMIT 1'
    );
    const espectadorRes = await pool.query(
      'SELECT id FROM usuarios WHERE es_creador = FALSE LIMIT 1'
    );

    const creadorId = Number(creadorRes.rows[0].id);
    const espectadorId = Number(espectadorRes.rows[0].id);

    await pool.query(
      'INSERT INTO bloqueos (creador_id, espectador_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [creadorId, espectadorId]
    );

    try {
      await assert.rejects(
        () => enviarPropina({ espectadorId, creadorId, monto: 100 }),
        { codigo: 'RN-BLOQUEO' }
      );
    } finally {
      await pool.query(
        'DELETE FROM bloqueos WHERE creador_id = $1 AND espectador_id = $2',
        [creadorId, espectadorId]
      );
    }
  });

  it('consulta el feed reciente de un creador sobre 2 000 000 de registros usando índices', async () => {
    const creadorRes = await pool.query(
      'SELECT id FROM usuarios WHERE es_creador = TRUE LIMIT 1'
    );
    const creadorId = Number(creadorRes.rows[0].id);

    const inicio = performance.now();
    const recientes = await listarPropinasRecientesPorCreador(creadorId, 20);
    const duracionMs = performance.now() - inicio;

    assert.ok(Array.isArray(recientes));
    assert.ok(recientes.length <= 20);
    assert.ok(duracionMs < 200, `La consulta tardó demasiado: ${duracionMs.toFixed(2)} ms`);
  });
});