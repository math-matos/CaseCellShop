import type { Product } from '../types/index.js'

const INITIAL_CATALOG: readonly Product[] = [
  { id: 1, name: 'Capinha Azul', stock: 2, value: 10 },
  { id: 2, name: 'Capinha Vermelha', stock: 5, value: 15 },
  { id: 3, name: 'Capinha Verde', stock: 3, value: 20 },
]

let products: Product[] = INITIAL_CATALOG.map((product) => ({ ...product }))

export type ReserveStockResult =
  | { ok: true; product: Product }
  | { ok: false; reason: 'PRODUCT_NOT_FOUND' }
  | { ok: false; reason: 'INSUFFICIENT_STOCK'; product: Product }

export function listProducts(): Product[] {
  return products
}

export function findProduct(id: number): Product | undefined {
  return products.find((product) => product.id === id)
}

/**
 * Verifica e debita o estoque em uma unica operacao SINCRONA.
 *
 * Nao pode existir `await` entre a checagem e o decremento: o event loop do Node
 * so troca de tarefa em pontos de suspensao, entao manter tudo sincrono torna a
 * reserva atomica. E isso que garante o cenario 2 da spec (race condition):
 * duas requisicoes pelo ultimo item resultam em um 201 e um 409, nunca em
 * estoque negativo.
 */
export function reserveStock(
  productId: number,
  quantity: number,
): ReserveStockResult {
  const product = products.find((entry) => entry.id === productId)

  if (!product) {
    return { ok: false, reason: 'PRODUCT_NOT_FOUND' }
  }

  if (product.stock < quantity) {
    return { ok: false, reason: 'INSUFFICIENT_STOCK', product }
  }

  product.stock -= quantity
  return { ok: true, product }
}

/** Compensacao: devolve o estoque se algo falhar depois da reserva. */
export function releaseStock(productId: number, quantity: number): void {
  const product = products.find((entry) => entry.id === productId)
  if (product) {
    product.stock += quantity
  }
}

/** Restaura o catalogo. Usado pelos testes para isolar cada cenario. */
export function resetProducts(seed?: Product[]): void {
  products = (seed ?? INITIAL_CATALOG).map((product) => ({ ...product }))
}
