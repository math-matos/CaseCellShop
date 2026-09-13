export interface Product {
  id: number
  name: string
  stock: number
  value: number
}

export interface Order {
  id: string
  productId: number
  productName: string
  quantity: number
  unitValue: number
  total: number
  remainingStock: number
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'PRODUCT_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'SERVICE_UNAVAILABLE'

export interface CheckoutBody {
  productId?: unknown
  quantity?: unknown
}
