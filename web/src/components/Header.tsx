export function Header() {
  return (
    <header className="mx-auto max-w-4xl">
      <div className="flex items-center justify-end gap-2">
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
