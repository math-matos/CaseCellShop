import Fastify from 'fastify'

const app = Fastify({ logger: false })

app.get('/', async () => ({ status: 'ok' }))

app.get('/products', async () => ({
  products: [
    { id: 1, name: 'Capinha Azul', stock: 2, value: 10 },
    { id: 2, name: 'Capinha Vermelha', stock: 5, value: 15 },
    { id: 3, name: 'Capinha Verde', stock: 3, value: 20 },
  ],
}))

app.get('/cart', async () => ({ cart: [] }))

app.listen({ port: 3333 }, () => {})
