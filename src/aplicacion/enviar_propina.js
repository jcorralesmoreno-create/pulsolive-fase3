// src/aplicacion/enviar_propina.js
import {
  ErrorRegla,
  verificarMonto,
  verificarNoAutopropina,
  calcularReparto,
  esDestacada,
} from '../dominio/reglas.js';
import { ejecutarTransaccionPropina } from '../infra/propinas.repo.js';

export async function enviarPropina({
  espectadorId,
  creadorId,
  monto,
  mensaje,
  claveIdempotencia,
}) {
  verificarNoAutopropina(espectadorId, creadorId);
  verificarMonto(monto);

  const reparto = calcularReparto(monto);
  const comision = Number(reparto.comision);
  const montoNeto = Number(reparto.montoNeto ?? reparto.neto ?? (monto - comision));
  const destacada = Boolean(esDestacada(monto));

  return ejecutarTransaccionPropina({
    espectadorId,
    creadorId,
    montoBruto: monto,
    comision,
    montoNeto,
    destacada,
    mensaje,
    claveIdempotencia,
    validarConDatosFn: ({ hayBloqueo, filas }) => {
      if (hayBloqueo) {
        throw new ErrorRegla(
          'RN-BLOQUEO',
          'No se puede enviar propina porque existe un bloqueo entre los usuarios.'
        );
      }

      const espectador = filas.find((f) => String(f.id) === String(espectadorId));
      const creador = filas.find((f) => String(f.id) === String(creadorId));

      if (!espectador) {
        throw new ErrorRegla('RN-USUARIO', 'El espectador no existe.');
      }
      if (!creador || !creador.es_creador) {
        throw new ErrorRegla('RN-ROL', 'El destinatario no existe o no es un creador.');
      }
      if (Number(espectador.saldo_monedas) < monto) {
        throw new ErrorRegla('RN-SALDO', 'Saldo insuficiente en la billetera.');
      }
    },
  });
}