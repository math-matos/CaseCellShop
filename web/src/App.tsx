import { useCallback, useEffect, useRef, useState } from 'react'
import { CartDrawer, type LineError } from './components/CartDrawer'
import { Header } from './components/Header'
import { ProductCard } from './components/ProductCard'
import { useCart } from './hooks/useCart'
import { ApiError } from './lib/ApiError'
import { checkout, fetchProducts, newIdempotencyKey } from './lib/api'
import type { Feedback, Product } from './types'
import { formatCurrency } from './utils/format'

function App() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [lineErrors, setLineErrors] = useState<Record<number, LineError>>({})
  const [retryableFailure, setRetryableFailure] = useState(false)

  const cart = useCart()

  /**
   * Idempotency-Key da tentativa de finalizar o carrinho.
   *
   * A chave e criada na primeira tentativa e so e descartada quando a compra tem
   * um desfecho definitivo (sucesso, ou erro de negocio). Em falha de rede ou 503
   * ela e PRESERVADA: o "Tentar novamente" retenta com a MESMA chave, entao se o
   * pedido chegou a ser criado no servidor o cliente recebe o pedido original em
   * vez de comprar duas vezes.
   *
   * Qualquer mudanca no carrinho invalida a chave: o payload mudou, entao aquela
   * tentativa deixou de existir (retentar com a mesma chave viraria 422).
   */
  const pendingKeyRef = useRef<string | null>(null)

  const loadProducts = useCallback(
    () =>
      fetchProducts().then(
        (data) => {
          setProducts(data)
          setLoadError(null)
        },
        (error: unknown) => {
          setLoadError(
            error instanceof ApiError
              ? error.message
              : 'Nao foi possivel carregar os produtos.',
          )
        },
      ),
    [],
  )

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  /** Descarta o estado da ultima tentativa quando o carrinho muda. */
  function resetCheckoutAttempt() {
    pendingKeyRef.current = null
    setRetryableFailure(false)
    setLineErrors({})
    setFeedback(null)
  }

  function changeQuantity(product: Product, delta: number) {
    const inCart =
      cart.items.find((item) => item.productId === product.id)?.quantity ?? 0
    const room = Math.max(product.stock - inCart, 1)
    setQuantities((current) => {
      const next = (current[product.id] ?? 1) + delta
      return { ...current, [product.id]: Math.min(Math.max(next, 1), room) }
    })
  }

  function handleAddToCart(product: Product) {
    const quantity = quantities[product.id] ?? 1
    cart.addItem(product, quantity)
    setQuantities((current) => ({ ...current, [product.id]: 1 }))
    resetCheckoutAttempt()
  }

  function changeCartQuantity(productId: number, delta: number) {
    const product = products?.find((entry) => entry.id === productId)
    const max = product ? Math.max(product.stock, 1) : Number.MAX_SAFE_INTEGER
    const current =
      cart.items.find((item) => item.productId === productId)?.quantity ?? 1
    cart.setQuantity(productId, Math.min(Math.max(current + delta, 1), max))
    resetCheckoutAttempt()
  }

  function removeFromCart(productId: number) {
    cart.removeItem(productId)
    resetCheckoutAttempt()
  }

  async function handleCheckout() {
    if (isCheckingOut || cart.items.length === 0) {
      return
    }

    setIsCheckingOut(true)
    setFeedback(null)
    setLineErrors({})
    setRetryableFailure(false)

    // Reusa a chave preservada de um retry; senao cria uma nova para a tentativa.
    const idempotencyKey = pendingKeyRef.current ?? newIdempotencyKey()
    pendingKeyRef.current = idempotencyKey

    try {
      const order = await checkout(
        cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        { idempotencyKey },
      )

      pendingKeyRef.current = null

      // Debita o estoque local de cada item do pedido.
      setProducts(
        (current) =>
          current?.map((entry) => {
            const line = order.items.find((item) => item.productId === entry.id)
            return line
              ? { ...entry, stock: Math.max(entry.stock - line.quantity, 0) }
              : entry
          }) ?? current,
      )

      cart.clear()
      setIsCartOpen(false)
      setFeedback({
        type: 'success',
        message: `Compra concluída! Pedido ${order.orderId} com ${
          order.items.length
        } ${order.items.length === 1 ? 'item' : 'itens'} — total de ${formatCurrency(order.total)}.`,
      })
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null
      const retryable = apiError?.isRetryable ?? false

      // Erro de negocio (estoque/validacao): o cliente precisa ajustar, entao
      // liberamos a chave. Falha de rede/503: preservamos para o retry seguro.
      if (!retryable) {
        pendingKeyRef.current = null
      }
      if (apiError?.requiresCatalogRefresh) {
        void loadProducts()
      }

      setRetryableFailure(retryable)

      // Destaca no carrinho o item culpado, quando o backend o identifica.
      if (apiError?.productId !== undefined) {
        setLineErrors({
          [apiError.productId]: { message: apiError.message, retryable },
        })
      }

      setFeedback({
        type: 'error',
        message: retryable
          ? 'Não foi possível concluir agora. Suas escolhas estão salvas — toque em “Tentar novamente” em instantes.'
          : (apiError?.message ??
            'Não foi possível concluir a compra. Revise os itens do carrinho.'),
      })
      setIsCartOpen(true)
    } finally {
      setIsCheckingOut(false)
    }
  }

  const feedbackStyles: Record<Feedback['type'], string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <div className="min-h-screen bg-[#FFF8E1] px-4 py-10">
      <Header cartCount={cart.totalItems} onOpenCart={() => setIsCartOpen(true)} />

      <main className="mx-auto max-w-4xl">
        {feedback && (
          <p
            role="status"
            className={`mt-5 rounded-xl border px-4 py-3 font-quicksand text-sm font-medium ${feedbackStyles[feedback.type]}`}
          >
            {feedback.message}
          </p>
        )}

        {loadError && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-quicksand text-sm font-medium text-red-700"
          >
            {loadError}
          </p>
        )}

        {!loadError && !products && (
          <p className="mt-6 font-quicksand text-slate-500">
            Carregando produtos...
          </p>
        )}

        {!loadError && products && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={quantities[product.id] ?? 1}
                inCart={
                  cart.items.find((item) => item.productId === product.id)
                    ?.quantity ?? 0
                }
                isDisabled={isCheckingOut}
                onChangeQuantity={changeQuantity}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </main>

      <CartDrawer
        open={isCartOpen}
        items={cart.items}
        totalValue={cart.totalValue}
        isProcessing={isCheckingOut}
        lineErrors={lineErrors}
        hasRetryable={retryableFailure}
        onClose={() => setIsCartOpen(false)}
        onChangeQuantity={changeCartQuantity}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
      />
    </div>
  )
}

export default App
