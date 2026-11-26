// src/dominio/reglas.js

export class ErrorRegla extends Error {
  constructor(codigo, mensaje, estadoHttp = 422) {
    super(mensaje);
    this.name = 'ErrorRegla';
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
  }
}

// RN-01: El monto debe ser un entero entre 10 y 5 000 monedas
export function verificarMonto(monto) {
  if (!Number.isInteger(monto) || monto < 10 || monto > 5000) {
    throw new ErrorRegla(
      'RN-01',
      'El monto de la propina debe ser un número entero entre 10 y 5000 monedas.'
    );
  }
}

// RN-01: El espectador debe tener saldo suficiente
export function verificarSaldo(saldo, monto) {
  if (saldo < monto) {
    throw new ErrorRegla('RN-01', 'Saldo insuficiente para enviar la propina.');
  }
}

// RN-02: Comisión del 15 % redondeada hacia arriba; el creador recibe el resto
export function calcularReparto(monto) {
  verificarMonto(monto);
  const comision = Math.ceil((monto * 15) / 100);
  const netoCreador = monto - comision;
  return { comision, netoCreador };
}

// RN-03: Nadie puede enviarse propinas a sí mismo
export function verificarNoAutopropina(espectadorId, creadorId) {
  if (espectadorId === creadorId) {
    throw new ErrorRegla('RN-03', 'No puedes enviarte una propina a ti mismo.');
  }
}

// RN-04: Una propina de 500 monedas o más se marca como destacada
export function esDestacada(monto) {
  verificarMonto(monto);
  return monto >= 500;
}