import type { FastifyInstance } from 'fastify'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const payload = async () => ({ status: 'ok' as const })

  app.get('/', payload)
  app.get('/health', payload)
}
