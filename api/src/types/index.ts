export interface Product {
  id: number
  name: string
  stock: number
  value: number
}

export interface OrderItem {
  productId: number
  productName: string
  quantity: number
  unitPrice: number
}

export type OrderStatus = 'confirmed'

export interface Order {
  orderId: string
  status: OrderStatus
  items: OrderItem[]
  total: number
  createdAt: string
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'PRODUCT_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'IDEMPOTENCY_KEY_REUSE'
  | 'SERVICE_UNAVAILABLE'
  | 'SERVER_ERROR'
  | 'NOT_FOUND'

export interface ErrorResponse {
  error: {
    code: ErrorCode
    message: string
    correlationId: string
  }
}

/** Body cru do POST /checkout, antes da validacao. */
export interface CheckoutBody {
  productId?: unknown
  quantity?: unknown
}

/** Body ja validado: o preco nunca vem do cliente. */
export interface CheckoutInput {
  productId: number
  quantity: number
}
