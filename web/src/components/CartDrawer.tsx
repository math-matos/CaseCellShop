import type { CartItem } from '../types'
import { formatCurrency } from '../utils/format'

export interface LineError {
  message: string
  retryable: boolean
}

interface CartDrawerProps {
  open: boolean
  items: CartItem[]
  totalValue: number
  isProcessing: boolean
  /** Erros por produto da ultima tentativa de finalizar. */
  lineErrors: Record<number, LineError>
  /** Ha itens que falharam por rede/indisponibilidade e podem ser retentados. */
  hasRetryable: boolean
  onClose: () => void
  onChangeQuantity: (productId: number, delta: number) => void
  onRemove: (productId: number) => void
  onCheckout: () => void
}

export function CartDrawer({
  open,
  items,
  totalValue,
  isProcessing,
  lineErrors,
  hasRetryable,
  onClose,
  onChangeQuantity,
  onRemove,
  onCheckout,
}: CartDrawerProps) {
  const isEmpty = items.length === 0

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Painel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrinho de compras"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-poppins text-lg font-bold text-slate-900">
            Seu carrinho
          </h2>
          <button
            type="button"
            aria-label="Fechar carrinho"
            onClick={onClose}
            className="rounded-lg px-2 py-1 font-quicksand text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isEmpty ? (
            <p className="mt-10 text-center font-quicksand text-slate-500">
              Seu carrinho está vazio.
              <br />
              Adicione uma capinha para começar.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const error = lineErrors[item.productId]
                return (
                  <li
                    key={item.productId}
                    className={`rounded-xl border p-3 ${
                      error
                        ? 'border-red-200 bg-red-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-poppins text-sm font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <p className="mt-0.5 font-quicksand text-xs text-slate-500">
                          {formatCurrency(item.unitPrice)} cada
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remover ${item.name} do carrinho`}
                        disabled={isProcessing}
                        onClick={() => onRemove(item.productId)}
                        className="font-quicksand text-xs font-medium text-slate-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-300">
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${item.name}`}
                          disabled={isProcessing || item.quantity <= 1}
                          onClick={() => onChangeQuantity(item.productId, -1)}
                          className="px-2.5 font-quicksand text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                        >
                          −
                        </button>
                        <span className="flex min-w-9 items-center justify-center border-x border-slate-300 px-1 font-quicksand text-sm font-semibold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${item.name}`}
                          disabled={isProcessing}
                          onClick={() => onChangeQuantity(item.productId, 1)}
                          className="px-2.5 font-quicksand text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-poppins text-sm font-bold text-slate-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </span>
                    </div>

                    {error && (
                      <p className="mt-2 font-quicksand text-xs font-medium text-red-600">
                        {error.message}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {!isEmpty && (
          <footer className="border-t border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="font-quicksand text-sm text-slate-600">
                Total
              </span>
              <span className="font-poppins text-xl font-bold text-slate-900">
                {formatCurrency(totalValue)}
              </span>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={onCheckout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4A7FCB] py-3 font-poppins text-sm font-semibold text-white transition-colors hover:bg-[#3d6bb0] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isProcessing && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              )}
              {isProcessing
                ? 'Processando...'
                : hasRetryable
                  ? 'Tentar novamente'
                  : 'Finalizar compra'}
            </button>
          </footer>
        )}
      </aside>
    </div>
  )
}
