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
    /** Item culpado em erros de estoque/produto, para destacar no carrinho. */
    productId?: number
  }
}

/** Uma linha do carrinho. O preco unitario e guardado so para exibir o
 * subtotal no front — o valor cobrado sempre vem do catalogo no backend. */
export interface CartItem {
  productId: number
  name: string
  unitPrice: number
  quantity: number
}

/** Item enviado ao checkout. O preco nunca vai no corpo — sai do catalogo. */
export interface CheckoutItem {
  productId: number
  quantity: number
}

export interface Feedback {
  type: 'success' | 'error'
  message: string
}
