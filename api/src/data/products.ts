import type { CheckoutItemInput, Product } from '../types/index.js'

const INITIAL_CATALOG: readonly Product[] = [
  { id: 1, name: 'Capinha Azul', stock: 2, value: 10 },
  { id: 2, name: 'Capinha Vermelha', stock: 5, value: 15 },
  { id: 3, name: 'Capinha Verde', stock: 3, value: 20 },
]

let products: Product[] = INITIAL_CATALOG.map((product) => ({ ...product }))

/** Uma linha reservada com sucesso: o produto do catalogo e a quantidade. */
export interface ReservedLine {
  product: Product
  quantity: number
}

export type ReserveStockResult =
  | { ok: true; lines: ReservedLine[] }
  | { ok: false; reason: 'PRODUCT_NOT_FOUND'; productId: number }
  | { ok: false; reason: 'INSUFFICIENT_STOCK'; product: Product; quantity: number }

export function listProducts(): Product[] {
  return products
}

export function findProduct(id: number): Product | undefined {
  return products.find((product) => product.id === id)
}

/**
 * Verifica e debita o estoque de VARIOS itens em uma unica operacao SINCRONA,
 * de forma tudo-ou-nada: ou reserva o carrinho inteiro, ou nao mexe em nada.
 *
 * Nao pode existir `await` entre a checagem e o decremento: o event loop do Node
 * so troca de tarefa em pontos de suspensao, entao manter tudo sincrono torna a
 * reserva atomica. E isso que garante o cenario 2 da spec (race condition):
 * duas requisicoes pelo ultimo item resultam em um 201 e um 409, nunca em
 * estoque negativo.
 *
 * Itens repetidos (mesmo productId) sao somados antes de checar o estoque, para
 * que a validacao considere a demanda total do produto no carrinho.
 */
export function reserveStockBatch(
  items: CheckoutItemInput[],
): ReserveStockResult {
  const demandById = new Map<number, number>()
  for (const item of items) {
    demandById.set(
      item.productId,
      (demandById.get(item.productId) ?? 0) + item.quantity,
    )
  }

  // Fase 1: valida TODAS as linhas sem debitar nada.
  const lines: ReservedLine[] = []
  for (const [productId, quantity] of demandById) {
    const product = products.find((entry) => entry.id === productId)

    if (!product) {
      return { ok: false, reason: 'PRODUCT_NOT_FOUND', productId }
    }
    if (product.stock < quantity) {
      return { ok: false, reason: 'INSUFFICIENT_STOCK', product, quantity }
    }

    lines.push({ product, quantity })
  }

  // Fase 2: todas passaram — debita de uma vez.
  for (const line of lines) {
    line.product.stock -= line.quantity
  }

  return { ok: true, lines }
}

/** Restaura o catalogo. Usado pelos testes para isolar cada cenario. */
export function resetProducts(seed?: Product[]): void {
  products = (seed ?? INITIAL_CATALOG).map((product) => ({ ...product }))
}
