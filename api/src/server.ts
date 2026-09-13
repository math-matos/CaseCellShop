import Fastify from 'fastify'
import cors from '@fastify/cors'
import { productRoutes } from './routes/products.js'
import { checkoutRoutes } from './routes/checkout.js'

const app = Fastify({ logger: false })

await app.register(cors, { origin: true })

app.get('/', async () => ({ status: 'ok' }))

await app.register(productRoutes)
await app.register(checkoutRoutes)

app.listen({ port: 3333 }, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log('API rodando em http://localhost:3333')
})
