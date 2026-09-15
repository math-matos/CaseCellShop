import type { FastifyInstance, FastifyReply } from 'fastify'
import { decreaseStock, findProduct } from '../data/products.js'
import type { CheckoutBody, ErrorCode, Order } from '../types/index.js'

function fail(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  message: string,
) {
  return reply.status(status).send({ error: { code, message } })
}

export async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  app.post('/checkout', async (request, reply) => {
    if (process.env.SIMULATE_DOWNTIME === 'true') {
      return fail(
        reply,
        503,
        'SERVICE_UNAVAILABLE',
        'Servico temporariamente indisponivel. Tente novamente em instantes.',
      )
    }

    const { productId, quantity } = (request.body ?? {}) as CheckoutBody

    if (!Number.isInteger(productId)) {
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'Informe um produto valido para concluir a compra.',
      )
    }

    if (!Number.isInteger(quantity) || (quantity as number) < 1) {
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'A quantidade deve ser um numero inteiro maior ou igual a 1.',
      )
    }

    const product = findProduct(productId as number)
    if (!product) {
      return fail(reply, 404, 'PRODUCT_NOT_FOUND', 'Produto nao encontrado.')
    }

    if ((quantity as number) > product.stock) {
      return fail(
        reply,
        409,
        'INSUFFICIENT_STOCK',
        product.stock > 0
          ? `Estoque insuficiente: restam apenas ${product.stock} unidade(s) de ${product.name}.`
          : `${product.name} esta esgotado no momento.`,
      )
    }

    const quantityNumber = quantity as number
    decreaseStock(product, quantityNumber)

    const order: Order = {
      orderId: `order_${crypto.randomUUID()}`,
      status: 'confirmed',
      items: [
        {
          productId: product.id,
          productName: product.name,
          quantity: quantityNumber,
          unitPrice: product.value,
        },
      ],
      total: product.value * quantityNumber,
      createdAt: new Date().toISOString(),
      remainingStock: product.stock,
    }

    return reply.status(201).send(order)
  })
}
