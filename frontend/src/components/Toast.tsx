import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastVariant = 'default' | 'success' | 'destructive'
type ToastItem = { id: number; message: string; variant: ToastVariant }

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, variant: ToastVariant = 'default') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, message, variant }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`min-w-[240px] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg animate-[modal-pop_0.18s_ease] ${
              t.variant === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : t.variant === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'bg-card text-foreground'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}