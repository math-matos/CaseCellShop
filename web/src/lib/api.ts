import type {
  ApiErrorCode,
  CheckoutItem,
  ErrorResponse,
  Order,
  Product,
} from '../types'
import { ApiError } from './ApiError'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'
const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? 'demo-token'

const GENERIC_CHECKOUT_ERROR =
  'Nao foi possivel concluir a compra. Tente novamente.'
const NETWORK_ERROR =
  'Nao foi possivel conectar ao servidor. Verifique sua conexao e tente novamente.'

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

async function parseError(
  response: Response,
  fallbackMessage: string,
): Promise<ApiError> {
  const correlationId =
    response.headers.get('x-correlation-id') ?? undefined

  let payload: Partial<ErrorResponse> = {}
  try {
    payload = (await response.json()) as Partial<ErrorResponse>
  } catch {
  }

  return new ApiError(
    payload.error?.message ?? fallbackMessage,
    payload.error?.code ?? (`SERVER_ERROR` as ApiErrorCode),
    response.status,
    payload.error?.correlationId ?? correlationId,
    payload.error?.productId,
  )
}

export async function fetchProducts(): Promise<Product[]> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/products`)
  } catch {
    throw new ApiError(NETWORK_ERROR, 'NETWORK_ERROR')
  }

  if (!response.ok) {
    throw await parseError(
      response,
      'Nao foi possivel carregar os produtos. Tente novamente.',
    )
  }

  const data = (await response.json()) as { products: Product[] }
  return data.products
}

export interface CheckoutOptions {
  /**
   * Chave da tentativa de compra. Deve ser reaproveitada em um retry do mesmo
   * clique para que o servidor nao crie um segundo pedido.
   */
  idempotencyKey: string
  correlationId?: string
}

export async function checkout(
  items: CheckoutItem[],
  options: CheckoutOptions,
): Promise<Order> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_TOKEN}`,
    'Idempotency-Key': options.idempotencyKey,
  }

  if (options.correlationId) {
    headers['X-Correlation-Id'] = options.correlationId
  }

  // So enviamos productId e quantity — o preco sempre sai do catalogo no back.
  const payload = {
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ApiError(NETWORK_ERROR, 'NETWORK_ERROR')
  }

  if (!response.ok) {
    throw await parseError(response, GENERIC_CHECKOUT_ERROR)
  }

  return (await response.json()) as Order
}
