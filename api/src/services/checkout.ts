import { randomUUID } from 'node:crypto'
import {
  fingerprintOf,
  lookupIdempotentOrder,
  rememberOrder,
} from '../data/idempotency.js'
import { reserveStock } from '../data/products.js'
import { errors } from '../lib/errors.js'
import type { CheckoutInput, Order } from '../types/index.js'
import { assertErpAvailable } from './erp.js'

export interface CheckoutResult {
  order: Order
  replayed: boolean
}

/**
 * Executa a compra seguindo a ordem definida na secao 5 da spec:
 * replay idempotente -> dependencia externa -> reserva atomica de estoque.
 *
 * O replay vem antes da checagem do ERP de proposito: um cliente que esta
 * retentando uma requisicao ja concluida recebe o pedido original mesmo se a
 * dependencia estiver instavel naquele instante.
 */
export function processCheckout(
  input: CheckoutInput,
  idempotencyKey: string,
): CheckoutResult {
  const fingerprint = fingerprintOf(input.productId, input.quantity)
  const cached = lookupIdempotentOrder(idempotencyKey, fingerprint)

  if (cached.status === 'conflict') {
    throw errors.idempotencyKeyReuse()
  }

  if (cached.status === 'replay') {
    return { order: cached.order, replayed: true }
  }

  assertErpAvailable()

  const reservation = reserveStock(input.productId, input.quantity)

  if (!reservation.ok) {
    if (reservation.reason === 'PRODUCT_NOT_FOUND') {
      throw errors.productNotFound()
    }

    const { product } = reservation
    throw product.stock > 0
      ? errors.insufficientStock(product.name, product.stock)
      : errors.outOfStock(product.name)
  }

  const { product } = reservation

  const order: Order = {
    orderId: `order_${randomUUID()}`,
    status: 'confirmed',
    items: [
      {
        productId: product.id,
        productName: product.name,
        quantity: input.quantity,
        unitPrice: product.value,
      },
    ],
    total: product.value * input.quantity,
    createdAt: new Date().toISOString(),
  }

  rememberOrder(idempotencyKey, fingerprint, order)

  return { order, replayed: false }
}
