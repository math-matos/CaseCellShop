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

export type OrderStatus = 'pending' | 'confirmed'

export interface Order {
  orderId: string
  status: OrderStatus
  items: OrderItem[]
  total: number
  createdAt: string
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'PRODUCT_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'IDEMPOTENCY_KEY_REUSE'
  | 'SERVICE_UNAVAILABLE'
  | 'SERVER_ERROR'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'

export interface ErrorResponse {
  error: {
    code: ApiErrorCode
    message: string
    correlationId: string
  }
}

export interface Feedback {
  type: 'success' | 'error'
  message: string
}
