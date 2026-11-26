// src/aplicacion/enviar_propina.js
import {
  ErrorRegla,
  verificarMonto,
  verificarNoAutopropina,
  calcularReparto,
  esDestacada,
} from '../dominio/reglas.js';
import { ejecutarTransaccionPropina } from '../infra/propinas.repo.js';

export async function enviarPropina({ espectadorId, creadorId, monto, mensaje }) {
  // 1. Validaciones puras de dominio (antes de tocar la BD)
  verificarNoAutopropina(espectadorId, creadorId);
  verificarMonto(monto);

  const { comision, montoNeto } = calcularReparto(monto);
  const destacada = esDestacada(monto);

  // 2. Ejecución atómica en PostgreSQL validando estado real bloqueado con FOR UPDATE
  return ejecutarTransaccionPropina({
    espectadorId,
    creadorId,
    montoBruto: monto,
    comision,
    montoNeto,
    destacada,
    mensaje,
    validarConDatosFn: ({ hayBloqueo, filas }) => {
      if (hayBloqueo) {
        throw new ErrorRegla(
          'RN-BLOQUEO',
          'No se puede enviar propina porque existe un bloqueo entre los usuarios.'
        );
      }

      const espectador = filas.find((f) => f.id === espectadorId);
      const creador = filas.find((f) => f.id === creadorId);

      if (!espectador) {
        throw new ErrorRegla('RN-USUARIO', 'El espectador no existe.');
      }
      if (!creador || creador.rol !== 'creador') {
        throw new ErrorRegla('RN-ROL', 'El destinatario no existe o no es un creador.');
      }
      if (Number(espectador.saldo) < monto) {
        throw new ErrorRegla('RN-SALDO', 'Saldo insuficiente en la billetera.');
      }
    },
  });
}