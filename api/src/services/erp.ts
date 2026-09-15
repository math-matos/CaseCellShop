import { errors } from '../lib/errors.js'

/**
 * Representa a dependencia externa do checkout (ERP/estoque central).
 *
 * `SIMULATE_DOWNTIME=true` derruba a dependencia de proposito para exercer o
 * cenario 6 da spec sem precisar de um servico real no ar.
 */
export function assertErpAvailable(): void {
  if (process.env.SIMULATE_DOWNTIME === 'true') {
    throw errors.serviceUnavailable()
  }
}
