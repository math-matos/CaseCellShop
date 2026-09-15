import { randomUUID } from 'node:crypto'
import { buildApp } from '../src/app.js'
import { resetProducts } from '../src/data/products.js'
import { resetIdempotencyStore } from '../src/data/idempotency.js'
import type { Product } from '../src/types/index.js'

export const TEST_TOKEN = 'demo-token'

export interface CheckoutRequestOptions {
  body?: unknown
  token?: string | null
  idempotencyKey?: string | null
  correlationId?: string
}

export function buildHeaders(options: CheckoutRequestOptions = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }

  if (options.token !== null) {
    headers.authorization = `Bearer ${options.token ?? TEST_TOKEN}`
  }
  if (options.idempotencyKey !== null) {
    headers['idempotency-key'] = options.idempotencyKey ?? randomUUID()
  }
  if (options.correlationId) {
    headers['x-correlation-id'] = options.correlationId
  }

  return headers
}

export async function createTestApp(seed?: Product[]) {
  process.env.AUTH_TOKEN = TEST_TOKEN
  delete process.env.SIMULATE_DOWNTIME

  resetProducts(seed)
  resetIdempotencyStore()

  const app = buildApp({ logger: false })
  await app.ready()
  return app
}
