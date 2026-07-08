import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FULL_MARKET, CANDLES, fmtPrice, fmtInt, fmtPct, bluechipFirst } from '../data'
import type { PortfolioPosition } from '../data'
import { DESK_CUSTOMERS, findCustomer } from '../deskData'
import type { DeskCustomer } from '../deskData'
import { usePrices } from '../simData'
import { isLiveSymbol } from '../liveData'

/**
 * Broker Desk — a split-screen, widget-based trading desk.
 *
 *  ┌ Market Watch ─────────┬ Customers (stacked) ───────────────┐
 *  │ search · quote · chart │ SIF entry → portfolio + contact +  │
 *  │ market table           │ Buy (blue) / Sell (red) per client │
 *  └────────────────────────┴────────────────────────────────────┘
 *
 * There is no step-through journey: entering a SIF opens/updates a customer and
 * every customer widget reflects it immediately. Multiple customers can be kept
 * open ("stacked"). Buy is blue, Sell is red, and both take multiple line items.
 */

const BLUE = '#0062ff'
const RED = '#e0383d'
const fmtMoney = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-US')
const priceOf = (short: string) => FULL_MARKET.find((s) => s.symbolShortName === short)?.lastPrice ?? 0


// ─── Order-placed toast notifications ────────────────────────────────────────
type ToastTone = 'buy' | 'sell'
const ToastCtx = createContext<(msg: string, tone: ToastTone) => void>(() => {})
const useToast = () => useContext(ToastCtx)

interface Toast { id: number; msg: string; tone: ToastTone }
function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[90] flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 rounded-xl px-5 py-3 text-[15px] font-bold text-white shadow-2xl ring-1 ring-white/20"
          style={{ background: t.tone === 'buy' ? BLUE : RED }}
        >
          <span className="grid size-6 place-items-center rounded-full bg-white/25 text-[13px]">✓</span>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ─── Mini sparkline from the symbol's candles ────────────────────────────────
function Sparkline({ symbol }: { symbol: string }) {
  const candles = CANDLES[symbol]
  if (!candles || candles.length < 2) return <div className="h-14" />
  const closes = candles.slice(-40).map((c) => c.c)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const span = max - min || 1
  const w = 260
  const h = 56
  const pts = closes
    .map((c, i) => `${((i / (closes.length - 1)) * w).toFixed(1)},${(h - ((c - min) / span) * h).toFixed(1)}`)
    .join(' ')
  const up = closes[closes.length - 1] >= closes[0]
  const color = up ? '#2fd07a' : RED
  const fillPts = `${pts} ${w},${h} 0,${h}`
  const gradId = `sg-${symbol}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Left: Market Watch ──────────────────────────────────────────────────────
function MarketWatch({ symbol, onPick }: { symbol: string; onPick: (s: string) => void }) {
  const [q, setQ] = useState('')
  const price = usePrices()
  const prevPricesRef = useRef<Record<string, number>>({})
  const [tickMap, setTickMap] = useState<Record<string, 'up' | 'down'>>({})

  useEffect(() => {
    const updates: Record<string, 'up' | 'down'> = {}
    for (const s of FULL_MARKET) {
      const cur = price(s.symbolShortName)?.last ?? s.lastPrice
      const prev = prevPricesRef.current[s.symbolShortName]
      if (prev !== undefined && Math.abs(cur - prev) > 0.0001) {
        updates[s.symbolShortName] = cur > prev ? 'up' : 'down'
      }
      prevPricesRef.current[s.symbolShortName] = cur
    }
    if (Object.keys(updates).length > 0) {
      setTickMap(updates)
      const t = setTimeout(() => setTickMap((p) => Object.keys(p).length > 0 ? {} : p), 650)
      return () => clearTimeout(t)
    }
  }, [price])

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return FULL_MARKET.filter(
      (s) => !query || `${s.symbolName} ${s.symbolShortName}`.toLowerCase().includes(query),
    ).slice(0, 60)
  }, [q])
  const sel = FULL_MARKET.find((s) => s.symbolShortName === symbol)
  const selQ = sel ? price(sel.symbolShortName) : null
  const selLast = selQ?.last ?? sel?.lastPrice ?? 0
  const selChg = selQ?.change ?? sel?.change ?? 0
  const selChgPct = selQ?.changePct ?? sel?.changePct ?? 0

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[rgba(0,98,255,0.22)] bg-[#07090e] shadow-[0_0_0_1px_rgba(0,98,255,0.04),0_8px_32px_rgba(0,0,0,0.5)]">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[rgba(0,98,255,0.15)] bg-gradient-to-r from-[#0b1220] via-[#0d1018] to-[#0f1018] px-3">
        <span className="inline-block size-1.5 rounded-full bg-up shadow-[0_0_5px_#2fd07a]" title="Live market data" />
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#5b9bff]">Market Watch</h3>
        <span className="text-[10px] text-content-subtle">· filters Buy panel</span>
      </header>

      <div className="shrink-0 border-b border-border-dark p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search symbol… (EMAAR, DIB, SALIK)"
          className="h-9 w-full rounded-md border border-[rgba(0,98,255,0.2)] bg-[#0b0e15] px-3 text-[13px] text-content outline-none focus:border-[#5b9bff]"
        />
        {sel && (
          <div className="mt-3 rounded-lg border border-[rgba(0,98,255,0.28)] bg-gradient-to-br from-[#0c1528] to-[#080c14] p-3 shadow-[0_0_24px_rgba(0,98,255,0.1)]">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[14px] font-semibold text-content">
                  {sel.symbolShortName}
                  {isLiveSymbol(sel.symbolShortName)
                    ? <span className="inline-flex items-center gap-1 text-[9px] font-bold text-up"><span className="inline-block size-1.5 rounded-full bg-up shadow-[0_0_5px_#2fd07a]" />LIVE</span>
                    : <span className="text-[9px] font-medium text-content-subtle">SIM</span>}
                </div>
                <div className="text-[11px] text-content-muted">{sel.symbolName}</div>
              </div>
              <div className="text-right">
                <div className="text-[22px] font-black tabular-nums text-content leading-none">{fmtPrice(selLast)}</div>
                <div className={`mt-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ${selChg >= 0 ? 'bg-[rgba(47,208,122,0.1)] text-up ring-[rgba(47,208,122,0.2)]' : 'bg-[rgba(255,107,114,0.1)] text-down ring-[rgba(255,107,114,0.2)]'}`}>
                  {selChg >= 0 ? '+' : ''}{fmtPrice(selChg)} ({fmtPct(selChgPct)})
                </div>
              </div>
            </div>
            <div className="mt-2"><Sparkline symbol={sel.symbolShortName} /></div>
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-content-muted">
              <span>Bid {fmtPrice(sel.bidPrice)}</span>
              <span>Ask {fmtPrice(sel.offerPrice)}</span>
              <span>Vol {fmtInt(sel.volume)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12.5px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-[#0c0e12] text-[11px] uppercase tracking-wide text-content-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Symbol</th>
              <th className="px-3 py-2 text-right font-medium">Last</th>
              <th className="px-3 py-2 text-right font-medium">Chg%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const rq = price(s.symbolShortName)
              const last = rq?.last ?? s.lastPrice
              const pct = rq?.changePct ?? s.changePct
              return (
                <tr
                  key={s.symbolShortName}
                  onClick={() => onPick(s.symbolShortName)}
                  className={`cursor-pointer border-b border-[rgba(255,255,255,0.04)] transition-colors hover:bg-[rgba(0,98,255,0.07)] ${
                    s.symbolShortName === symbol ? 'bg-[rgba(0,98,255,0.18)]' : ''
                  }`}
                >
                  <td className="px-3 py-1.5 text-left">
                    {isLiveSymbol(s.symbolShortName) && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-up align-middle shadow-[0_0_4px_#2fd07a]" title="Live" />}
                    <span className="font-medium text-content">{s.symbolShortName}</span>
                    <span className="ml-2 text-[11px] text-content-muted">{s.marketShortName}</span>
                  </td>
                  <td className={`px-3 py-1.5 text-right text-content${tickMap[s.symbolShortName] === 'up' ? ' tick-up' : tickMap[s.symbolShortName] === 'down' ? ' tick-down' : ''}`}>{fmtPrice(last)}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${pct >= 0 ? 'text-up' : 'text-down'}`}>{fmtPct(pct)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Buy panel (BLUE) — multiple line items ──────────────────────────────────
interface BuyLine { id: number; symbol: string; qty: number }
function BuyPanel({ defaultSymbol, suggestions, available, casaAccount, casaBalance, onMoveFromCasa }: { defaultSymbol: string; suggestions: string[]; available: number; casaAccount: string; casaBalance: number; onMoveFromCasa: (amt: number) => void }) {
  let seq = 1
  const [lines, setLines] = useState<BuyLine[]>(() => [{ id: seq++, symbol: defaultSymbol, qty: 1000 }])
  const notify = useToast()
  const price = usePrices()
  const px = (sym: string) => price(sym)?.last ?? priceOf(sym)

  // Follow the Market Watch: when the filtered stock changes, prefill it into
  // the first Buy line (context-based prefill from the spec).
  useEffect(() => {
    setLines((p) => (p.length ? [{ ...p[0], symbol: defaultSymbol }, ...p.slice(1)] : p))
  }, [defaultSymbol])

  const add = () => {
    const next = suggestions.find((s) => !lines.some((l) => l.symbol === s)) ?? FULL_MARKET[0].symbolShortName
    setLines((p) => [...p, { id: seq++ + p.length, symbol: next, qty: 1000 }])
  }
  const update = (id: number, patch: Partial<BuyLine>) => setLines((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const remove = (id: number) => setLines((p) => (p.length > 1 ? p.filter((l) => l.id !== id) : p))
  const total = lines.reduce((s, l) => s + l.qty * px(l.symbol), 0)
  const short = Math.max(0, Math.round(total - available))

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-[#0062ff] bg-[rgba(0,98,255,0.05)] shadow-[0_0_0_1px_rgba(0,98,255,0.04),inset_0_1px_0_rgba(0,98,255,0.08)]">
      <div className="flex items-center justify-between px-3 py-3 text-white" style={{ background: 'linear-gradient(135deg, #0062ff 0%, #0040cc 100%)' }}>
        <div className="flex items-baseline gap-2">
          <span className="text-[17px] font-black uppercase tracking-widest">Buy</span>
          <span className="text-[10px] font-medium text-white/50">↑</span>
        </div>
        <button onClick={add} className="rounded-md bg-white/20 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-white/20 hover:bg-white/30">+ Add line</button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto p-2.5">
        {lines.map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-lg bg-[rgba(0,98,255,0.07)] p-2 ring-1 ring-[rgba(0,98,255,0.18)] transition-colors hover:bg-[rgba(0,98,255,0.11)]">
            <select
              value={l.symbol}
              onChange={(e) => update(l.id, { symbol: e.target.value })}
              className="h-8 min-w-0 flex-1 rounded border border-[rgba(0,98,255,0.22)] bg-[#0b0e15] px-2 text-[12px] text-content outline-none focus:border-[#5b9bff]"
            >
              {FULL_MARKET.map((s) => (
                <option key={s.symbolShortName} value={s.symbolShortName} className="bg-surface">{s.symbolShortName}</option>
              ))}
            </select>
            <input
              type="number"
              value={l.qty}
              onChange={(e) => update(l.id, { qty: Math.max(0, +e.target.value) })}
              className="h-8 w-24 rounded border border-[rgba(0,98,255,0.22)] bg-[#0b0e15] px-2 text-right text-[12px] text-content outline-none focus:border-[#5b9bff]"
            />
            <div className="flex w-24 shrink-0 flex-col items-end gap-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[11px] tabular-nums text-[#9cc0ff]">{fmtPrice(px(l.symbol))}</span>
                {(() => { const chg = price(l.symbol)?.changePct ?? 0; return <span className={`rounded px-1 py-px text-[9px] font-bold tabular-nums ring-1 ${chg >= 0 ? 'bg-[rgba(47,208,122,0.1)] text-up ring-[rgba(47,208,122,0.2)]' : 'bg-[rgba(255,107,114,0.1)] text-down ring-[rgba(255,107,114,0.2)]'}`}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</span> })()}
              </div>
              <span className="text-[9px] tabular-nums text-content-subtle">{fmtMoney(l.qty * px(l.symbol))}</span>
            </div>
            <button onClick={() => remove(l.id)} className="shrink-0 text-content-muted hover:text-down" title="Remove line" aria-label="Remove line">✕</button>
          </div>
        ))}
      </div>
      <div className="border-t border-[rgba(0,98,255,0.25)] px-3 py-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-content-subtle">Est. total</div>
            <div className="text-[15px] font-black tabular-nums text-content">{fmtMoney(total)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-widest text-content-subtle">Available</div>
            <div className="text-[13px] font-semibold tabular-nums text-content-muted">{fmtMoney(available)}</div>
          </div>
        </div>

        {/* Only when there isn't enough cash: warn, and reveal the CASA top-up. */}
        {short > 0 && (
          <div className="mt-2 rounded-md border px-2.5 py-2" style={{ borderColor: 'rgba(255,170,0,0.45)', background: 'rgba(255,170,0,0.1)' }}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-warning">
              <span>⚠</span> Not enough available cash — short {fmtMoney(short)}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] tabular-nums text-content-muted">CASA {casaAccount} · {fmtMoney(casaBalance)}</span>
              <button
                onClick={() => onMoveFromCasa(short)}
                disabled={casaBalance < short}
                title={casaBalance < short ? 'CASA balance too low to cover' : 'Move the shortfall from CASA into the investment account'}
                className="shrink-0 rounded px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                style={{ background: BLUE }}
              >
                Move {fmtMoney(short)} from CASA
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => notify(`Buy order placed — ${lines.length} instrument${lines.length === 1 ? '' : 's'}`, 'buy')}
          className="btn-glow-blue mt-2 w-full rounded-lg py-2.5 text-[13px] font-black uppercase tracking-widest text-white transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #0062ff 0%, #003dcc 100%)' }}
        >
          ↑ Place {lines.length} Buy{lines.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  )
}

// ─── Sell panel (RED) — from holdings, multiple line items ────────────────────
function SellPanel({ holdings }: { holdings: PortfolioPosition[] }) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const notify = useToast()
  const price = usePrices()
  const px = (h: PortfolioPosition) => price(h.symbol)?.last ?? h.evalPrice
  const set = (sym: string, n: number, max: number) => {
    setQty((p) => ({ ...p, [sym]: Math.max(0, Math.min(n, max)) }))
  }
  const selected = holdings.filter((h) => (qty[h.symbol] ?? 0) > 0)
  const total = selected.reduce((s, h) => s + (qty[h.symbol] ?? 0) * px(h), 0)

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border-2 border-[#e0383d] bg-[rgba(224,56,61,0.05)] shadow-[0_0_0_1px_rgba(224,56,61,0.04),inset_0_1px_0_rgba(224,56,61,0.08)]">
      <div className="flex items-center justify-between px-3 py-3 text-white" style={{ background: 'linear-gradient(135deg, #e0383d 0%, #b02428 100%)' }}>
        <div className="flex items-baseline gap-2">
          <span className="text-[17px] font-black uppercase tracking-widest">Sell</span>
          <span className="text-[10px] font-medium text-white/50">↓</span>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/60">holdings</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2.5">
        {holdings.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-content-muted">No holdings to sell.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {holdings.map((h) => (
              <div key={h.symbol} className="flex items-center gap-2.5 rounded-lg bg-[rgba(224,56,61,0.07)] p-2 ring-1 ring-[rgba(224,56,61,0.18)] transition-colors hover:bg-[rgba(224,56,61,0.11)]">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-content">{h.symbol}</div>
                  <div className="text-[9px] tabular-nums text-content-subtle">{fmtInt(h.available)} avail · {fmtPrice(px(h))}</div>
                </div>
                <input
                  type="number"
                  value={qty[h.symbol] ?? 0}
                  onChange={(e) => set(h.symbol, +e.target.value, h.available)}
                  className="h-7 w-20 rounded border border-[rgba(224,56,61,0.22)] bg-[#0b0e15] px-2 text-right text-[12px] text-content outline-none focus:border-down"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-[rgba(224,56,61,0.25)] px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-content-subtle">Est. total</div>
            <div className="text-[15px] font-black tabular-nums text-content">{fmtMoney(total)}</div>
          </div>
        </div>
        <button
          disabled={selected.length === 0}
          onClick={() => notify(`Sell order placed — ${selected.length} instrument${selected.length === 1 ? '' : 's'}`, 'sell')}
          className={`w-full rounded-lg py-2.5 text-[13px] font-black uppercase tracking-widest text-white transition-all hover:brightness-110 disabled:opacity-40 ${selected.length > 0 ? 'btn-glow-red' : ''}`}
          style={{ background: 'linear-gradient(135deg, #e0383d 0%, #b02428 100%)' }}
        >
          ↓ Place {selected.length} Sell{selected.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  )
}

// ─── One customer widget (portfolio + contact + buy/sell) ────────────────────
function CustomerPanel({ customer, watchSymbol, onClose, vip, onToggleVip }: { customer: DeskCustomer; watchSymbol: string; onClose: () => void; vip: boolean; onToggleVip: () => void }) {
  // Prefill Buy with the stock the customer trades most — approximated by their
  // Prefer the highest-priority blue-chip the customer is associated with.
  // Market Watch selection overrides this entirely.
  const suggestions = bluechipFirst(customer.usualStocks)
  const buyDefault = watchSymbol || suggestions[0] || FULL_MARKET[0].symbolShortName

  // Re-value holdings from live/sim prices so the portfolio stays consistent
  // with Market Watch (and moves).
  const price = usePrices()
  const liveHoldings = customer.holdings.map((h) => {
    const last = price(h.symbol)?.last ?? h.evalPrice
    const marketValue = Math.round(last * h.quantity)
    return { ...h, evalPrice: last, marketValue, gainLoss: marketValue - h.cost }
  })
  const totalMV = liveHoldings.reduce((s, h) => s + h.marketValue, 0)
  const totalGL = liveHoldings.reduce((s, h) => s + h.gainLoss, 0)

  // Funds: available investment cash + the linked CASA account it can pull from.
  const [cash, setCash] = useState(customer.cash)
  const [casaBal, setCasaBal] = useState(customer.casaBalance)
  const moveFromCasa = (amt: number) => {
    const m = Math.max(0, Math.min(Math.round(amt), casaBal))
    if (!m) return
    setCash((c) => c + m)
    setCasaBal((b) => b - m)
  }

  return (
    <section className="shrink-0 overflow-hidden rounded-xl border border-[rgba(0,98,255,0.22)] bg-[#07090e] shadow-[0_0_0_1px_rgba(0,98,255,0.04),0_8px_40px_rgba(0,0,0,0.5)]">
      {/* Contact / identity header */}
      <header className="border-b border-[rgba(0,98,255,0.15)] bg-gradient-to-r from-[#090f1e] via-[#0b0e18] to-[#0a0d15]">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[rgba(0,98,255,0.3)] to-[rgba(0,98,255,0.1)] text-[16px] font-black text-[#7ab0ff] ring-1 ring-[rgba(0,98,255,0.4)] shadow-[0_0_12px_rgba(0,98,255,0.2)]">
            {customer.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[16px] font-bold text-content">{customer.name}</span>
              <span className="rounded-md bg-[rgba(0,98,255,0.2)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#7ab0ff] ring-1 ring-[rgba(0,98,255,0.35)]">{customer.sif}</span>
              <button
                onClick={onToggleVip}
                title={vip ? 'VIP client — click to remove VIP status' : 'Mark this client as VIP'}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                  vip
                    ? 'bg-[rgba(240,185,11,0.18)] text-[#f0c33b] ring-1 ring-[rgba(240,185,11,0.3)]'
                    : 'border border-border-dark text-content-subtle hover:bg-[rgba(255,255,255,0.06)] hover:text-content'
                }`}
              >
                {vip ? '★ VIP' : '☆ VIP'}
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-content-muted">
              <span>📞 {customer.phone}</span>
              <span className="flex items-center gap-1">
                ✉ {customer.email}
                {customer.emailVerified
                  ? <span className="rounded bg-[rgba(47,208,122,0.16)] px-1 py-px text-[9px] font-bold text-up">✓ verified</span>
                  : <span className="rounded bg-[rgba(255,107,114,0.16)] px-1 py-px text-[9px] font-bold text-down">✗</span>}
              </span>
            </div>
          </div>
          <button onClick={onClose} title="Close this customer" aria-label="Close this customer" className="shrink-0 rounded-md p-1.5 text-content-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-content">✕</button>
        </div>
      </header>

      {/* Available balance — two-stat bar */}
      <div className="flex items-center justify-between border-b border-[rgba(0,98,255,0.12)] bg-gradient-to-r from-[rgba(0,40,120,0.3)] via-[rgba(0,20,80,0.2)] to-transparent px-4 py-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#5b9bff] opacity-80">Available balance</div>
          <div className="mt-0.5 text-[28px] font-black leading-none tabular-nums text-white" style={{ textShadow: '0 0 24px rgba(0,98,255,0.35)' }}>{fmtMoney(cash)}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-content-subtle">CASA reserve</div>
          <div className="mt-0.5 text-[16px] font-semibold tabular-nums text-content-muted">{fmtMoney(casaBal)}</div>
        </div>
      </div>

      {/* Step-2 briefing merged in: risk / KYC / day P&L / positions / tenure */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(0,98,255,0.1)] bg-[rgba(0,0,0,0.2)] px-4 py-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(0,98,255,0.12)] px-2 py-0.5 text-[10px] font-bold text-[#7ab0ff] ring-1 ring-[rgba(0,98,255,0.2)]">
          <span className="font-normal opacity-70">Risk</span> {customer.risk}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${customer.kyc === 'Valid' ? 'bg-[rgba(47,208,122,0.1)] text-up ring-[rgba(47,208,122,0.22)]' : 'bg-[rgba(255,170,0,0.1)] text-warning ring-[rgba(255,170,0,0.22)]'}`}>
          {customer.kyc === 'Valid' ? '✓' : '!'} KYC {customer.kyc}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1 ${customer.dayPnlPct >= 0 ? 'bg-[rgba(47,208,122,0.1)] text-up ring-[rgba(47,208,122,0.22)]' : 'bg-[rgba(255,107,114,0.1)] text-down ring-[rgba(255,107,114,0.22)]'}`}>
          Day P/L {customer.dayPnlPct >= 0 ? '+' : ''}{customer.dayPnlPct.toFixed(1)}%
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-[10px] text-content-muted ring-1 ring-[rgba(255,255,255,0.07)]">
          {customer.positions} positions
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] text-content-subtle ring-1 ring-[rgba(255,255,255,0.06)]">
          Since {customer.since}
        </span>
      </div>
      {customer.flag && (
        <div className="flex items-start gap-2 border-b border-[rgba(255,170,0,0.3)] bg-[rgba(255,170,0,0.1)] px-3 py-1.5 text-[11px] text-warning">
          <span>⚠</span><span>{customer.flag}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 p-3">
        {/* Portfolio / positions (full width, on top) */}
        <div className="overflow-hidden rounded-xl border border-[rgba(0,98,255,0.15)] bg-[#0a0c12] shadow-[0_2px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between border-b border-[rgba(0,98,255,0.12)] bg-gradient-to-r from-[#0d1220] to-[#0c0f18] px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#5b9bff]">Portfolio</span>
            <span className="text-[11px] tabular-nums">
              <span className="text-content-muted">MV </span>
              <span className="font-semibold text-content">{fmtMoney(totalMV)}</span>
              <span className={totalGL >= 0 ? 'text-up' : 'text-down'}> ({totalGL >= 0 ? '+' : ''}{fmtMoney(totalGL)})</span>
            </span>
          </div>
          <table className="w-full text-[12px] tabular-nums">
            <thead className="text-[10px] uppercase tracking-wide text-content-muted">
              <tr>
                <th className="px-3 py-1 text-left font-medium">Symbol</th>
                <th className="px-3 py-1 text-right font-medium">Qty</th>
                <th className="px-3 py-1 text-right font-medium">Avg</th>
                <th className="px-3 py-1 text-right font-medium">P/L</th>
              </tr>
            </thead>
            <tbody>
              {liveHoldings.map((h, idx) => {
                const barW = Math.min(Math.abs(h.gainLoss / (h.cost || 1)) * 300, 100)
                return (
                  <tr key={h.symbol} className={`border-t border-[rgba(255,255,255,0.04)] ${idx % 2 === 0 ? '' : 'bg-[rgba(255,255,255,0.018)]'}`}>
                    <td className="px-3 py-1.5 text-left">
                      <div className="font-medium text-content">{h.symbol}</div>
                      <div className="mt-0.5 h-0.5 w-full max-w-[36px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.07)]">
                        <div className={`h-full ${h.gainLoss >= 0 ? 'bg-up' : 'bg-down'}`} style={{ width: `${barW}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right text-content-muted">{fmtInt(h.quantity)}</td>
                    <td className="px-3 py-1.5 text-right text-content-muted">{fmtPrice(h.avgCost)}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${h.gainLoss >= 0 ? 'text-up' : 'text-down'}`}>{h.gainLoss >= 0 ? '+' : ''}{fmtInt(h.gainLoss)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* Recent activity (from step 2) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[rgba(0,98,255,0.1)] bg-[#080a0e] px-3 py-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-content-subtle">Last trades</span>
            <span className="flex items-center gap-1 rounded-md bg-[rgba(47,208,122,0.09)] px-2 py-0.5 text-[10px] font-medium text-up ring-1 ring-[rgba(47,208,122,0.18)]">
              ↑ {customer.lastBuy.symbol} <span className="tabular-nums">{fmtInt(customer.lastBuy.qty)} @ {fmtPrice(customer.lastBuy.price)}</span>
            </span>
            <span className="flex items-center gap-1 rounded-md bg-[rgba(255,107,114,0.09)] px-2 py-0.5 text-[10px] font-medium text-down ring-1 ring-[rgba(255,107,114,0.18)]">
              ↓ {customer.lastSell.symbol} <span className="tabular-nums">{fmtInt(customer.lastSell.qty)} @ {fmtPrice(customer.lastSell.price)}</span>
            </span>
          </div>
        </div>

        {/* Buy + Sell — below the portfolio, side by side, always open */}
        <div className="flex min-h-[260px] gap-3">
          <BuyPanel defaultSymbol={buyDefault} suggestions={suggestions} available={cash} casaAccount={customer.casa} casaBalance={casaBal} onMoveFromCasa={moveFromCasa} />
          <SellPanel holdings={liveHoldings} />
        </div>
      </div>
    </section>
  )
}

// ─── Right: stacked customers + SIF entry ────────────────────────────────────
// Session snapshot (shared across the app's windows) so "Dock to main" and
// reopening restore the open client tabs instead of refreshing to empty.
const DESK_SESSION_KEY = 'order-placement-session-v1'
interface DeskSnapshot { openSifs: string[]; activeSif: string; pinned: string[]; vipMap: Record<string, boolean> }
function loadDeskSnapshot(): DeskSnapshot | null {
  try { const raw = localStorage.getItem(DESK_SESSION_KEY); return raw ? (JSON.parse(raw) as DeskSnapshot) : null } catch { return null }
}

function CustomerArea({ watchSymbol, compact, snapshotRef }: { watchSymbol: string; compact?: boolean; snapshotRef?: { current: DeskSnapshot | null } }) {
  // Only the docked (compact) instance restores a session; fresh opens start empty.
  const snap = useMemo(() => (compact ? loadDeskSnapshot() : null), [compact])
  const [open, setOpen] = useState<DeskCustomer[]>(() => (snap?.openSifs ?? []).map((sif) => DESK_CUSTOMERS.find((c) => c.sif === sif)).filter((c): c is DeskCustomer => Boolean(c)))
  const [activeSif, setActiveSif] = useState(() => snap?.activeSif ?? '') // which open client's tab is shown
  const [vipMap, setVipMap] = useState<Record<string, boolean>>(() => snap?.vipMap ?? {}) // manual VIP overrides, survive tab switches
  const [dragSif, setDragSif] = useState<string | null>(null) // tab being dragged to reorder
  const dragSifRef = useRef<string | null>(null) // synchronous mirror of dragSif for the pointer handlers
  const tabDownRef = useRef<{ sif: string; x: number } | null>(null) // pointer-down bookkeeping
  const justDraggedRef = useRef(false) // suppress the click that follows a drag
  const [pinned, setPinned] = useState<Set<string>>(() => new Set(snap?.pinned ?? [])) // pinned tabs — kept, close-protected
  const [cif, setCif] = useState('')
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  // Keep the parent's snapshot ref current so "Dock to main" can hand it over.
  if (snapshotRef) snapshotRef.current = { openSifs: open.map((c) => c.sif), activeSif, pinned: [...pinned], vipMap }
  const isVip = (c: DeskCustomer) => vipMap[c.sif] ?? c.vip
  const toggleVip = (c: DeskCustomer) => setVipMap((m) => ({ ...m, [c.sif]: !(m[c.sif] ?? c.vip) }))

  // Browser-tab drag-to-reorder: live-swap the dragged tab over the hovered one.
  const reorder = (targetSif: string) => {
    const dragging = dragSifRef.current
    if (dragging === null || dragging === targetSif) return
    setOpen((prev) => {
      const from = prev.findIndex((c) => c.sif === dragging)
      const to = prev.findIndex((c) => c.sif === targetSif)
      if (from < 0 || to < 0) return prev
      const next = prev.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  // Autocomplete: match the typed text against CIF number, name or SIF.
  const matches = useMemo(() => {
    const q = cif.trim().toLowerCase()
    const d = cif.replace(/\D/g, '')
    if (!q) return DESK_CUSTOMERS
    return DESK_CUSTOMERS.filter(
      (c) => (d !== '' && c.cif.includes(d)) || c.name.toLowerCase().includes(q) || c.sif.toLowerCase().includes(q),
    )
  }, [cif])

  const openCustomer = (c: DeskCustomer, replace: boolean) => {
    setError('')
    setCif('')
    setPickerOpen(false)
    setOpen((prev) => (replace ? [c] : prev.some((p) => p.sif === c.sif) ? prev : [c, ...prev]))
    setActiveSif(c.sif) // focus the newly opened client's tab
  }
  const openByInput = (replace: boolean) => {
    const c = findCustomer(cif)
    if (!c) { setError(`No customer found for “${cif.trim()}”`); return }
    openCustomer(c, replace)
  }
  // When the search matches several clients, open them all (stacked).
  const addAllMatches = () => {
    setError('')
    setCif('')
    setPickerOpen(false)
    setOpen((prev) => {
      const seen = new Set(prev.map((p) => p.sif))
      return [...matches.filter((c) => !seen.has(c.sif)), ...prev]
    })
    if (matches[0]) setActiveSif(matches[0].sif)
  }
  // Close a tab; if it was the active one, activate the neighbour to its right
  // (or left if it was last) — same as a browser closing a tab.
  const close = (s: string) => {
    const idx = open.findIndex((c) => c.sif === s)
    const next = open.filter((c) => c.sif !== s)
    setOpen(next)
    if (s === activeSif) setActiveSif((next[idx] ?? next[idx - 1])?.sif ?? '')
  }

  const isPinned = (s: string) => pinned.has(s)
  const togglePin = (s: string) => setPinned((prev) => {
    const n = new Set(prev)
    n.has(s) ? n.delete(s) : n.add(s)
    return n
  })
  // Pinned tabs cluster at the front (like a browser), preserving relative order.
  const orderedTabs = useMemo(() => {
    const pin = open.filter((c) => pinned.has(c.sif))
    const rest = open.filter((c) => !pinned.has(c.sif))
    return [...pin, ...rest]
  }, [open, pinned])

  // The client whose tab is shown (falls back to the first open one).
  const activeCustomer = open.find((c) => c.sif === activeSif) ?? orderedTabs[0]

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* CIF entry — type or pick a client; add several to stack their desks. */}
      <div className="shrink-0 rounded-xl border border-[rgba(0,98,255,0.18)] bg-[#07090e] p-3 shadow-[0_0_0_1px_rgba(0,98,255,0.04)]">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-[#5b9bff]">CIF</span>
          <div className="relative min-w-0 flex-1">
            <input
              value={cif}
              onChange={(e) => { setCif(e.target.value); setPickerOpen(true) }}
              onFocus={() => setPickerOpen(true)}
              onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openByInput(false)
                else if (e.key === 'Escape') setPickerOpen(false)
              }}
              placeholder="Type or select a CIF / client…"
              className="h-9 w-full rounded-md border border-[rgba(0,98,255,0.2)] bg-[#0b0e15] px-3 text-[13px] text-content outline-none focus:border-[#5b9bff]"
            />
            {pickerOpen && matches.length > 0 && (
              <ul className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full min-w-[300px] overflow-auto rounded-lg border border-border-dark bg-surface shadow-xl">
                {matches.map((c) => (
                  <li key={c.sif}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); openCustomer(c, false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[rgba(0,98,255,0.12)]"
                    >
                      <span className="rounded bg-[rgba(0,98,255,0.2)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#9cc0ff]">{c.cif}</span>
                      <span className="flex-1 truncate font-medium text-content">{c.name}</span>
                      {c.vip && <span className="text-[10px] font-bold text-[#f0c33b]">★ VIP</span>}
                      <span className="text-[11px] text-content-muted">{c.sif}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {cif.trim() !== '' && matches.length > 1 && (
            <button onClick={addAllMatches} className="h-9 shrink-0 rounded-md px-3 text-[12px] font-semibold text-white" style={{ background: BLUE }} title={`Open all ${matches.length} matching clients`}>Add all ({matches.length})</button>
          )}
        </div>
        {/* Quick-open is limited to VIP clients to keep it short; everyone else
            is reachable via the search box above. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-[#f0c33b]">★ VIP:</span>
          {DESK_CUSTOMERS.filter((c) => isVip(c)).map((c) => (
            <button
              key={c.sif}
              onClick={() => openCustomer(c, false)}
              className="rounded border border-[rgba(240,185,11,0.35)] bg-[rgba(240,185,11,0.08)] px-2 py-0.5 text-[11px] text-content-muted hover:bg-[rgba(240,185,11,0.16)] hover:text-content"
              title={`Open ${c.name}`}
            >
              {c.name} · CIF {c.cif}
            </button>
          ))}
          {!DESK_CUSTOMERS.some((c) => isVip(c)) && <span className="text-[11px] text-content-subtle">none — search above to open a client</span>}
          <span className="ml-auto text-[10px] text-content-subtle">Add multiple to stack their desks</span>
        </div>
        {error && <div className="mt-2 text-[11px] text-down">{error}</div>}
      </div>

      {/* Open clients as tabs — switch between them instead of a tall stack. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {open.length === 0 || !activeCustomer ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[rgba(0,98,255,0.15)] bg-[rgba(0,98,255,0.02)] text-[13px] text-[#5b9bff] opacity-50">
            Enter a CIF to open a customer.
          </div>
        ) : (
          <>
            {/* Tab strip */}
            <div className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-border-dark">
              {orderedTabs.map((c) => {
                const active = c.sif === activeCustomer.sif
                return (
                  <div
                    key={c.sif}
                    role="tab"
                    aria-selected={active}
                    data-sif={c.sif}
                    onClick={() => { if (justDraggedRef.current) { justDraggedRef.current = false; return } setActiveSif(c.sif) }}
                    onAuxClick={(e) => { if (e.button === 1 && !isPinned(c.sif)) { e.preventDefault(); close(c.sif) } }}
                    // Pointer-based reorder (reliable in macOS WebView, unlike HTML5 drag).
                    onPointerDown={(e) => { if (e.button === 0) tabDownRef.current = { sif: c.sif, x: e.clientX } }}
                    onPointerMove={(e) => {
                      const d = tabDownRef.current
                      if (!d) return
                      if (dragSifRef.current === null) {
                        if (Math.abs(e.clientX - d.x) < 5) return // small threshold so a click doesn't start a drag
                        dragSifRef.current = d.sif
                        setDragSif(d.sif)
                        e.currentTarget.setPointerCapture(e.pointerId)
                      }
                      const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-sif]')?.getAttribute('data-sif')
                      if (over) reorder(over)
                    }}
                    onPointerUp={(e) => {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
                      if (dragSifRef.current !== null) justDraggedRef.current = true
                      dragSifRef.current = null
                      setDragSif(null)
                      tabDownRef.current = null
                    }}
                    onPointerCancel={() => { dragSifRef.current = null; setDragSif(null); tabDownRef.current = null }}
                    title={`${c.name} · CIF ${c.cif}`}
                    className={`group flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 py-1.5 text-[12px] transition-opacity ${
                      dragSif === c.sif ? 'opacity-50' : ''
                    } ${
                      active
                        ? 'border-[rgba(0,98,255,0.3)] bg-[rgba(0,98,255,0.14)] text-content shadow-[inset_0_2px_0_rgba(0,98,255,0.5)]'
                        : 'border-transparent text-content-muted hover:bg-[rgba(255,255,255,0.05)]'
                    }`}
                  >
                    {isPinned(c.sif) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-action" aria-hidden><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" /></svg>
                    )}
                    <span className="rounded bg-[rgba(0,98,255,0.18)] px-1 py-0.5 text-[10px] font-bold tabular-nums text-[#9cc0ff]">{c.cif}</span>
                    <span className="max-w-[140px] truncate font-medium">{c.name}</span>
                    {isVip(c) && <span className="text-[10px] text-[#f0c33b]">★</span>}
                    {isPinned(c.sif) ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePin(c.sif) }}
                        className="rounded p-0.5 text-action hover:bg-[rgba(255,255,255,0.1)]"
                        aria-label={`Unpin ${c.name}`}
                        title="Pinned — click to unpin"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6l-1 6 3 3v2h-4v6l-1 2-1-2v-6H7v-2l3-3-1-6z" /></svg>
                      </button>
                    ) : (
                      <span className="flex items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePin(c.sif) }}
                          className="rounded p-0.5 text-content-muted opacity-0 transition-opacity hover:bg-[rgba(255,255,255,0.1)] hover:text-content group-hover:opacity-100"
                          aria-label={`Pin ${c.name}`}
                          title="Pin tab"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" /><path d="M12 16v5" /></svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); close(c.sif) }}
                          className="rounded p-0.5 text-content-muted hover:bg-[rgba(255,255,255,0.1)] hover:text-content"
                          aria-label={`Close ${c.name}`}
                          title="Close"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Active client */}
            <div className="min-h-0 flex-1 overflow-y-auto pt-3">
              <CustomerPanel
                key={activeCustomer.sif}
                customer={activeCustomer}
                watchSymbol={watchSymbol}
                onClose={() => close(activeCustomer.sif)}
                vip={isVip(activeCustomer)}
                onToggleVip={() => toggleVip(activeCustomer)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Order Placement desk (split screen) ─────────────────────────────────────
export default function BrokerDesk({ compact = false, onDock }: { compact?: boolean; onDock?: () => void }) {
  // Empty by default so each customer's Buy prefills THEIR most-traded stock
  // (usualStocks[0]); picking a symbol in Market Watch overrides it.
  const [watchSymbol, setWatchSymbol] = useState<string>('')
  // Market Watch can be hidden (e.g. when docked into a narrow area).
  const [showWatch, setShowWatch] = useState(!compact)
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)
  const notify = useCallback((msg: string, tone: ToastTone) => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])
  // Save the open-tabs snapshot only when docking, so the docked copy restores it.
  const snapshotRef = useRef<DeskSnapshot | null>(null)
  const handleDock = () => {
    try { if (snapshotRef.current) localStorage.setItem(DESK_SESSION_KEY, JSON.stringify(snapshotRef.current)) } catch { /* ignore */ }
    onDock?.()
  }

  return (
    <ToastCtx.Provider value={notify}>
      <div className="flex h-full min-h-0 flex-col bg-[#07090e]">
        {/* Toolbar */}
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[rgba(0,98,255,0.2)] bg-gradient-to-r from-[#0b1220] via-[#0d1018] to-[#0f1018] px-3">
          <div className="flex shrink-0 items-center gap-2">
            <span className="h-4 w-[3px] rounded-full bg-[#0062ff] shadow-[0_0_6px_rgba(0,98,255,0.6)]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#5b9bff]">Order Placement</span>
          </div>
          <span className="h-4 w-px shrink-0 bg-[rgba(0,98,255,0.2)]" />
          <button
            onClick={() => setShowWatch((v) => !v)}
            title="Show or hide the Market Watch panel"
            className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(0,98,255,0.2)] bg-[rgba(0,98,255,0.06)] px-2.5 py-1 text-[11px] font-medium text-[#9cc0ff] hover:bg-[rgba(0,98,255,0.12)]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg>
            {showWatch ? 'Hide' : 'Show'} Market Watch
          </button>
          {onDock && (
            <button
              onClick={handleDock}
              title="Bring this into the main window"
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[rgba(0,98,255,0.2)] bg-[rgba(0,98,255,0.06)] px-2.5 py-1 text-[11px] font-medium text-[#9cc0ff] hover:bg-[rgba(0,98,255,0.12)]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 10l-5 5 5 5" /><path d="M4 15h11a5 5 0 0 0 5-5V4" /></svg>
              Dock to main
            </button>
          )}
        </div>
        {/* Wide: Market Watch on the left. Docked (compact): stacked — Market
            Watch on top, the CIF/client area below. Hidden → CIF takes it all. */}
        <div className={`flex min-h-0 flex-1 gap-3 p-3 ${compact ? 'flex-col' : ''}`}>
          {showWatch && (
            <div className={compact ? 'h-[260px] shrink-0' : 'hidden w-[34%] min-w-[340px] max-w-[460px] md:block'}>
              <MarketWatch symbol={watchSymbol} onPick={setWatchSymbol} />
            </div>
          )}
          <div className="min-h-0 min-w-0 flex-1">
            <CustomerArea watchSymbol={watchSymbol} compact={compact} snapshotRef={snapshotRef} />
          </div>
        </div>
      </div>
      <ToastHost toasts={toasts} />
    </ToastCtx.Provider>
  )
}
