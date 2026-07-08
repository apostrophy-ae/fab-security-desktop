import type { ReactNode, SelectHTMLAttributes } from 'react'

/**
 * Shared UI primitives for the trading dashboard, in the dark FAB design
 * language: flat surfaces (#1a1c1e cards on #111315 page), 1px #2a2c2e borders,
 * #0062ff action accent, soft green/red for market movement.
 */

// ─── Pop-out (detach to window) button ───────────────────────────────────
/** Small square icon button for tearing a section into its own window. */
export function PopOutButton({ onClick, title = 'Send to the board window (another monitor)' }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-dark bg-[#1a1c1e] text-content-muted transition-colors hover:border-action/60 hover:text-content"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
      </svg>
    </button>
  )
}

// ─── Panel / card ────────────────────────────────────────────────────────
export function Panel({
  title,
  actions,
  children,
  className = '',
  bodyClassName = '',
  noPadding = false,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  noPadding?: boolean
}) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-xl border border-border-dark bg-surface ${className}`}>
      {(title || actions) && (
        <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border-dark px-4">
          {typeof title === 'string' ? (
            <h3 className="text-[13px] font-semibold text-content">{title}</h3>
          ) : (
            title
          )}
          {actions && <div className="relative z-20 flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={`${noPadding ? '' : 'p-4'} min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

// ─── Styled select ─────────────────────────────────────────────────────────
export function Select({
  label,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      {label && <span className="text-[11px] font-medium text-content-muted">{label}</span>}
      <div className="relative min-w-0">
        <select
          {...props}
          className="h-8 w-full min-w-0 appearance-none rounded-md border border-border-dark bg-[#15171a] pl-2.5 pr-8 text-[13px] text-content outline-none transition-colors hover:border-[#3a3d42] focus:border-action"
        />
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-content-muted"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </label>
  )
}

// ─── Buttons ───────────────────────────────────────────────────────────────
export function Button({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'buy' | 'sell'
  size?: 'sm' | 'md'
}) {
  const variants = {
    default: 'border border-border-dark bg-[#1f2226] text-content hover:bg-[#262a2f]',
    primary: 'bg-action text-white hover:bg-[#1d72ff]',
    ghost: 'text-content-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-content',
    buy: 'bg-[rgba(0,98,255,0.16)] text-[#5b9bff] border border-[rgba(0,98,255,0.4)] hover:bg-[rgba(0,98,255,0.26)]',
    sell: 'bg-[rgba(193,8,11,0.16)] text-down border border-[rgba(255,107,114,0.4)] hover:bg-[rgba(193,8,11,0.26)]',
  }
  const sizes = { sm: 'h-7 px-2.5 text-[12px]', md: 'h-8 px-3.5 text-[13px]' }
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

// ─── Badge / pill ────────────────────────────────────────────────────────
export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: 'neutral' | 'up' | 'down' | 'info' | 'warn'
  className?: string
}) {
  const tones = {
    neutral: 'bg-[rgba(255,255,255,0.06)] text-content-muted',
    up: 'bg-bid-surface text-up',
    down: 'bg-offer-surface text-down',
    info: 'bg-[rgba(0,98,255,0.14)] text-[#5b9bff]',
    warn: 'bg-[rgba(255,170,0,0.14)] text-warning',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

// ─── Segmented tabs ────────────────────────────────────────────────────────
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = '',
}: {
  tabs: readonly T[]
  value: T
  onChange: (t: T) => void
  className?: string
}) {
  return (
    <div className={`inline-flex rounded-lg border border-border-dark bg-[#15171a] p-0.5 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
            value === t ? 'bg-action text-white' : 'text-content-muted hover:text-content'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ─── Right-side drawer (slide-over) ─────────────────────────────────────────
export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 'w-[420px]',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  width?: string
}) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full ${width} max-w-[92vw] flex-col border-l border-border-dark bg-surface shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-dark px-4">
          <div className="text-[14px] font-semibold text-content">{title}</div>
          <button onClick={onClose} className="rounded p-1 text-content-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-content" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  )
}

// ─── Direction arrow ─────────────────────────────────────────────────────
export function DirArrow({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'flat') return <span className="text-flat">—</span>
  return (
    <span className={direction === 'up' ? 'text-up' : 'text-down'}>
      {direction === 'up' ? '▲' : '▼'}
    </span>
  )
}
