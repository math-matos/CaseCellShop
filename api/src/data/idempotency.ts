import type { CheckoutItemInput, Order } from '../types/index.js'

interface IdempotencyRecord {
  fingerprint: string
  order: Order
  storedAt: number
}

const TTL_MS = 24 * 60 * 60 * 1000

/**
 * Store em memoria. Em producao isso seria Redis ou uma tabela com unique
 * constraint na chave - o contrato publico desta modulo nao mudaria.
 */
const store = new Map<string, IdempotencyRecord>()

export type IdempotencyLookup =
  | { status: 'miss' }
  | { status: 'replay'; order: Order }
  | { status: 'conflict' }

/**
 * Identifica o payload da tentativa: mesma chave + payload diferente = 422.
 * A ordem dos itens no carrinho nao muda o pedido, entao ordenamos antes de
 * serializar — `[A,B]` e `[B,A]` produzem o mesmo fingerprint.
 */
export function fingerprintOf(items: CheckoutItemInput[]): string {
  return items
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join(',')
}

export function lookupIdempotentOrder(
  key: string,
  fingerprint: string,
): IdempotencyLookup {
  const record = store.get(key)

  if (!record) {
    return { status: 'miss' }
  }

  if (Date.now() - record.storedAt > TTL_MS) {
    store.delete(key)
    return { status: 'miss' }
  }

  if (record.fingerprint !== fingerprint) {
    return { status: 'conflict' }
  }

  return { status: 'replay', order: record.order }
}

export function rememberOrder(
  key: string,
  fingerprint: string,
  order: Order,
): void {
  store.set(key, { fingerprint, order, storedAt: Date.now() })
}

export function resetIdempotencyStore(): void {
  store.clear()
}
