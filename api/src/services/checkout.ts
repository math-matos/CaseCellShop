import { randomUUID } from 'node:crypto'
import {
  fingerprintOf,
  lookupIdempotentOrder,
  rememberOrder,
} from '../data/idempotency.js'
import { reserveStockBatch } from '../data/products.js'
import { errors } from '../lib/errors.js'
import type { CheckoutInput, Order, OrderItem } from '../types/index.js'
import { assertErpAvailable } from './erp.js'

export interface CheckoutResult {
  order: Order
  replayed: boolean
}

/**
 * Executa a compra do carrinho inteiro seguindo a ordem da secao 5 da spec:
 * replay idempotente -> dependencia externa -> reserva atomica de estoque.
 *
 * O pedido e tudo-ou-nada: se qualquer item faltar estoque, nada e debitado e a
 * compra inteira falha (409). O replay vem antes da checagem do ERP de
 * proposito: um cliente que esta retentando uma requisicao ja concluida recebe
 * o pedido original mesmo se a dependencia estiver instavel naquele instante.
 */
export function processCheckout(
  input: CheckoutInput,
  idempotencyKey: string,
): CheckoutResult {
  const fingerprint = fingerprintOf(input.items)
  const cached = lookupIdempotentOrder(idempotencyKey, fingerprint)

  if (cached.status === 'conflict') {
    throw errors.idempotencyKeyReuse()
  }

  if (cached.status === 'replay') {
    return { order: cached.order, replayed: true }
  }

  assertErpAvailable()

  const reservation = reserveStockBatch(input.items)

  if (!reservation.ok) {
    if (reservation.reason === 'PRODUCT_NOT_FOUND') {
      throw errors.productNotFound(reservation.productId)
    }

    const { product } = reservation
    throw product.stock > 0
      ? errors.insufficientStock(product.name, product.stock, product.id)
      : errors.outOfStock(product.name, product.id)
  }

  const items: OrderItem[] = reservation.lines.map((line) => ({
    productId: line.product.id,
    productName: line.product.name,
    quantity: line.quantity,
    unitPrice: line.product.value,
  }))

  const order: Order = {
    orderId: `order_${randomUUID()}`,
    status: 'confirmed',
    items,
    total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    createdAt: new Date().toISOString(),
  }

  rememberOrder(idempotencyKey, fingerprint, order)

  return { order, replayed: false }
}
