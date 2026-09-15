import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './components/Header'
import { ProductCard } from './components/ProductCard'
import { ApiError } from './lib/ApiError'
import { checkout, fetchProducts, newIdempotencyKey } from './lib/api'
import type { Feedback, Product } from './types'
import { formatCurrency } from './utils/format'

function App() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const isSubmittingRef = useRef(false)

  /**
   * Idempotency-Key por tentativa de compra.
   *
   * A chave e criada no primeiro clique e so e descartada quando a compra tem
   * um desfecho definitivo. Em falha de rede ou 503 ela e preservada: o proximo
   * clique retenta com a MESMA chave, entao se o pedido chegou a ser criado no
   * servidor o cliente recebe o pedido original em vez de comprar duas vezes.
   */
  const pendingKeysRef = useRef<Record<number, string>>({})

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

  function changeQuantity(product: Product, delta: number) {
    setQuantities((current) => {
      const next = (current[product.id] ?? 1) + delta
      const clamped = Math.min(Math.max(next, 1), Math.max(product.stock, 1))
      return { ...current, [product.id]: clamped }
    })
  }

  async function handleBuy(product: Product) {
    if (isSubmittingRef.current || product.stock < 1) {
      return
    }

    isSubmittingRef.current = true
    setProcessingId(product.id)
    setFeedback(null)

    const quantity = quantities[product.id] ?? 1
    const idempotencyKey =
      pendingKeysRef.current[product.id] ?? newIdempotencyKey()
    pendingKeysRef.current[product.id] = idempotencyKey

    try {
      const order = await checkout(product.id, quantity, { idempotencyKey })
      const [item] = order.items

      delete pendingKeysRef.current[product.id]

      setProducts(
        (current) =>
          current?.map((entry) =>
            entry.id === item.productId
              ? { ...entry, stock: Math.max(entry.stock - item.quantity, 0) }
              : entry,
          ) ?? current,
      )
      setQuantities((current) => ({ ...current, [item.productId]: 1 }))
      setFeedback({
        type: 'success',
        message: `Compra confirmada! Pedido ${order.orderId}: ${item.quantity}x ${item.productName} - total de ${formatCurrency(order.total)}.`,
      })
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null

      if (!apiError?.isRetryable) {
        delete pendingKeysRef.current[product.id]
      }

      if (apiError?.requiresCatalogRefresh) {
        void loadProducts()
      }

      setFeedback({
        type: 'error',
        message: apiError?.isRetryable
          ? `${apiError.message} Clique em Comprar novamente - a tentativa e segura e nao gera pedido duplicado.`
          : (apiError?.message ??
            'Nao foi possivel concluir a compra. Tente novamente.'),
      })
    } finally {
      isSubmittingRef.current = false
      setProcessingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF8E1] px-4 py-10">
      <Header />

      <main className="mx-auto max-w-4xl">
        {feedback && (
          <p
            role="status"
            className={`mt-5 rounded-xl border px-4 py-3 font-quicksand text-sm font-medium ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
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
                isProcessing={processingId === product.id}
                isDisabled={processingId !== null || product.stock < 1}
                onChangeQuantity={changeQuantity}
                onBuy={handleBuy}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
