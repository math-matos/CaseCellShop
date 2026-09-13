export interface Product {
  id: number
  name: string
  stock: number
  value: number
}

const products: Product[] = [
  { id: 1, name: 'Capinha Azul', stock: 2, value: 10 },
  { id: 2, name: 'Capinha Vermelha', stock: 5, value: 15 },
  { id: 3, name: 'Capinha Verde', stock: 3, value: 20 },
]

export function listProducts(): Product[] {
  return products
}

export function findProduct(id: number): Product | undefined {
  return products.find((product) => product.id === id)
}

export function decreaseStock(product: Product, quantity: number): Product {
  product.stock -= quantity
  return product
}
