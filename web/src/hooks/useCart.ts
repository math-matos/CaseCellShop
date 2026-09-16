import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CartItem, Product } from '../types'

const STORAGE_KEY = 'casecellshop.cart'

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const item = value as Record<string, unknown>
  return (
    typeof item.productId === 'number' &&
    typeof item.name === 'string' &&
    typeof item.unitPrice === 'number' &&
    typeof item.quantity === 'number' &&
    item.quantity >= 1
  )
}

function readStoredCart(): CartItem[] {
  if (typeof localStorage === 'undefined') {
    return []
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : []
  } catch {
    return []
  }
}

export interface UseCart {
  items: CartItem[]
  totalItems: number
  totalValue: number
  /** Adiciona (ou soma a) uma linha, respeitando o estoque conhecido. */
  addItem: (product: Product, quantity: number) => void
  setQuantity: (productId: number, quantity: number) => void
  removeItem: (productId: number) => void
  clear: () => void
}

/**
 * Estado do carrinho com persistencia em localStorage — o cliente nao perde os
 * itens ao recarregar a pagina. O estoque so e validado de verdade no checkout;
 * aqui o clamp serve apenas para nao deixar pedir mais do que se sabe existir.
 */
export function useCart(): UseCart {
  const [items, setItems] = useState<CartItem[]>(readStoredCart)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Sem persistencia (ex.: modo privativo): o carrinho segue em memoria.
    }
  }, [items])

  const addItem = useCallback((product: Product, quantity: number) => {
    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id)
      const desired = (existing?.quantity ?? 0) + quantity
      const clamped = Math.min(Math.max(desired, 1), product.stock)

      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: clamped }
            : item,
        )
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.value,
          quantity: clamped,
        },
      ]
    })
  }, [])

  const setQuantity = useCallback((productId: number, quantity: number) => {
    setItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(quantity, 1) }
          : item,
      ),
    )
  }, [])

  const removeItem = useCallback((productId: number) => {
    setItems((current) =>
      current.filter((item) => item.productId !== productId),
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  )
  const totalValue = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items],
  )

  return {
    items,
    totalItems,
    totalValue,
    addItem,
    setQuantity,
    removeItem,
    clear,
  }
}
