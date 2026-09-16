import type { FastifyInstance } from 'fastify'
import { assertAuthenticated } from '../lib/auth.js'
import {
  assertValidIdempotencyKey,
  parseCheckoutBody,
} from '../lib/validation.js'
import { processCheckout } from '../services/checkout.js'

export async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  app.post('/checkout', async (request, reply) => {
    assertAuthenticated(request.headers.authorization)

    const rawKey = request.headers['idempotency-key']
    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey
    assertValidIdempotencyKey(idempotencyKey)

    const input = parseCheckoutBody(request.body)
    const { order, replayed } = processCheckout(input, idempotencyKey)

    request.log.info(
      {
        correlationId: request.correlationId,
        orderId: order.orderId,
        items: input.items,
        replayed,
      },
      replayed ? 'checkout replayed' : 'checkout confirmed',
    )

    if (replayed) {
      reply.header('idempotency-replayed', 'true')
    }

    return reply.status(201).send(order)
  })
}
