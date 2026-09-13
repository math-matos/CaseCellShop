import type { FastifyInstance } from 'fastify'
import { listProducts } from '../data/products.js'

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get('/products', async () => ({
    products: listProducts(),
  }))
}
