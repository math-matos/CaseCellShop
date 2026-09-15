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
