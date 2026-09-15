import { errors } from './errors.js'
import type { CheckoutBody, CheckoutInput } from '../types/index.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertValidIdempotencyKey(
  key: string | undefined,
): asserts key is string {
  if (!key || !UUID_PATTERN.test(key)) {
    throw errors.invalidIdempotencyKey()
  }
}

/**
 * Valida o body do checkout.
 *
 * Campos de preco enviados pelo cliente sao descartados de proposito: o valor
 * unitario e o total saem do catalogo no backend (secao 2.2 da spec).
 */
export function parseCheckoutBody(body: unknown): CheckoutInput {
  const { productId, quantity } = (body ?? {}) as CheckoutBody

  if (!Number.isInteger(productId)) {
    throw errors.invalidProduct()
  }

  if (!Number.isInteger(quantity) || (quantity as number) < 1) {
    throw errors.invalidQuantity()
  }

  return { productId: productId as number, quantity: quantity as number }
}
