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

export interface Feedback {
  type: 'success' | 'error'
  message: string
}
