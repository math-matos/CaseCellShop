import type { ApiErrorCode } from '../types'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly correlationId?: string
  /** Item culpado em erros de estoque/produto. */
  readonly productId?: number

  constructor(
    message: string,
    code: ApiErrorCode = 'SERVER_ERROR',
    status = 0,
    correlationId?: string,
    productId?: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.correlationId = correlationId
    this.productId = productId
  }

  /**
   * Falhas de rede e indisponibilidade sao seguras de retentar com a MESMA
   * Idempotency-Key: o pedido ou nao chegou, ou o servidor devolve o original.
   * Erros de negocio (400/404/409) nao mudam de resultado em uma nova tentativa.
   */
  get isRetryable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'SERVICE_UNAVAILABLE'
  }

  /** Erros que indicam que o estoque local esta defasado. */
  get requiresCatalogRefresh(): boolean {
    return (
      this.code === 'INSUFFICIENT_STOCK' || this.code === 'PRODUCT_NOT_FOUND'
    )
  }
}
