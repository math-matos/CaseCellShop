import Fastify from 'fastify'

const app = Fastify({ logger: false })

app.get('/health', async () => ({ status: 'ok' }))

app.listen({ port: 3333 }, () => {})
