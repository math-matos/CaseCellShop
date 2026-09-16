import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildHeaders, createTestApp } from './helpers.js'

vi.mock('../src/data/products.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/data/products.js')>()
  return {
    ...original,
    reserveStockBatch: vi.fn(() => {
      throw new Error('Falha inesperada na camada de dados')
    }),
  }
})

let app: FastifyInstance

beforeEach(async () => {
  app = await createTestApp()
})

afterEach(async () => {
  await app?.close()
})

describe('POST /checkout - erro inesperado (cenario 10)', () => {
  it('devolve 500 SERVER_ERROR sem vazar detalhes internos', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 1, quantity: 1 },
    })

    expect(response.statusCode).toBe(500)

    const { error } = response.json()
    expect(error).toMatchObject({
      code: 'SERVER_ERROR',
      message: 'Erro de servidor inesperado.',
    })
    expect(JSON.stringify(error)).not.toContain('Falha inesperada')
    expect(error.correlationId).toBeTruthy()
  })
})
