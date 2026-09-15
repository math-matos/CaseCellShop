import { randomUUID } from 'node:crypto'
import cors from '@fastify/cors'
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify'
import { AppError, errors } from './lib/errors.js'
import { checkoutRoutes } from './routes/checkout.js'
import { healthRoutes } from './routes/health.js'
import { productRoutes } from './routes/products.js'
import type { ErrorResponse } from './types/index.js'

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string
  }
}

const CORRELATION_HEADER = 'x-correlation-id'
const MAX_CORRELATION_LENGTH = 128

function resolveCorrelationId(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw

  if (!value || value.length > MAX_CORRELATION_LENGTH) {
    return randomUUID()
  }

  return value
}

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger']
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false })

  app.register(cors, {
    origin: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Correlation-Id',
    ],
    exposedHeaders: ['X-Correlation-Id', 'Idempotency-Replayed'],
  })

  app.addHook('onRequest', async (request, reply) => {
    request.correlationId = resolveCorrelationId(
      request.headers[CORRELATION_HEADER],
    )
    reply.header(CORRELATION_HEADER, request.correlationId)
  })

  app.setErrorHandler((error, request, reply) => {
    const appError = toAppError(error)

    if (appError.statusCode >= 500) {
      request.log.error(
        { err: error, correlationId: request.correlationId },
        'erro inesperado no processamento da requisicao',
      )
    } else {
      request.log.info(
        {
          correlationId: request.correlationId,
          code: appError.code,
          statusCode: appError.statusCode,
        },
        'requisicao rejeitada',
      )
    }

    const body: ErrorResponse = {
      error: {
        code: appError.code,
        message: appError.message,
        correlationId: request.correlationId,
      },
    }

    return reply.status(appError.statusCode).send(body)
  })

  app.setNotFoundHandler((request, reply) => {
    const notFound = errors.routeNotFound()
    const body: ErrorResponse = {
      error: {
        code: notFound.code,
        message: notFound.message,
        correlationId: request.correlationId,
      },
    }

    return reply.status(notFound.statusCode).send(body)
  })

  app.register(healthRoutes)
  app.register(productRoutes)
  app.register(checkoutRoutes)

  return app
}

/**
 * Normaliza qualquer erro para o formato da spec. Erros de parse do Fastify
 * (JSON malformado, body vazio) chegam aqui com statusCode 4xx e viram
 * VALIDATION_ERROR; o resto vira 500 sem vazar a mensagem interna.
 */
function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  const statusCode = (error as { statusCode?: number })?.statusCode

  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    return errors.invalidBody()
  }

  return errors.serverError()
}
