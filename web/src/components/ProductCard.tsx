import type { Product } from '../types'
import { formatCurrency } from '../utils/format'

interface ProductCardProps {
  product: Product
  quantity: number
  /** Quantidade deste produto ja adicionada ao carrinho. */
  inCart: number
  isDisabled: boolean
  onChangeQuantity: (product: Product, delta: number) => void
  onAddToCart: (product: Product) => void
}

export function ProductCard({
  product,
  quantity,
  inCart,
  isDisabled,
  onChangeQuantity,
  onAddToCart,
}: ProductCardProps) {
  const soldOut = product.stock < 1
  const remaining = Math.max(product.stock - inCart, 0)
  const canAdd = !isDisabled && !soldOut && remaining > 0

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-poppins font-semibold text-slate-900">
          {product.name}
        </h2>
        <p className="mt-1 font-poppins text-lg font-bold text-[#4A7FCB]">
          {formatCurrency(product.value)}
        </p>
        <p
          className={`mt-1 font-quicksand text-xs ${soldOut ? 'text-red-500' : 'text-slate-500'}`}
        >
          {soldOut ? 'Esgotado' : `${product.stock} em estoque`}
          {inCart > 0 && !soldOut && (
            <span className="text-[#4A7FCB]"> · {inCart} no carrinho</span>
          )}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <span className="block font-quicksand text-xs font-medium text-slate-600">
            Quantidade
          </span>
          <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-slate-300">
            <button
              type="button"
              aria-label={`Diminuir quantidade de ${product.name}`}
              disabled={isDisabled || soldOut || quantity <= 1}
              onClick={() => onChangeQuantity(product, -1)}
              className="px-3 font-quicksand text-lg font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              −
            </button>
            <span className="flex flex-1 items-center justify-center border-x border-slate-300 py-2 font-quicksand text-sm font-semibold text-slate-900">
              {quantity}
            </span>
            <button
              type="button"
              aria-label={`Aumentar quantidade de ${product.name}`}
              disabled={isDisabled || soldOut || quantity >= remaining}
              onClick={() => onChangeQuantity(product, 1)}
              className="px-3 font-quicksand text-lg font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={!canAdd}
          onClick={() => onAddToCart(product)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4A7FCB] py-2.5 font-poppins text-sm font-semibold text-white transition-colors hover:bg-[#3d6bb0] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {soldOut
            ? 'Esgotado'
            : remaining < 1
              ? 'Estoque no carrinho'
              : 'Adicionar ao carrinho'}
        </button>
      </div>
    </div>
  )
}
