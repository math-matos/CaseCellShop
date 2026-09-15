import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp } from './helpers.js'
import type { Product } from '../src/types/index.js'

let app: FastifyInstance

beforeEach(async () => {
  app = await createTestApp()
})

afterEach(async () => {
  await app?.close()
})

describe('GET /products', () => {
  it('devolve o catalogo completo', async () => {
    const response = await app.inject({ method: 'GET', url: '/products' })

    expect(response.statusCode).toBe(200)

    const { products } = response.json() as { products: Product[] }
    expect(products).toHaveLength(3)
    expect(products[0]).toEqual({
      id: 1,
      name: 'Capinha Azul',
      stock: 2,
      value: 10,
    })
  })

  it('nao exige autenticacao', async () => {
    const response = await app.inject({ method: 'GET', url: '/products' })

    expect(response.statusCode).toBe(200)
  })

  it('devolve o X-Correlation-Id na resposta', async () => {
    const response = await app.inject({ method: 'GET', url: '/products' })

    expect(response.headers['x-correlation-id']).toBeTruthy()
  })
})

describe('GET /health', () => {
  it('responde com status ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok' })
  })
})

describe('rota inexistente', () => {
  it('devolve 404 no formato padrao de erro', async () => {
    const response = await app.inject({ method: 'GET', url: '/nao-existe' })

    expect(response.statusCode).toBe(404)
    expect(response.json().error).toMatchObject({ code: 'NOT_FOUND' })
  })
})
