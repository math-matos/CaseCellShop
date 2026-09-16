import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildHeaders, createTestApp, TEST_TOKEN } from './helpers.js'
import type { Product } from '../src/types/index.js'

let app: FastifyInstance

async function boot(seed?: Product[]) {
  app = await createTestApp(seed)
  return app
}

async function stockOf(productId: number): Promise<number> {
  const response = await app.inject({ method: 'GET', url: '/products' })
  const { products } = response.json() as { products: Product[] }
  return products.find((product) => product.id === productId)!.stock
}

afterEach(async () => {
  await app?.close()
})

describe('POST /checkout - compra valida', () => {
  beforeEach(async () => {
    await boot()
  })

  it('cenario 1: devolve 201 com o pedido confirmado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 1, quantity: 2 },
    })

    expect(response.statusCode).toBe(201)

    const order = response.json()
    expect(order).toMatchObject({
      status: 'confirmed',
      total: 20,
      items: [
        {
          productId: 1,
          productName: 'Capinha Azul',
          quantity: 2,
          unitPrice: 10,
        },
      ],
    })
    expect(order.orderId).toMatch(/^order_/)
    expect(Date.parse(order.createdAt)).not.toBeNaN()
  })

  it('cenario 1: debita o estoque do produto comprado', async () => {
    expect(await stockOf(1)).toBe(2)

    await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 1, quantity: 2 },
    })

    expect(await stockOf(1)).toBe(0)
  })

  it('cenario 11: ignora preco enviado pelo cliente e usa o catalogo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 3, quantity: 2, unitPrice: 0.01, total: 0.02 },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      total: 40,
      items: [{ unitPrice: 20 }],
    })
  })
})

describe('POST /checkout - correlacao', () => {
  beforeEach(async () => {
    await boot()
  })

  it('ecoa o X-Correlation-Id recebido', async () => {
    const correlationId = randomUUID()

    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders({ correlationId }),
      payload: { productId: 1, quantity: 1 },
    })

    expect(response.headers['x-correlation-id']).toBe(correlationId)
  })

  it('gera um X-Correlation-Id quando o header nao e enviado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 1, quantity: 1 },
    })

    expect(response.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('devolve o correlationId tambem no corpo do erro', async () => {
    const correlationId = randomUUID()

    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders({ correlationId }),
      payload: { productId: 999, quantity: 1 },
    })

    expect(response.json().error.correlationId).toBe(correlationId)
  })
})

describe('POST /checkout - autenticacao (cenario 9)', () => {
  beforeEach(async () => {
    await boot()
  })

  it.each([
    ['sem header Authorization', { token: null }],
    ['com token invalido', { token: 'token-errado' }],
  ] as const)('devolve 401 %s', async (_label, options) => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(options),
      payload: { productId: 1, quantity: 1 },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Autenticação obrigatória para concluir a compra.',
    })
  })

  it('devolve 401 quando o esquema nao e Bearer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: {
        ...buildHeaders({ token: null }),
        authorization: `Basic ${TEST_TOKEN}`,
      },
      payload: { productId: 1, quantity: 1 },
    })

    expect(response.statusCode).toBe(401)
  })

  it('nao debita estoque quando a autenticacao falha', async () => {
    await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders({ token: null }),
      payload: { productId: 1, quantity: 2 },
    })

    expect(await stockOf(1)).toBe(2)
  })
})

describe('POST /checkout - validacao de entrada (cenario 3)', () => {
  beforeEach(async () => {
    await boot()
  })

  it.each([
    ['quantidade zero', 0],
    ['quantidade negativa', -1],
    ['quantidade decimal', 1.5],
    ['quantidade como string', '2'],
    ['quantidade ausente', undefined],
    ['quantidade nula', null],
  ])('devolve 400 para %s', async (_label, quantity) => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 1, quantity },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'A quantidade deve ser um número inteiro maior ou igual a 1.',
    })
  })

  it.each([
    ['productId ausente', undefined],
    ['productId como string', 'abc'],
    ['productId decimal', 1.2],
    ['productId nulo', null],
  ])('devolve 400 para %s', async (_label, productId) => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId, quantity: 1 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Informe um produto válido para concluir a compra.',
    })
  })

  it('devolve 400 quando o body nao e enviado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })

  it.each([
    ['ausente', null],
    ['fora do formato UUID', 'chave-qualquer'],
  ] as const)('devolve 400 com Idempotency-Key %s', async (_label, idempotencyKey) => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders({ idempotencyKey }),
      payload: { productId: 1, quantity: 1 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Informe um Idempotency-Key válido no formato UUID.',
    })
  })

  it('nao debita estoque quando a validacao falha', async () => {
    await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 1, quantity: 0 },
    })

    expect(await stockOf(1)).toBe(2)
  })
})

describe('POST /checkout - produto inexistente (cenario 4)', () => {
  beforeEach(async () => {
    await boot()
  })

  it('devolve 404 PRODUCT_NOT_FOUND', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 999, quantity: 1 },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error).toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Produto não encontrado.',
    })
  })
})

describe('POST /checkout - estoque (cenario 5)', () => {
  it('devolve 409 quando a quantidade excede o estoque', async () => {
    await boot()

    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 1, quantity: 3 },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().error).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      message: 'Estoque insuficiente: restam apenas 2 unidade(s) de Capinha Azul.',
    })
    expect(await stockOf(1)).toBe(2)
  })

  it('devolve 409 com mensagem de esgotado quando o estoque e zero', async () => {
    await boot([{ id: 3, name: 'Capinha Verde', stock: 0, value: 20 }])

    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 3, quantity: 1 },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().error).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      message: 'Capinha Verde está esgotado no momento.',
    })
  })
})

describe('POST /checkout - ERP indisponivel (cenario 6)', () => {
  beforeEach(async () => {
    await boot()
    process.env.SIMULATE_DOWNTIME = 'true'
  })

  afterEach(() => {
    delete process.env.SIMULATE_DOWNTIME
  })

  it('devolve 503 SERVICE_UNAVAILABLE sem debitar estoque', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { productId: 1, quantity: 1 },
    })

    expect(response.statusCode).toBe(503)
    expect(response.json().error).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message:
        'Serviço temporariamente indisponível. Tente novamente em instantes.',
    })

    delete process.env.SIMULATE_DOWNTIME
    expect(await stockOf(1)).toBe(2)
  })
})

describe('POST /checkout - idempotencia (cenarios 7 e 8)', () => {
  beforeEach(async () => {
    await boot()
  })

  it('tres chamadas com a mesma chave geram um unico pedido', async () => {
    const headers = buildHeaders()
    const payload = { productId: 2, quantity: 2 }

    const first = await app.inject({ method: 'POST', url: '/checkout', headers, payload })
    const second = await app.inject({ method: 'POST', url: '/checkout', headers, payload })
    const third = await app.inject({ method: 'POST', url: '/checkout', headers, payload })

    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(201)
    expect(third.statusCode).toBe(201)

    const orderId = first.json().orderId
    expect(second.json().orderId).toBe(orderId)
    expect(third.json().orderId).toBe(orderId)

    expect(first.headers['idempotency-replayed']).toBeUndefined()
    expect(second.headers['idempotency-replayed']).toBe('true')
    expect(third.headers['idempotency-replayed']).toBe('true')

    expect(await stockOf(2)).toBe(3)
  })

  it('chaves diferentes geram pedidos diferentes', async () => {
    const payload = { productId: 2, quantity: 1 }

    const first = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload,
    })
    const second = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload,
    })

    expect(first.json().orderId).not.toBe(second.json().orderId)
    expect(await stockOf(2)).toBe(3)
  })

  it('devolve 422 quando a mesma chave e reutilizada com outro body', async () => {
    const headers = buildHeaders()

    await app.inject({
      method: 'POST',
      url: '/checkout',
      headers,
      payload: { productId: 2, quantity: 1 },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers,
      payload: { productId: 2, quantity: 2 },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().error).toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSE',
      message: 'Esta Idempotency-Key já foi usada com outros dados.',
    })
    expect(await stockOf(2)).toBe(4)
  })
})

describe('POST /checkout - carrinho com varios itens', () => {
  beforeEach(async () => {
    await boot()
  })

  it('compra vários itens em um único pedido e debita cada estoque', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: {
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 3 },
        ],
      },
    })

    expect(response.statusCode).toBe(201)

    const order = response.json()
    expect(order.status).toBe('confirmed')
    expect(order.total).toBe(2 * 10 + 3 * 15)
    expect(order.items).toEqual([
      { productId: 1, productName: 'Capinha Azul', quantity: 2, unitPrice: 10 },
      {
        productId: 2,
        productName: 'Capinha Vermelha',
        quantity: 3,
        unitPrice: 15,
      },
    ])

    expect(await stockOf(1)).toBe(0)
    expect(await stockOf(2)).toBe(2)
  })

  it('é tudo-ou-nada: se um item falta estoque, nada é debitado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: {
        items: [
          { productId: 1, quantity: 2 }, // ok
          { productId: 2, quantity: 99 }, // excede o estoque
        ],
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().error).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      productId: 2,
    })

    // Nenhum item foi debitado — o pedido inteiro falhou.
    expect(await stockOf(1)).toBe(2)
    expect(await stockOf(2)).toBe(5)
  })

  it('aponta o productId inexistente no erro 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: {
        items: [
          { productId: 1, quantity: 1 },
          { productId: 999, quantity: 1 },
        ],
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error).toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      productId: 999,
    })
    expect(await stockOf(1)).toBe(2)
  })

  it('soma quantidades do mesmo produto repetido no carrinho', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: {
        items: [
          { productId: 1, quantity: 1 },
          { productId: 1, quantity: 1 },
        ],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(await stockOf(1)).toBe(0)
  })

  it('devolve 400 quando items é uma lista vazia', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers: buildHeaders(),
      payload: { items: [] },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('a mesma chave replica o pedido independentemente da ordem dos itens', async () => {
    const headers = buildHeaders()

    const first = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers,
      payload: {
        items: [
          { productId: 1, quantity: 1 },
          { productId: 2, quantity: 1 },
        ],
      },
    })

    // Mesma chave, mesmos itens em ordem trocada -> replay do pedido original.
    const replay = await app.inject({
      method: 'POST',
      url: '/checkout',
      headers,
      payload: {
        items: [
          { productId: 2, quantity: 1 },
          { productId: 1, quantity: 1 },
        ],
      },
    })

    expect(first.statusCode).toBe(201)
    expect(replay.statusCode).toBe(201)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    expect(replay.json().orderId).toBe(first.json().orderId)

    // Debitado uma unica vez.
    expect(await stockOf(1)).toBe(1)
    expect(await stockOf(2)).toBe(4)
  })
})

describe('POST /checkout - race condition (cenario 2)', () => {
  it('apenas uma requisicao leva o ultimo item em estoque', async () => {
    await boot([{ id: 1, name: 'Capinha Azul', stock: 1, value: 10 }])

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        app.inject({
          method: 'POST',
          url: '/checkout',
          headers: buildHeaders(),
          payload: { productId: 1, quantity: 1 },
        }),
      ),
    )

    const created = responses.filter((response) => response.statusCode === 201)
    const conflicted = responses.filter((response) => response.statusCode === 409)

    expect(created).toHaveLength(1)
    expect(conflicted).toHaveLength(9)
    expect(await stockOf(1)).toBe(0)
  })

  it('nunca deixa o estoque negativo sob concorrencia com quantidades variadas', async () => {
    await boot([{ id: 1, name: 'Capinha Azul', stock: 5, value: 10 }])

    await Promise.all(
      [3, 3, 2, 2, 4].map((quantity) =>
        app.inject({
          method: 'POST',
          url: '/checkout',
          headers: buildHeaders(),
          payload: { productId: 1, quantity },
        }),
      ),
    )

    expect(await stockOf(1)).toBeGreaterThanOrEqual(0)
  })
})
