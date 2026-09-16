interface HeaderProps {
  cartCount: number
  onOpenCart: () => void
}

export function Header({ cartCount, onOpenCart }: HeaderProps) {
  return (
    <header className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-quicksand text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Um oferecimento
          </span>
          <img
            src="/totvs-logo.png"
            alt="TOTVS"
            className="h-5 w-auto"
            loading="lazy"
          />
        </div>

        <button
          type="button"
          onClick={onOpenCart}
          aria-label={`Abrir carrinho com ${cartCount} item(ns)`}
          className="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-quicksand text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Carrinho
          {cartCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#4A7FCB] px-1.5 font-poppins text-xs font-bold text-white">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      <div className="mt-5">
        <h1 className="font-poppins text-2xl font-bold text-slate-900 md:text-3xl">
          CaseCellShop
        </h1>
        <p className="mt-1 font-quicksand text-slate-600">
          Escolha uma capinha e finalize sua compra.
        </p>
      </div>
    </header>
  )
}
