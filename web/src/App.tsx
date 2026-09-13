import { useEffect, useRef, useState } from 'react'
import { Header } from './components/Header'
import { ProductCard } from './components/ProductCard'
import { ApiError } from './lib/ApiError'
import { checkout, fetchProducts } from './lib/api'
import type { Feedback, Product } from './types'
import { formatCurrency } from './utils/format'

function App() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    fetchProducts()
      .then((data) => setProducts(data))
      .catch((error: unknown) => {
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Nao foi possivel carregar os produtos.',
        )
      })
  }, [])

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

    try {
      const order = await checkout(product.id, quantity)

      setProducts(
        (current) =>
          current?.map((item) =>
            item.id === order.productId
              ? { ...item, stock: order.remainingStock }
              : item,
          ) ?? current,
      )
      setQuantities((current) => ({ ...current, [order.productId]: 1 }))
      setFeedback({
        type: 'success',
        message: `Compra confirmada! Pedido ${order.id}: ${order.quantity}x ${order.productName} - total de ${formatCurrency(order.total)}.`,
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof ApiError
            ? error.message
            : 'Nao foi possivel concluir a compra. Tente novamente.',
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
