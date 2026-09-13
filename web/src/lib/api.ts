import type { Order, Product } from '../types'
import { ApiError } from './ApiError'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(`${API_URL}/products`)
  if (!response.ok) {
    throw new ApiError('Nao foi possivel carregar os produtos. Tente novamente.')
  }
  const data = (await response.json()) as { products: Product[] }
  return data.products
}

export async function checkout(productId: number, quantity: number): Promise<Order> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity }),
    })
  } catch {
    throw new ApiError('Nao foi possivel conectar ao servidor. Verifique sua conexao e tente novamente.')
  }

  const data = (await response.json()) as { order?: Order; error?: { message: string } }

  if (!response.ok) {
    throw new ApiError(data.error?.message ?? 'Nao foi possivel concluir a compra. Tente novamente.')
  }

  return data.order as Order
}
