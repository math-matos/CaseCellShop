import { errors } from './errors.js'

const DEFAULT_TOKEN = 'demo-token'

function expectedToken(): string {
  return process.env.AUTH_TOKEN ?? DEFAULT_TOKEN
}

/**
 * Valida o header `Authorization: Bearer <token>`.
 *
 * Em um sistema real isso seria um JWT verificado por assinatura; aqui um token
 * compartilhado basta para exercer o contrato e o cenario 9 da spec.
 */
export function assertAuthenticated(authorization: string | undefined): void {
  if (!authorization) {
    throw errors.unauthorized()
  }

  const [scheme, token] = authorization.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw errors.unauthorized()
  }

  if (token !== expectedToken()) {
    throw errors.unauthorized()
  }
}
