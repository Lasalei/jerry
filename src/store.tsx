import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { db, type NewTransaction } from './lib/db'
import type { DataSnapshot, GridCell, Size, Variant } from './lib/types'

interface StoreValue {
  data: DataSnapshot
  loading: boolean
  /** qty available for a specific SKU. */
  available: (styleId: string, variant: Variant, size: Size) => number
  /** total remaining across all SKUs of a style. */
  styleTotal: (styleId: string) => number
  // actions
  addStyle: (name: string, grid: GridCell[], imageUrl: string | null) => Promise<void>
  updateStyle: (
    id: string,
    name: string,
    grid: GridCell[],
    imageUrl: string | null,
  ) => Promise<void>
  deleteStyle: (id: string) => Promise<void>
  addTransaction: (tx: NewTransaction) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  updateOrder: (
    id: string,
    patch: { pickupDate?: string | null; sent?: boolean },
  ) => Promise<void>
  importData: (snapshot: DataSnapshot) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataSnapshot>({
    styles: [],
    stock: [],
    transactions: [],
  })
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const snapshot = await db.getAll()
    setData(snapshot)
  }, [])

  useEffect(() => {
    let active = true
    db.getAll().then((snapshot) => {
      if (active) {
        setData(snapshot)
        setLoading(false)
      }
    })
    const unsub = db.subscribe(() => {
      void reload()
    })
    return () => {
      active = false
      unsub()
    }
  }, [reload])

  const available = useCallback(
    (styleId: string, variant: Variant, size: Size) => {
      const unit = data.stock.find(
        (u) => u.style_id === styleId && u.variant === variant && u.size === size,
      )
      return unit?.qty ?? 0
    },
    [data.stock],
  )

  const styleTotal = useCallback(
    (styleId: string) =>
      data.stock
        .filter((u) => u.style_id === styleId)
        .reduce((sum, u) => sum + u.qty, 0),
    [data.stock],
  )

  const value = useMemo<StoreValue>(
    () => ({
      data,
      loading,
      available,
      styleTotal,
      addStyle: async (name, grid, imageUrl) => {
        await db.addStyle(name, grid, imageUrl)
        await reload()
      },
      updateStyle: async (id, name, grid, imageUrl) => {
        await db.updateStyle(id, name, grid, imageUrl)
        await reload()
      },
      deleteStyle: async (id) => {
        await db.deleteStyle(id)
        await reload()
      },
      addTransaction: async (tx) => {
        await db.addTransaction(tx)
        await reload()
      },
      deleteTransaction: async (id) => {
        await db.deleteTransaction(id)
        await reload()
      },
      updateOrder: async (id, patch) => {
        await db.updateOrder(id, patch)
        await reload()
      },
      importData: async (snapshot) => {
        await db.importData(snapshot)
        await reload()
      },
    }),
    [data, loading, available, styleTotal, reload],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
