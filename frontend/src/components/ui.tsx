import { useEffect, type ReactNode } from 'react'

export function Button(props: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit'
  className?: string
}) {
  const { children, onClick, disabled, variant = 'default', size = 'md', type = 'button', className } = props
  const variantCls =
    variant === 'secondary' ? 'btn-secondary' :
    variant === 'destructive' ? 'btn-destructive' :
    variant === 'outline' ? 'btn-outline' :
    variant === 'ghost' ? 'btn-ghost' : 'btn-default'
  const sizeCls = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''
  return (
    <button
      type={type}
      className={`btn ${variantCls} ${sizeCls} ${className ?? ''}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function Modal(props: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
}) {
  const { open, title, children, onClose, size = 'md' } = props

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  const widthCls = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-lg'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-[modal-fade_0.15s_ease]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${widthCls} max-h-[calc(100vh-2rem)] overflow-auto rounded-lg border bg-card shadow-lg animate-[modal-pop_0.18s_ease]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card px-6 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function Spinner() {
  return <span className="spinner" aria-label="Loading" />
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10 text-muted-foreground">
      <Spinner /> <span className="ml-2">Loading...</span>
    </div>
  )
}

export function EmptyState(props: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="text-sm text-muted-foreground">{props.message}</div>
      {props.action ? <div>{props.action}</div> : null}
    </div>
  )
}

export function ErrorState(props: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-10 text-center text-destructive">
      <span>{props.message}</span>
      {props.onRetry ? (
        <button className="btn btn-outline btn-sm ml-3" onClick={props.onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}