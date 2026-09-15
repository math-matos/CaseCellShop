import type { ErrorCode } from '../types/index.js'

/**
 * Erro de negocio com status HTTP e codigo definidos em docs/checkout-spec.md.
 * Qualquer outro erro que escapar vira 500 SERVER_ERROR no handler global.
 */
export class AppError extends Error {
  readonly statusCode: number
  readonly code: ErrorCode

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
  }
}

export const errors = {
  unauthorized: () =>
    new AppError(
      401,
      'UNAUTHORIZED',
      'Autenticação obrigatória para concluir a compra.',
    ),

  invalidProduct: () =>
    new AppError(
      400,
      'VALIDATION_ERROR',
      'Informe um produto válido para concluir a compra.',
    ),

  invalidQuantity: () =>
    new AppError(
      400,
      'VALIDATION_ERROR',
      'A quantidade deve ser um número inteiro maior ou igual a 1.',
    ),

  invalidBody: () =>
    new AppError(
      400,
      'VALIDATION_ERROR',
      'Corpo da requisição inválido. Envie um JSON com productId e quantity.',
    ),

  invalidIdempotencyKey: () =>
    new AppError(
      400,
      'VALIDATION_ERROR',
      'Informe um Idempotency-Key válido no formato UUID.',
    ),

  productNotFound: () =>
    new AppError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.'),

  outOfStock: (productName: string) =>
    new AppError(
      409,
      'INSUFFICIENT_STOCK',
      `${productName} está esgotado no momento.`,
    ),

  insufficientStock: (productName: string, available: number) =>
    new AppError(
      409,
      'INSUFFICIENT_STOCK',
      `Estoque insuficiente: restam apenas ${available} unidade(s) de ${productName}.`,
    ),

  idempotencyKeyReuse: () =>
    new AppError(
      422,
      'IDEMPOTENCY_KEY_REUSE',
      'Esta Idempotency-Key já foi usada com outros dados.',
    ),

  serviceUnavailable: () =>
    new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Serviço temporariamente indisponível. Tente novamente em instantes.',
    ),

  serverError: () =>
    new AppError(500, 'SERVER_ERROR', 'Erro de servidor inesperado.'),

  routeNotFound: () =>
    new AppError(404, 'NOT_FOUND', 'Recurso não encontrado.'),
}
