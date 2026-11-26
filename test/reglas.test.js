// test/reglas.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ErrorRegla,
  verificarMonto,
  verificarSaldo,
  calcularReparto,
  verificarNoAutopropina,
  esDestacada
} from '../src/dominio/reglas.js';

describe('RN-01: Validación de monto y saldo', () => {
  it('rechaza valores frontera inferiores y superiores (9 y 5001)', () => {
    assert.throws(() => verificarMonto(9), { name: 'ErrorRegla', codigo: 'RN-01' });
    assert.throws(() => verificarMonto(5001), { name: 'ErrorRegla', codigo: 'RN-01' });
  });

  it('rechaza montos no enteros (decimales)', () => {
    assert.throws(() => verificarMonto(10.5), { name: 'ErrorRegla', codigo: 'RN-01' });
  });

  it('acepta los límites válidos (10 y 5000)', () => {
    assert.doesNotThrow(() => verificarMonto(10));
    assert.doesNotThrow(() => verificarMonto(5000));
  });

  it('verifica saldo suficiente o lanza RN-01', () => {
    assert.doesNotThrow(() => verificarSaldo(100, 100));
    assert.throws(() => verificarSaldo(9, 10), { name: 'ErrorRegla', codigo: 'RN-01' });
  });
});

describe('RN-02: Cálculo de comisión (15 % hacia arriba) y neto', () => {
  it('cumple que comision + netoCreador === monto en al menos 5 montos distintos', () => {
    const casos = [
      { monto: 10, comisionEsperada: 2, netoEsperado: 8 },      // 1.5 -> ceil = 2
      { monto: 15, comisionEsperada: 3, netoEsperado: 12 },     // 2.25 -> ceil = 3
      { monto: 100, comisionEsperada: 15, netoEsperado: 85 },   // 15 exacto
      { monto: 500, comisionEsperada: 75, netoEsperado: 425 },  // 75 exacto
      { monto: 5000, comisionEsperada: 750, netoEsperado: 4250 } // 750 exacto
    ];

    for (const { monto, comisionEsperada, netoEsperado } of casos) {
      const { comision, netoCreador } = calcularReparto(monto);
      assert.equal(comision, comisionEsperada);
      assert.equal(netoCreador, netoEsperado);
      assert.equal(comision + netoCreador, monto);
    }
  });
});

describe('RN-03: Prohibición de autopropinas', () => {
  it('rechaza cuando el espectador y el creador tienen el mismo ID', () => {
    assert.throws(() => verificarNoAutopropina(7, 7), { name: 'ErrorRegla', codigo: 'RN-03' });
  });

  it('permite propinas entre usuarios distintos', () => {
    assert.doesNotThrow(() => verificarNoAutopropina(51, 7));
  });
});

describe('RN-04: Propina destacada desde 500 monedas', () => {
  it('marca como destacada solo si el monto es >= 500', () => {
    assert.equal(esDestacada(499), false);
    assert.equal(esDestacada(500), true);
    assert.equal(esDestacada(1500), true);
  });
});