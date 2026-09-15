import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError'
import { checkout, fetchProducts, newIdempotencyKey } from './api'

const API_URL = 'http://localhost:3333'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
}

const fetchMock = vi.fn()

/** Captura o ApiError lancado, mantendo o tipo estreito nas assercoes. */
async function captureApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) {
      return error
    }
    throw error
  }
  throw new Error('Esperava um ApiError, mas a promise resolveu com sucesso.')
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('newIdempotencyKey', () => {
  it('gera UUIDs distintos', () => {
    const first = newIdempotencyKey()
    const second = newIdempotencyKey()

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(first).not.toBe(second)
  })
})

describe('fetchProducts', () => {
  it('devolve a lista de produtos', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        products: [{ id: 1, name: 'Capinha Azul', stock: 2, value: 10 }],
      }),
    )

    await expect(fetchProducts()).resolves.toEqual([
      { id: 1, name: 'Capinha Azul', stock: 2, value: 10 },
    ])
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/products`)
  })

  it('transforma falha de rede em ApiError NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchProducts()).rejects.toMatchObject({
      name: 'ApiError',
      code: 'NETWORK_ERROR',
    })
  })

  it('propaga erro do servidor', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'SERVER_ERROR', message: 'Erro de servidor inesperado.' } },
        { status: 500 },
      ),
    )

    await expect(fetchProducts()).rejects.toMatchObject({
      code: 'SERVER_ERROR',
      status: 500,
    })
  })
})

describe('checkout - contrato da requisicao', () => {
  const order = {
    orderId: 'order_1',
    status: 'confirmed',
    items: [
      { productId: 1, productName: 'Capinha Azul', quantity: 2, unitPrice: 10 },
    ],
    total: 20,
    createdAt: '2026-09-15T12:00:00.000Z',
  }

  it('envia Authorization, Idempotency-Key e Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(order, { status: 201 }))

    await checkout(1, 2, { idempotencyKey: 'chave-fixa' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer demo-token',
      'Idempotency-Key': 'chave-fixa',
    })
  })

  it('envia X-Correlation-Id quando informado', async () => {
    fetchMock.mockResolvedValue(jsonResponse(order, { status: 201 }))

    await checkout(1, 2, {
      idempotencyKey: 'chave-fixa',
      correlationId: 'corr-1',
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-Correlation-Id']).toBe('corr-1')
  })

  it('nao envia preco no body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(order, { status: 201 }))

    await checkout(1, 2, { idempotencyKey: 'chave-fixa' })

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ productId: 1, quantity: 2 })
  })

  it('devolve o pedido em caso de sucesso', async () => {
    fetchMock.mockResolvedValue(jsonResponse(order, { status: 201 }))

    await expect(checkout(1, 2, { idempotencyKey: 'chave-fixa' })).resolves.toEqual(
      order,
    )
  })
})

describe('checkout - tratamento de erro', () => {
  it('usa a mensagem e o codigo devolvidos pela API', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Capinha Verde está esgotado no momento.',
            correlationId: 'corr-9',
          },
        },
        { status: 409 },
      ),
    )

    const error = await captureApiError(checkout(3, 1, { idempotencyKey: 'k' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe('Capinha Verde está esgotado no momento.')
    expect(error.code).toBe('INSUFFICIENT_STOCK')
    expect(error.status).toBe(409)
    expect(error.correlationId).toBe('corr-9')
    expect(error.requiresCatalogRefresh).toBe(true)
    expect(error.isRetryable).toBe(false)
  })

  it('marca falha de rede como retentavel', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await captureApiError(checkout(1, 1, { idempotencyKey: 'k' }))

    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.isRetryable).toBe(true)
  })

  it('marca 503 como retentavel', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
            correlationId: 'corr-2',
          },
        },
        { status: 503 },
      ),
    )

    const error = await captureApiError(checkout(1, 1, { idempotencyKey: 'k' }))

    expect(error.isRetryable).toBe(true)
  })

  it('marca erro de validacao como nao retentavel', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A quantidade deve ser um número inteiro maior ou igual a 1.',
            correlationId: 'corr-3',
          },
        },
        { status: 400 },
      ),
    )

    const error = await captureApiError(checkout(1, 0, { idempotencyKey: 'k' }))

    expect(error.isRetryable).toBe(false)
    expect(error.requiresCatalogRefresh).toBe(false)
  })

  it('cai na mensagem generica quando a resposta de erro nao tem corpo JSON', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }))

    const error = await captureApiError(checkout(1, 1, { idempotencyKey: 'k' }))

    expect(error.message).toBe('Nao foi possivel concluir a compra. Tente novamente.')
    expect(error.code).toBe('SERVER_ERROR')
  })
})
