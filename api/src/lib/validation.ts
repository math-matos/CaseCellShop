import { errors } from './errors.js'
import type {
  CheckoutBody,
  CheckoutInput,
  CheckoutItemInput,
} from '../types/index.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertValidIdempotencyKey(
  key: string | undefined,
): asserts key is string {
  if (!key || !UUID_PATTERN.test(key)) {
    throw errors.invalidIdempotencyKey()
  }
}

/** Valida um item cru. Campos de preco sao ignorados: o valor sai do catalogo. */
function parseItem(raw: unknown): CheckoutItemInput {
  const { productId, quantity } = (raw ?? {}) as CheckoutBody

  if (!Number.isInteger(productId)) {
    throw errors.invalidProduct()
  }

  if (!Number.isInteger(quantity) || (quantity as number) < 1) {
    throw errors.invalidQuantity()
  }

  return { productId: productId as number, quantity: quantity as number }
}

/**
 * Valida o body do checkout.
 *
 * Aceita o formato canonico `{ items: [...] }` e tambem o legado
 * `{ productId, quantity }`, normalizando este ultimo para uma lista de um item.
 * Campos de preco enviados pelo cliente sao descartados de proposito: o valor
 * unitario e o total saem do catalogo no backend (secao 2.2 da spec).
 */
export function parseCheckoutBody(body: unknown): CheckoutInput {
  const raw = (body ?? {}) as CheckoutBody

  if (raw.items !== undefined) {
    if (!Array.isArray(raw.items)) {
      throw errors.invalidBody()
    }
    if (raw.items.length === 0) {
      throw errors.emptyCart()
    }
    return { items: raw.items.map(parseItem) }
  }

  // Formato legado: um unico item no corpo.
  if (raw.productId === undefined && raw.quantity === undefined) {
    throw errors.invalidBody()
  }

  return { items: [parseItem(raw)] }
}
