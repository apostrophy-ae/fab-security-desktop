import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { FULL_MARKET, fmtPrice, fmtInt, fmtPct, bluechipFirst, BLUE_CHIPS } from '../data'
import { DESK_CUSTOMERS, findCustomer } from '../deskData'
import type { DeskCustomer } from '../deskData'
import { usePrices } from '../simData'

/**
 * Order Placement · AI — a sibling of the Order Placement desk where AI removes
 * operational work while the broker stays the decision maker. It implements the
 * AI-assisted broker journey: verify → profile → capture request → market
 * context → recommendation → risk → compliance → buying power → broker confirms
 * → summary → CRM → next best actions.
 *
 * The "AI" here is simulated but data-driven (it reads the real client + market
 * data). No trade is ever auto-executed — the broker presses Place.
 */

const BLUE = '#0062ff'
const fmtMoney = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-US')

type Side = 'buy' | 'sell'
interface OrderLine { id: number; side: Side; symbol: string; qty: number }
interface WishlistItem { id: number; symbol: string; qty: number; targetPrice: number }
type CheckTone = 'pass' | 'warn' | 'block' | 'info'

// ── Little AI mark ───────────────────────────────────────────────────────────
function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l1.6 4.8L18.4 8.4 13.6 10 12 14.8 10.4 10 5.6 8.4l4.8-1.6L12 2z" />
      <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" opacity=".7" />
    </svg>
  )
}

// Streams text character by character when animate=true, like a live transcript.
// Replays at ~120 chars/sec — fast enough to feel real, slow enough to read.
function TypedText({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : text.length)
  useEffect(() => {
    if (!animate || shown >= text.length) return
    const id = setInterval(() => setShown((n) => Math.min(n + 4, text.length)), 33)
    return () => clearInterval(id)
  }, [animate, text]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {text.slice(0, shown)}
      {shown < text.length && <span className="ml-px inline-block h-[0.85em] w-[1.5px] translate-y-[0.05em] animate-pulse bg-current opacity-60" />}
    </>
  )
}

/**
 * Parse a free-text / dictated instruction that may contain SEVERAL orders,
 * e.g. "buy 100k Emaar, 50k DIB and sell 30k SALIK". Splits into segments and
 * carries the running side across them, returning one entry per complete order.
 */
function parseRequestMulti(text: string): { side: Side; symbol: string; qty: number }[] {
  const segments = text.toLowerCase().split(/,|;|\/|\band\b|\bthen\b|\bplus\b|\balso\b|\n/).map((s) => s.trim()).filter(Boolean)
  const out: { side: Side; symbol: string; qty: number }[] = []
  let side: Side = 'buy'
  for (const seg of segments) {
    const t = ` ${seg} `
    if (/\b(buy|add|acquire|accumulate|long|increase)\b/.test(t)) side = 'buy'
    else if (/\b(sell|trim|reduce|offload|exit|short|liquidate|dump)\b/.test(t)) side = 'sell'

    let qty = 0
    const m = t.match(/([\d][\d,.]*)\s*(k|m|thousand|million|mn)?/)
    if (m) {
      let n = parseFloat(m[1].replace(/,/g, ''))
      const suf = m[2]
      if (suf === 'k' || suf === 'thousand') n *= 1_000
      if (suf === 'm' || suf === 'mn' || suf === 'million') n *= 1_000_000
      if (Number.isFinite(n) && n > 0) qty = Math.round(n)
    }

    const s =
      FULL_MARKET.find((x) => t.includes(` ${x.symbolShortName.toLowerCase()} `)) ??
      FULL_MARKET.find((x) => t.includes(x.symbolName.toLowerCase()))
    if (s && qty > 0) out.push({ side, symbol: s.symbolShortName, qty })
  }
  return out
}

// ── Live advisory: "what to pitch, and why" ──────────────────────────────────
type PitchTone = 'sell' | 'buy' | 'switch'
interface PitchIdea { tone: PitchTone; tag: string; headline: string; why: string; prefill: string }

/** Data-driven pitch ideas from the client's holdings + market momentum. */
function pitchIdeas(client: DeskCustomer, price: (s: string) => { last: number; changePct: number } | null): PitchIdea[] {
  const ideas: PitchIdea[] = []
  const conservative = client.risk === 'Conservative'
  const aggressive = client.risk === 'Aggressive' || client.risk === 'Institutional'
  const usedSymbols = new Set<string>()

  // 1. Holdings: take profit (near 52-week high) or momentum (strong up day with room left)
  for (const h of client.holdings) {
    if (ideas.length >= 4) break
    const s = FULL_MARKET.find((x) => x.symbolShortName === h.symbol)
    if (!s) continue
    const q = price(h.symbol)
    const last = q?.last ?? s.lastPrice
    const chg = q?.changePct ?? s.changePct
    const toHigh = s.weekHigh52 > 0 ? (s.weekHigh52 - last) / s.weekHigh52 : 1
    if (toHigh < (conservative ? 0.08 : 0.05) && chg >= 0) {
      ideas.push({ tone: 'sell', tag: 'Take profit', headline: `${h.symbol} near its 52-week high`, why: `Only ${(toHigh * 100).toFixed(1)}% below the 52-week high (${fmtPrice(s.weekHigh52)}) and ${fmtPct(chg)} today — upside looks limited. Pitch trimming to lock in gains.`, prefill: `Sell ${h.symbol}` })
      usedSymbols.add(h.symbol)
    } else if (chg >= (conservative ? 1.5 : 2) && toHigh > 0.05 && (!conservative || Math.abs(chg) <= 3)) {
      ideas.push({ tone: 'buy', tag: 'Momentum', headline: `${h.symbol} has room to run`, why: `Up ${fmtPct(chg)} today with the 52-week high still ${(toHigh * 100).toFixed(0)}% away (${fmtPrice(s.weekHigh52)}). Pitch holding or adding while momentum lasts.`, prefill: `Buy ${h.symbol}` })
      usedSymbols.add(h.symbol)
    }
  }

  // 2. Buy the dip — usual stocks not currently held that are having a down day
  const holdingSet = new Set(client.holdings.map((h) => h.symbol))
  const dipThreshold = conservative ? -4 : aggressive ? -2 : -3
  for (const sym of client.usualStocks) {
    if (ideas.length >= 4) break
    if (holdingSet.has(sym) || usedSymbols.has(sym)) continue
    const s = FULL_MARKET.find((x) => x.symbolShortName === sym)
    if (!s) continue
    const chg = price(sym)?.changePct ?? s.changePct
    if (chg <= dipThreshold) {
      ideas.push({ tone: 'buy', tag: 'Buy the dip', headline: `${sym} pulling back — entry opportunity`, why: `${sym} is ${fmtPct(chg)} today — a name this client trades regularly. A pullback on a familiar stock can be a clean entry point${conservative ? ' within a conservative mandate' : ''}.`, prefill: `Buy ${sym}` })
      usedSymbols.add(sym)
    }
  }

  // 3. Stronger alternative — scan all usual stocks, find best same-sector peer outperforming by 0.5%+
  const seenAltTargets = new Set<string>()
  for (const sym of client.usualStocks) {
    if (ideas.length >= 4) break
    const base = FULL_MARKET.find((x) => x.symbolShortName === sym)
    if (!base) continue
    const baseChg = price(sym)?.changePct ?? base.changePct
    const peers = FULL_MARKET
      .filter((x) => x.sector === base.sector && x.symbolShortName !== sym && x.lastPrice > 0 && !seenAltTargets.has(x.symbolShortName))
      .map((x) => ({ x, c: price(x.symbolShortName)?.changePct ?? x.changePct }))
    const pool = conservative ? peers.filter((a) => Math.abs(a.c) <= 3) : peers
    const best = pool.sort((a, b) => b.c - a.c)[0]
    if (best && best.c > baseChg + 0.5) {
      seenAltTargets.add(best.x.symbolShortName)
      ideas.push({ tone: 'switch', tag: 'Stronger alternative', headline: `${best.x.symbolShortName} is outpacing ${sym}`, why: `Same sector (${base.sector}) — ${best.x.symbolShortName} is ${fmtPct(best.c)} vs ${sym} ${fmtPct(baseChg)} today. Pitch switching or diversifying into it.`, prefill: `Buy ${best.x.symbolShortName}` })
    }
  }

  return ideas.slice(0, 4)
}

// ── Small building blocks ────────────────────────────────────────────────────
function CheckRow({ tone, title, detail, action }: { tone: CheckTone; title: string; detail: ReactNode; action?: ReactNode }) {
  const dot = tone === 'pass' ? 'bg-up' : tone === 'warn' ? 'bg-warning' : tone === 'block' ? 'bg-down' : 'bg-[#5b9bff]'
  const ico = tone === 'pass' ? '✓' : tone === 'warn' ? '!' : tone === 'block' ? '✕' : 'i'
  return (
    <li className="flex items-start gap-2.5 px-3 py-2">
      <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-[#0b0c0d] ${dot}`}>{ico}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-content">{title}</div>
        <div className="text-[11px] leading-relaxed text-content-muted">{detail}</div>
      </div>
      {action}
    </li>
  )
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-[rgba(91,155,255,0.04)] p-2 ring-1 ring-[rgba(91,155,255,0.1)] transition-transform duration-150 hover:-translate-y-px hover:bg-[rgba(91,155,255,0.07)]">
      <span className="text-[9px] font-bold uppercase tracking-widest text-content-subtle">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${tone ?? 'text-content'}`}>{value}</span>
    </div>
  )
}

// Deterministic "voiceprint match" for the demo (95–99%).
const voiceMatchPct = (sif: string) => 95 + ([...sif].reduce((a, c) => a + c.charCodeAt(0), 0) % 5)

// Track an element's live width so the layout can switch between the wide
// (3-column, like the window) and narrow (stacked) designs.
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => { const x = entries[0]?.contentRect.width; if (x) setW(x) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

// "What to pitch" advisory — reused in the client column (wide) or after the
// request (narrow).
function AdvisoryCard({ ideas, onUse }: { ideas: PitchIdea[]; onUse: (t: string) => void }) {
  if (ideas.length === 0) return null
  return (
    <div className="rounded-xl border border-[rgba(91,155,255,0.22)] bg-[#0c0f1a] shadow-[0_0_0_1px_rgba(91,155,255,0.04),0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(91,155,255,0.07)]">
      <div className="flex items-center gap-1.5 border-b border-[rgba(91,155,255,0.15)] bg-[rgba(91,155,255,0.06)] px-3 py-2 text-[12px] font-semibold text-[#5b9bff]">
        <Sparkle /> What to pitch
        <span className="ml-auto text-[10px] font-normal text-content-subtle">live advisory</span>
      </div>
      <ul className="divide-y divide-[rgba(91,155,255,0.12)]">
        {ideas.map((idea, i) => {
          const chip = idea.tone === 'sell' ? 'bg-offer-surface text-down' : idea.tone === 'buy' ? 'bg-bid-surface text-up' : 'bg-[rgba(0,98,255,0.14)] text-[#5b9bff]'
          const accent = idea.tone === 'sell' ? 'border-l-down' : idea.tone === 'buy' ? 'border-l-up' : 'border-l-[#5b9bff]'
          return (
            <li key={i} className={`border-l-2 p-3 ${accent}`}>
              <div className="mb-1 text-[12px] font-semibold leading-snug text-content">
                <span className={`mr-2 inline-block align-middle rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${chip}`}>{idea.tag}</span>{idea.headline}
              </div>
              <p className="text-[11px] leading-relaxed text-content-muted">{idea.why}</p>
              <button onClick={() => onUse(idea.prefill)} className="mt-2 flex items-center gap-1.5 rounded-md border border-[rgba(91,155,255,0.3)] bg-[rgba(91,155,255,0.08)] px-2.5 py-1 text-[10px] font-semibold text-[#7ab0ff] hover:bg-[rgba(91,155,255,0.14)]"><Sparkle className="size-3" /> Use this pitch</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Caller-ID + voiceprint verification animation ────────────────────────────
const VOICE_BARS = [
  { dur: '0.55s', delay: '0.00s' },
  { dur: '0.38s', delay: '0.07s' },
  { dur: '0.48s', delay: '0.13s' },
  { dur: '0.62s', delay: '0.04s' },
  { dur: '0.42s', delay: '0.18s' },
  { dur: '0.52s', delay: '0.09s' },
  { dur: '0.45s', delay: '0.15s' },
  { dur: '0.58s', delay: '0.02s' },
  { dur: '0.40s', delay: '0.11s' },
]

function VerifyAnimation({ customer }: { customer: DeskCustomer }) {
  const [phase, setPhase] = useState<'caller' | 'voice' | 'matched'>('caller')
  const matchPct = voiceMatchPct(customer.sif)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('voice'), 700)
    const t2 = setTimeout(() => setPhase('matched'), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(91,155,255,0.22)] bg-[#0c0f1a] shadow-[0_0_0_1px_rgba(91,155,255,0.04),0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(91,155,255,0.07)]">
      <div className="flex items-center gap-2 border-b border-[rgba(91,155,255,0.2)] bg-[rgba(91,155,255,0.08)] px-3 py-2">
        <Sparkle className="animate-pulse text-[#5b9bff]" />
        <span className="text-[12px] font-semibold text-[#5b9bff]">AI verifying caller</span>
        <span className="ml-auto truncate text-[11px] text-content-muted">{customer.name}</span>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {/* Step 1: Caller-ID sweep */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span>📞</span>
            <span className="tabular-nums text-content">{customer.phone}</span>
            {phase === 'caller'
              ? <span className="text-content-muted"> · matching…</span>
              : <span className="font-medium text-up"> · matched ✓</span>}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#1e2125]">
            <div
              className="h-full rounded-full bg-action"
              style={{ animation: 'callerSweep 0.6s cubic-bezier(0.4,0,0.2,1) forwards' }}
            />
          </div>
        </div>

        {/* Step 2 / 3: Voice waveform */}
        {phase !== 'caller' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span>🎙️</span>
              {phase === 'voice'
                ? <span className="text-content-muted">Analysing voiceprint…</span>
                : <span className="font-semibold text-up">Voice matched · {matchPct}% ✓</span>}
            </div>

            {/* Animated bars — scaleY from centre */}
            <div className="flex h-14 items-center justify-center gap-[3px] rounded-lg bg-[rgba(91,155,255,0.05)] px-2">
              {VOICE_BARS.map((bar, i) => (
                <div key={i} className="h-full flex-1" style={{ maxWidth: '10px' }}>
                  <div
                    className="h-full w-full rounded-full"
                    style={{
                      backgroundColor: phase === 'matched' ? '#2fd07a' : '#5b9bff',
                      transformOrigin: 'center',
                      transform: phase === 'matched' ? 'scaleY(0.18)' : 'scaleY(0.1)',
                      transition: phase === 'matched' ? 'transform 0.4s ease, background-color 0.4s ease' : undefined,
                      boxShadow: phase === 'voice' ? '0 0 8px rgba(91,155,255,0.6)' : undefined,
                      animation: phase === 'voice'
                        ? `voiceBarAnim ${bar.dur} ease-in-out ${bar.delay} infinite alternate`
                        : undefined,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: match confirmed + loading */}
        {phase === 'matched' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-lg bg-[rgba(47,208,122,0.08)] px-3 py-2 ring-1 ring-[rgba(47,208,122,0.2)]">
              <span className="text-[11px] font-bold text-up">Identity confirmed</span>
              <span className="text-[22px] font-black tabular-nums text-up">{matchPct}<span className="text-[12px] font-medium opacity-70">%</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-content-muted">
              <Sparkle className="text-[#5b9bff]" />
              <span>Loading profile &amp; portfolio…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Client column: CIF search + verify + snapshot ────────────────────────────
function ClientColumn({ client, onOpen, verifying, onUseIdea, narrow, showAdvisory, ideas = [], isVip, onToggleVip, wishlist = [], onAddToWishlist, onRemoveFromWishlist, onConfirmWishlist }: { client: DeskCustomer | null; onOpen: (c: DeskCustomer) => void; verifying: DeskCustomer | null; onUseIdea?: (text: string) => void; narrow?: boolean; showAdvisory?: boolean; ideas?: PitchIdea[]; isVip: (c: DeskCustomer) => boolean; onToggleVip: (c: DeskCustomer) => void; wishlist?: WishlistItem[]; onAddToWishlist?: (symbol: string, targetPrice: number, qty: number) => void; onRemoveFromWishlist?: (id: number) => void; onConfirmWishlist?: (item: WishlistItem) => void }) {
  const [cif, setCif] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [wlOpen, setWlOpen] = useState(false)
  const [wlSym, setWlSym] = useState(BLUE_CHIPS[0])
  const [wlTarget, setWlTarget] = useState('')
  const [wlQty, setWlQty] = useState('10000')
  const price = usePrices()
  const matches = useMemo(() => {
    const q = cif.trim().toLowerCase()
    const d = cif.replace(/\D/g, '')
    if (!q) return DESK_CUSTOMERS
    return DESK_CUSTOMERS.filter((c) => (d !== '' && c.cif.includes(d)) || c.name.toLowerCase().includes(q) || c.sif.toLowerCase().includes(q))
  }, [cif])
  const open = (c: DeskCustomer) => { setCif(''); setPickerOpen(false); onOpen(c) }

  const holdings = client?.holdings ?? []
  const totalMV = holdings.reduce((s, h) => s + (price(h.symbol)?.last ?? h.evalPrice) * h.quantity, 0)

  return (
    <div className={`flex min-h-0 shrink-0 flex-col gap-3 overflow-y-auto ${narrow ? 'order-1 w-full' : 'w-[320px]'}`}>
      {/* Verify + open */}
      <div className="rounded-xl border border-[rgba(91,155,255,0.22)] bg-[#0c0f1a] shadow-[0_0_0_1px_rgba(91,155,255,0.04),0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(91,155,255,0.07)] p-3">
        <div className="mb-1.5 flex items-center gap-1.5 border-l-2 border-[#5b9bff] pl-2 text-[11px] font-semibold uppercase tracking-wide text-[#5b9bff]">
          <Sparkle /> Verify &amp; open client
        </div>
        <div className="relative">
          <input
            value={cif}
            onChange={(e) => { setCif(e.target.value); setPickerOpen(true) }}
            onFocus={() => setPickerOpen(true)}
            onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter') { const c = findCustomer(cif); if (c) open(c) } }}
            placeholder="Caller CIF / name…"
            className="h-9 w-full rounded-md border border-border-dark bg-[#15171a] px-3 text-[13px] text-content outline-none focus:border-action"
          />
          {pickerOpen && matches.length > 0 && (
            <ul className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border-dark bg-surface shadow-xl">
              {matches.map((c) => (
                <li key={c.sif}>
                  <button onMouseDown={(e) => { e.preventDefault(); open(c) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[rgba(0,98,255,0.12)]">
                    <span className="rounded bg-[rgba(0,98,255,0.2)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#9cc0ff]">{c.cif}</span>
                    <span className="flex-1 truncate font-medium text-content">{c.name}</span>
                    {isVip(c) && <span className="text-[10px] font-bold text-[#f0c33b]">★</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {DESK_CUSTOMERS.filter((c) => isVip(c)).map((c) => (
            <button key={c.sif} onClick={() => open(c)} className="rounded border border-[rgba(240,185,11,0.35)] bg-[rgba(240,185,11,0.08)] px-2 py-0.5 text-[10px] text-content-muted hover:text-content" title={`Open ${c.name}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {verifying ? (
        <VerifyAnimation customer={verifying} />
      ) : client ? (
        <>
          <div className="rounded-xl border border-[rgba(91,155,255,0.22)] bg-[#0c0f1a] shadow-[0_0_0_1px_rgba(91,155,255,0.04),0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(91,155,255,0.07)]">
            <div className="flex items-center gap-2 border-b border-[rgba(91,155,255,0.15)] bg-gradient-to-r from-[rgba(47,208,122,0.06)] to-transparent px-3 py-2.5">
              <span className="rounded-md bg-[rgba(47,208,122,0.18)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-up ring-1 ring-[rgba(47,208,122,0.3)]">✓ Verified</span>
              <span className="truncate text-[13px] font-bold text-content">{client.name}</span>
              <button
                onClick={() => onToggleVip(client)}
                title={isVip(client) ? 'VIP client — click to remove VIP status' : 'Mark this client as VIP'}
                className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold uppercase transition-colors ${isVip(client) ? 'bg-[rgba(240,185,11,0.18)] text-[#f0c33b] ring-1 ring-[rgba(240,185,11,0.3)]' : 'border border-border-dark text-content-subtle hover:bg-[rgba(255,255,255,0.06)] hover:text-content'}`}
              >
                {isVip(client) ? '★ VIP' : '☆ VIP'}
              </button>
            </div>
            {/* How the caller was verified */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[rgba(91,155,255,0.15)] bg-[rgba(91,155,255,0.05)] px-3 py-1.5 text-[10px] text-content-muted">
              <span>📞 <span className="tabular-nums text-content">{client.phone}</span> matched</span>
              <span className="text-up">🎙️ {voiceMatchPct(client.sif)}% voice match</span>
              <span className="text-content-subtle">via caller‑ID + voiceprint</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3">
              <Field label="CIF" value={client.cif} />
              <Field label="Risk" value={client.risk} />
              <Field label="KYC" value={client.kyc} tone={client.kyc === 'Valid' ? 'text-up' : 'text-warning'} />
              <Field label="Day P/L" value={`${client.dayPnlPct >= 0 ? '+' : ''}${client.dayPnlPct.toFixed(1)}%`} tone={client.dayPnlPct >= 0 ? 'text-up' : 'text-down'} />
              <Field label="Available cash" value={fmtMoney(client.cash)} />
              <Field label="Portfolio MV" value={fmtMoney(totalMV)} />
            </div>
            {client.flag && (
              <div className="flex items-start gap-2 border-t border-[rgba(255,170,0,0.3)] bg-[rgba(255,170,0,0.1)] px-3 py-2 text-[11px] text-warning">
                <span>⚠</span><span>{client.flag}</span>
              </div>
            )}
            <div className="border-t border-[rgba(91,155,255,0.15)] px-3 py-2.5">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-content-subtle">Top holdings</div>
              {(() => {
                const shown = holdings.slice(0, 4)
                const maxQty = Math.max(...shown.map((h) => h.quantity), 1)
                return (
                  <ul className="flex flex-col gap-2">
                    {shown.map((h) => {
                      const pct = Math.round((h.quantity / maxQty) * 100)
                      const hChg = price(h.symbol)?.changePct ?? 0
                      return (
                        <li key={h.symbol} className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 font-medium text-content">
                              <span className={`inline-block size-1.5 shrink-0 rounded-full ${hChg >= 0 ? 'bg-up shadow-[0_0_4px_#2fd07a]' : 'bg-down shadow-[0_0_4px_#ff6b72]'}`} />
                              {h.symbol}
                            </span>
                            <span className="tabular-nums text-content-muted">{fmtInt(h.quantity)}</span>
                          </div>
                          <div className="h-[3px] overflow-hidden rounded-full bg-[rgba(91,155,255,0.1)]">
                            <div className="h-full rounded-full bg-gradient-to-r from-[rgba(91,155,255,0.6)] to-[rgba(91,155,255,0.3)]" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )
              })()}
            </div>
          </div>

          {/* Wishlist — price-target alerts per client */}
          <div className="rounded-xl border border-[rgba(240,185,11,0.25)] bg-[#0c0f1a] shadow-[0_0_0_1px_rgba(240,185,11,0.04),0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between border-b border-[rgba(240,185,11,0.15)] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#f0c33b]">
                <span>🔔</span> Wishlist
                {wishlist.length > 0 && <span className="ml-1 rounded-full bg-[rgba(240,185,11,0.2)] px-1.5 py-px text-[10px] font-bold">{wishlist.length}</span>}
              </div>
              <button onClick={() => setWlOpen((o) => !o)} className="rounded px-2 py-0.5 text-[10px] font-semibold text-[#f0c33b] ring-1 ring-[rgba(240,185,11,0.3)] hover:bg-[rgba(240,185,11,0.1)] transition-colors">
                {wlOpen ? 'Cancel' : '+ Add target'}
              </button>
            </div>

            {wlOpen && (
              <div className="border-b border-[rgba(240,185,11,0.12)] bg-[rgba(240,185,11,0.04)] p-2.5 flex flex-wrap gap-1.5 items-end">
                <select value={wlSym} onChange={(e) => { setWlSym(e.target.value); setWlTarget(String((price(e.target.value)?.last ?? 0).toFixed(4))) }}
                  className="h-8 flex-1 min-w-[90px] rounded border border-[rgba(240,185,11,0.25)] bg-[#0b0e15] px-2 text-[12px] text-content outline-none focus:border-[#f0c33b]">
                  {FULL_MARKET.map((s) => <option key={s.symbolShortName} value={s.symbolShortName} className="bg-surface">{s.symbolShortName}</option>)}
                </select>
                <div className="flex flex-col gap-px">
                  <span className="text-[9px] text-content-subtle">Target price</span>
                  <input type="number" value={wlTarget} onChange={(e) => setWlTarget(e.target.value)} placeholder={String((price(wlSym)?.last ?? 0).toFixed(4))}
                    className="h-8 w-24 rounded border border-[rgba(240,185,11,0.25)] bg-[#0b0e15] px-2 text-right text-[12px] text-content outline-none focus:border-[#f0c33b]" />
                </div>
                <div className="flex flex-col gap-px">
                  <span className="text-[9px] text-content-subtle">Qty</span>
                  <input type="number" value={wlQty} onChange={(e) => setWlQty(e.target.value)}
                    className="h-8 w-20 rounded border border-[rgba(240,185,11,0.25)] bg-[#0b0e15] px-2 text-right text-[12px] text-content outline-none focus:border-[#f0c33b]" />
                </div>
                <button onClick={() => {
                  const tp = parseFloat(wlTarget)
                  const q = parseInt(wlQty, 10)
                  if (tp > 0 && q > 0) { onAddToWishlist?.(wlSym, tp, q); setWlOpen(false); setWlTarget('') }
                }} className="h-8 rounded bg-[rgba(240,185,11,0.18)] px-3 text-[11px] font-bold text-[#f0c33b] ring-1 ring-[rgba(240,185,11,0.35)] hover:bg-[rgba(240,185,11,0.28)] transition-colors">
                  Add
                </button>
              </div>
            )}

            <div className="flex flex-col divide-y divide-[rgba(240,185,11,0.08)]">
              {wishlist.length === 0 && !wlOpen && (
                <div className="px-3 py-3 text-[11px] text-content-subtle text-center">No targets set. Add one when a client wants to buy at a lower price.</div>
              )}
              {wishlist.map((item) => {
                const cur = price(item.symbol)?.last ?? 0
                const triggered = cur > 0 && cur <= item.targetPrice
                const pctAway = cur > 0 ? ((item.targetPrice - cur) / cur) * 100 : null
                return (
                  <div key={item.id} className={`flex items-center gap-2 px-3 py-2.5 transition-all ${triggered ? 'bg-[rgba(47,208,122,0.05)]' : ''}`}
                    style={triggered ? { boxShadow: 'inset 0 0 0 1px rgba(47,208,122,0.2)' } : {}}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {triggered && <span className="inline-block size-1.5 rounded-full bg-up shadow-[0_0_6px_#2fd07a] animate-pulse" />}
                        <span className="text-[12px] font-bold text-content">{item.symbol}</span>
                        <span className="text-[10px] text-content-muted tabular-nums">{fmtInt(item.qty)} shares</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] tabular-nums">
                        <span className="text-content-subtle">Target <span className="text-[#f0c33b] font-semibold">{fmtPrice(item.targetPrice)}</span></span>
                        <span className="text-content-subtle">·</span>
                        <span className={triggered ? 'text-up font-semibold' : 'text-content-muted'}>Now {fmtPrice(cur)}</span>
                        {!triggered && pctAway !== null && <span className="text-content-subtle">{pctAway > 0 ? `${pctAway.toFixed(1)}% away` : 'Below target'}</span>}
                        {triggered && <span className="font-bold text-up">✓ Target hit!</span>}
                      </div>
                    </div>
                    {triggered ? (
                      <button onClick={() => onConfirmWishlist?.(item)}
                        className="shrink-0 rounded-md bg-[rgba(47,208,122,0.18)] px-2.5 py-1 text-[10px] font-bold text-up ring-1 ring-[rgba(47,208,122,0.35)] hover:bg-[rgba(47,208,122,0.28)] transition-colors whitespace-nowrap"
                        style={{ boxShadow: '0 0 10px rgba(47,208,122,0.2)' }}>
                        Confirm &amp; place
                      </button>
                    ) : (
                      <button onClick={() => onRemoveFromWishlist?.(item.id)} className="shrink-0 text-content-muted hover:text-down transition-colors" title="Remove">✕</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Advisory (wide) — only once the client has stated a request. The
              narrow layout renders it below the request in the parent. */}
          {showAdvisory && <AdvisoryCard ideas={ideas} onUse={onUseIdea ?? (() => {})} />}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border-dark p-6 text-center text-[12px] text-content-muted">
          Verify a caller to begin. AI matches their number to the CIF, checks their voiceprint, and loads profile, portfolio &amp; risk automatically.
        </div>
      )}
    </div>
  )
}

// Session snapshot persisted to localStorage — shared across the app's windows,
// so "Dock to main" (and reopening) restores the desk instead of refreshing it.
interface AiSnapshot {
  clientSif: string | null
  orders: OrderLine[]
  request: string
  placed: boolean
  casaMoved: number
  transcript: { id: number; speaker: 'Broker' | 'Client' | 'AI'; text: string; time: string }[]
}
const AI_SESSION_KEY = 'order-ai-session-v1'
function loadAiSnapshot(): AiSnapshot | null {
  try { const raw = localStorage.getItem(AI_SESSION_KEY); return raw ? (JSON.parse(raw) as AiSnapshot) : null } catch { return null }
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function OrderPlacementAI({ compact = false, onDock, onOpenWindow }: { compact?: boolean; onDock?: () => void; onOpenWindow?: () => void }) {
  const price = usePrices()
  // Only the docked (compact) instance restores state — a fresh open starts blank.
  const snap = useMemo(() => (compact ? loadAiSnapshot() : null), [compact])
  const [client, setClient] = useState<DeskCustomer | null>(() => (snap?.clientSif ? DESK_CUSTOMERS.find((c) => c.sif === snap.clientSif) ?? null : null))
  const [vipMap, setVipMap] = useState<Record<string, boolean>>({})
  const isVip = (c: DeskCustomer) => vipMap[c.sif] ?? c.vip
  const toggleVip = (c: DeskCustomer) => setVipMap((m) => ({ ...m, [c.sif]: !(m[c.sif] ?? c.vip) }))
  const wishlistId = useRef(0)
  const [wishlistMap, setWishlistMap] = useState<Record<string, WishlistItem[]>>({})
  const wishlist = client ? (wishlistMap[client.sif] ?? []) : []
  const announcedWishlist = useRef<Set<number>>(new Set())
  const [verifying, setVerifying] = useState<DeskCustomer | null>(null)
  const [request, setRequest] = useState(() => snap?.request ?? '')
  const [orders, setOrders] = useState<OrderLine[]>(() => snap?.orders ?? [])
  const [placed, setPlaced] = useState(() => snap?.placed ?? false)
  const [placeCount, setPlaceCount] = useState(0)
  const [placedReview, setPlacedReview] = useState<{ buys: number; sells: number; totalBuy: number; totalSell: number; netCash: number } | null>(null)
  const [placedAt, setPlacedAt] = useState('')
  const placedSnapshot = useRef<OrderLine[]>([]) // full basket snapshot at last placement
  const [casaMoved, setCasaMoved] = useState(() => snap?.casaMoved ?? 0) // funds moved from CASA into the trading account
  const lineId = useRef((snap?.orders ?? []).reduce((m, o) => Math.max(m, o.id), 0))
  const makeLine = (side: Side, symbol: string, qty: number): OrderLine => ({ id: ++lineId.current, side, symbol, qty })
  const updateLine = (id: number, patch: Partial<OrderLine>) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  const removeLine = (id: number) => setOrders((os) => os.filter((o) => o.id !== id))
  const addLine = (side: Side) => setOrders((os) => {
    const used = new Set(os.map((o) => o.symbol))
    const next = bluechipFirst(client?.usualStocks ?? []).find((s) => !used.has(s))
      ?? BLUE_CHIPS.find((s) => !used.has(s))
      ?? FULL_MARKET.find((s) => s.lastPrice > 0 && !used.has(s.symbolShortName))!.symbolShortName
    return [...os, makeLine(side, next, 10_000)]
  })
  const addToWishlist = (symbol: string, targetPrice: number, qty: number) => {
    if (!client) return
    const id = ++wishlistId.current
    setWishlistMap((m) => ({ ...m, [client.sif]: [...(m[client.sif] ?? []), { id, symbol, targetPrice, qty }] }))
  }
  const removeFromWishlist = (id: number) => {
    if (!client) return
    setWishlistMap((m) => ({ ...m, [client.sif]: (m[client.sif] ?? []).filter((x) => x.id !== id) }))
  }
  const confirmWishlistItem = (item: WishlistItem) => {
    setOrders((os) => [...os, makeLine('buy', item.symbol, item.qty)])
    if (!client) return
    setWishlistMap((m) => ({ ...m, [client.sif]: (m[client.sif] ?? []).filter((x) => x.id !== item.id) }))
  }
  const [transcript, setTranscript] = useState<{ id: number; speaker: 'Broker' | 'Client' | 'AI'; text: string; time: string }[]>(() => snap?.transcript ?? [])
  const turnId = useRef((snap?.transcript ?? []).reduce((m, t) => Math.max(m, t.id), 0))
  const freshTurnIds = useRef<Set<number>>(new Set()) // turns added this session (should animate)
  const sessionRef = useRef(0) // bumps on reset / new call so stale scripted turns are dropped

  // Save a snapshot only when docking, so the docked copy restores exactly what
  // was on the window (fresh opens stay blank).
  const handleDock = () => {
    try {
      localStorage.setItem(AI_SESSION_KEY, JSON.stringify({ clientSif: client?.sif ?? null, orders, request, placed, casaMoved, transcript }))
    } catch { /* ignore */ }
    onDock?.()
  }

  const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const addTurn = (speaker: 'Broker' | 'Client' | 'AI', text: string) => {
    const id = ++turnId.current
    freshTurnIds.current.add(id)
    setTranscript((t) => [...t, { id, speaker, text, time: now() }])
  }
  // Alert the broker via the transcript when a wishlist item hits its target price.
  useEffect(() => {
    for (const item of wishlist) {
      if (announcedWishlist.current.has(item.id)) continue
      const cur = price(item.symbol)?.last ?? 0
      if (cur > 0 && cur <= item.targetPrice) {
        announcedWishlist.current.add(item.id)
        addTurn('AI', `🔔 Target reached — ${item.symbol} is now at ${fmtPrice(cur)}, at or below client target of ${fmtPrice(item.targetPrice)}. Confirm purchase to add to basket.`)
      }
    }
  }, [price]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play a scripted exchange, one turn every ~0.9s, so the call feels live. A
  // turn may carry a side-effect (3rd item) that fires when that turn appears —
  // used to reveal the order basket in step with the conversation.
  const playScript = (turns: Array<['Broker' | 'Client' | 'AI', string] | ['Broker' | 'Client' | 'AI', string, () => void]>) => {
    const sid = sessionRef.current
    turns.forEach((entry, i) => setTimeout(() => {
      if (sessionRef.current !== sid) return
      addTurn(entry[0], entry[1])
      entry[2]?.()
    }, i * 900))
  }

  const openClient = (c: DeskCustomer) => {
    const sid = ++sessionRef.current
    setVerifying(c)
    setClient(null)
    setOrders([])
    setRequest('')
    setPlaced(false)
    setCasaMoved(0)
    setTranscript([])
    // Let the verify animation play (caller sweep → voice bars → matched) then open.
    setTimeout(() => {
      if (sessionRef.current !== sid) return
      setClient(c)
      setVerifying(null)
      addTurn('AI', `Caller verified — ${c.name}, CIF ${c.cif}. Inbound number matched the phone on file; voiceprint matched ${voiceMatchPct(c.sif)}%. Profile, portfolio & risk loaded.`)
      playScript([
        ['Broker', `Good morning ${c.name.split(' ')[0]} — you're through to your desk. How can I help today?`],
      ])
    }, 2500)
  }

  // Capture what the client asked for → transcript turn + parsed basket.
  const capture = (text: string) => {
    const clean = text.trim()
    if (!clean) return
    const parts = parseRequestMulti(clean)
    setOrders(parts.map((p) => makeLine(p.side, p.symbol, p.qty)))
    setPlaced(false)
    addTurn('Client', clean)
    if (parts.length) addTurn('AI', `Captured ${parts.length} order line${parts.length > 1 ? 's' : ''} — ${parts.map((p) => `${p.side} ${fmtInt(p.qty)} ${p.symbol}`).join(', ')}. Running market, risk & compliance checks…`)
    else addTurn('AI', 'Heard the request but couldn’t extract an order — please add side, symbol and quantity.')
  }

  const pxOf = (sym: string) => {
    const s = FULL_MARKET.find((x) => x.symbolShortName === sym)
    return s ? (price(sym)?.last ?? s.lastPrice) : 0
  }

  // Start a demo call: verify a client (default to a VIP if none open), clear the
  // desk and seed the transcript — so a demo runs end-to-end without the CIF box.
  const startDemoCall = (): DeskCustomer => {
    const c = client ?? DESK_CUSTOMERS.find((x) => x.vip) ?? DESK_CUSTOMERS[0]
    sessionRef.current++
    setClient(c)
    setVerifying(null)
    setOrders([]); setRequest(''); setPlaced(false); setCasaMoved(0)
    turnId.current += 1
    setTranscript([{ id: turnId.current, speaker: 'AI', text: `Caller verified — ${c.name}, CIF ${c.cif}. Caller‑ID + voiceprint matched. Profile, portfolio & risk loaded.`, time: now() }])
    return c
  }

  // Demo A — a rebalance the client can comfortably afford (buys + two sells).
  const dictateFunded = () => {
    const c = startDemoCall()
    const buyable = bluechipFirst(c.usualStocks).slice(0, 3)
    const budget = c.cash * 0.55
    const parts = buyable.map((sym) => makeLine('buy', sym, Math.max(1000, Math.round((budget / buyable.length / (pxOf(sym) || 1)) / 1000) * 1000)))
    // Trim ~40% of up to two holdings — excluding anything we're buying.
    const sells = c.holdings.filter((h) => (h.available ?? 0) > 0 && !buyable.includes(h.symbol)).slice(0, 2)
    sells.forEach((h) => parts.push(makeLine('sell', h.symbol, Math.min(h.available, Math.max(1000, Math.round((h.available * 0.4) / 1000) * 1000)))))
    const requestText = parts.map((p) => `${p.side} ${fmtInt(p.qty)} ${p.symbol}`).join(', ')
    const totalBuy = parts.filter((p) => p.side === 'buy').reduce((a, l) => a + pxOf(l.symbol) * l.qty, 0)
    const totalSell = parts.filter((p) => p.side === 'sell').reduce((a, l) => a + pxOf(l.symbol) * l.qty, 0)
    const first = c.name.split(' ')[0]
    const buyLines = parts.filter((p) => p.side === 'buy').map((p) => `${fmtInt(p.qty)} ${p.symbol}`).join(', ')
    const sellLines = parts.filter((p) => p.side === 'sell').map((p) => `${fmtInt(p.qty)} ${p.symbol}`).join(' and ')
    playScript([
      ['Broker', `Good morning ${first} — you're through to your desk. How can I help today?`],
      ['Client', `Morning. I'd like to rebalance today — buy ${buyLines}${sellLines ? `, and sell ${sellLines}` : ''}.`],
      ['Broker', `Happy to help. So ${buyable.length} buy${buyable.length === 1 ? '' : 's'}${sells.length ? ` and ${sells.length} sell${sells.length === 1 ? '' : 's'}` : ''} — let me build the basket and check it.`],
      ['AI', `Captured ${parts.length} line${parts.length === 1 ? '' : 's'} — ${parts.map((p) => `${p.side} ${fmtInt(p.qty)} ${p.symbol}`).join(', ')}. Net ${fmtMoney(totalBuy - totalSell)} within ${fmtMoney(c.cash)} available. Fully funded, all clear.`, () => { setOrders(parts); setRequest(requestText) }],
      ['Broker', `You're all set — the sells help fund the buys and everything checks out. I'll place it now.`],
    ])
  }

  // Demo B — a basket that exceeds available cash (AI flags it, needs CASA).
  const dictateShort = () => {
    const c = startDemoCall()
    const buys = bluechipFirst(c.usualStocks).slice(0, 3)
    const target = c.cash + c.casaBalance * 0.4 // over available cash, coverable by CASA
    const parts = buys.map((sym) => makeLine('buy', sym, Math.max(1000, Math.round((target / buys.length / (pxOf(sym) || 1)) / 1000) * 1000)))
    const requestText = parts.map((p) => `${p.side} ${fmtInt(p.qty)} ${p.symbol}`).join(', ')
    const total = parts.reduce((a, l) => a + pxOf(l.symbol) * l.qty, 0)
    const short = Math.max(0, total - c.cash)
    const first = c.name.split(' ')[0]
    const shortBuyLines = parts.map((p) => `${fmtInt(p.qty)} ${p.symbol}`).join(', ')
    playScript([
      ['Broker', `Good morning ${first} — how can I help today?`],
      ['Client', `I'd like to buy ${shortBuyLines} today.`],
      ['Broker', `Of course. Let me size that up and run the checks.`],
      ['AI', `Buying power check — basket is ${parts.map((p) => `${fmtInt(p.qty)} ${p.symbol}`).join(', ')} totalling ${fmtMoney(total)}, but only ${fmtMoney(c.cash)} is available. Short ${fmtMoney(short)}.`, () => { setOrders(parts); setRequest(requestText) }],
      ['Broker', `${first}, you're a little short on settled cash for this — about ${fmtMoney(short)}. Would you like me to move that across from your CASA account to cover it?`],
      ['Client', `Yes, that's fine — please move it from my CASA.`],
      ['Broker', `Great — I'll move it now and then place the basket.`],
    ])
  }
  // Demo C — client wants to buy at a lower price; broker adds it to the wishlist,
  // target is set at the current live price so the alert fires immediately in the demo.
  const dictateWishlist = () => {
    const c = startDemoCall()
    const sym = bluechipFirst(c.usualStocks)[0] ?? BLUE_CHIPS[0]
    const curPx = pxOf(sym)
    const targetPx = parseFloat(curPx.toFixed(4))
    const qty = 50_000
    const first = c.name.split(' ')[0]
    playScript([
      ['Broker', `Good afternoon ${first} — you're through to your desk. How can I help today?`],
      ['Client', `Hi. I've been watching ${sym} — I like the stock but the price feels a bit stretched right now. If it drops to ${fmtPrice(targetPx)}, I'd want 50,000 shares.`],
      ['Broker', `Understood. I'll set a price target alert for ${sym} at ${fmtPrice(targetPx)} for 50,000 shares. The moment it triggers, I'll reach out to confirm and place it.`],
      ['AI', `Wishlist entry created — monitoring ${sym} for a drop to ${fmtPrice(targetPx)}. Alert fires automatically when the market reaches that level.`, () => {
        setWishlistMap((m) => {
          const id = ++wishlistId.current
          return { ...m, [c.sif]: [...(m[c.sif] ?? []), { id, symbol: sym, targetPrice: targetPx, qty }] }
        })
      }],
      ['Client', `Perfect. I'll wait to hear from you.`],
      ['Broker', `Absolutely — I'll call you the moment it hits. Have a good afternoon.`],
    ])
  }

  const analyse = () => capture(request)

  // Broker moves the shortfall from the client's CASA (after the client agrees).
  const moveFromCasa = () => {
    if (!review || review.short <= 0 || !client) return
    const amt = Math.min(review.short, review.casaBalance)
    if (amt <= 0) return
    setCasaMoved((m) => m + amt)
    addTurn('Broker', `Moving ${fmtMoney(amt)} from your CASA (${client.casa}) into the trading account.`)
    addTurn('AI', `${fmtMoney(amt)} moved from CASA — the basket is now fully funded and clear to place.`)
  }

  // Broker places the basket → natural confirmation exchange.
  const placeOrder = () => {
    if (!review || review.blocked || orders.length === 0 || !client) return
    placedSnapshot.current = orders.map((o) => ({ ...o }))
    setPlacedReview({ buys: review.buys, sells: review.sells, totalBuy: review.totalBuy, totalSell: review.totalSell, netCash: review.netCash })
    setPlacedAt(now())
    setPlaceCount((c) => c + 1)
    setPlaced(true)
    const first = client.name.split(' ')[0]
    playScript([
      ['Broker', `All checks passed — I've placed and executed the order: ${review.buys} buy${review.buys === 1 ? '' : 's'}${review.sells ? ` and ${review.sells} sell${review.sells === 1 ? '' : 's'}` : ''}, net ${fmtMoney(review.netCash)}. That's done.`],
      ['Client', `Excellent — thank you for handling all of that at once.`],
      ['Broker', `My pleasure, ${first}. Anything else today?`],
      ['Client', `No, that's everything for now. Thanks again.`],
      ['Broker', `Anytime — have a great day.`],
      ['AI', `${orders.length} orders executed and logged to CRM.`],
    ])
  }

  // Resizable transcript column — drag its left edge to widen it.
  const [transcriptW, setTranscriptW] = useState(320)
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null)
  const beginResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    resizeRef.current = { startX: e.clientX, startW: transcriptW }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const moveResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const ctx = resizeRef.current
    if (!ctx) return
    setTranscriptW(Math.max(280, Math.min(760, ctx.startW + (ctx.startX - e.clientX))))
  }
  const endResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    resizeRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // Temporary: clear the whole desk to start a fresh call.
  const reset = () => {
    sessionRef.current++
    setClient(null)
    setVerifying(null)
    setRequest('')
    setOrders([])
    setPlaced(false)
    setCasaMoved(0)
    setTranscript([])
  }

  // ── AI review of the whole basket ──────────────────────────────────────────
  const review = useMemo(() => {
    if (!client || orders.length === 0) return null
    const lines = orders.map((o) => {
      const s = FULL_MARKET.find((x) => x.symbolShortName === o.symbol)
      const last = s ? (price(o.symbol)?.last ?? s.lastPrice) : 0
      const value = last * o.qty
      const holding = client.holdings.find((h) => h.symbol === o.symbol)
      const issues: { tone: CheckTone; text: string }[] = []
      if (!s) issues.push({ tone: 'block', text: 'unknown symbol' })
      else {
        if (s.remarks === 'suspended') issues.push({ tone: 'block', text: 'suspended — trading blocked' })
        if (o.side === 'sell' && (holding?.available ?? 0) < o.qty) issues.push({ tone: 'block', text: `only ${fmtInt(holding?.available ?? 0)} sellable` })
        if (o.side === 'buy' && client.risk === 'Conservative' && Math.abs(s.changePct) > 2) issues.push({ tone: 'warn', text: `volatile ${fmtPct(s.changePct)} — high for a Conservative mandate` })
      }
      return { o, s, last, value, issues }
    })
    const totalBuy = lines.filter((l) => l.o.side === 'buy').reduce((a, l) => a + l.value, 0)
    const totalSell = lines.filter((l) => l.o.side === 'sell').reduce((a, l) => a + l.value, 0)
    const netCash = totalBuy - totalSell
    const cash = client.cash + casaMoved // available after any CASA top-up
    const casaBalance = Math.max(0, client.casaBalance - casaMoved)
    const short = Math.max(0, netCash - cash)
    const buys = lines.filter((l) => l.o.side === 'buy').length
    const sells = lines.filter((l) => l.o.side === 'sell').length
    // A funding shortfall blocks placement until it's covered (e.g. from CASA).
    const blocked = lines.some((l) => l.issues.some((i) => i.tone === 'block')) || short > 0
    return { lines, totalBuy, totalSell, netCash, cash, casaBalance, short, buys, sells, blocked }
  }, [client, orders, price, casaMoved])

  // True when the basket differs from the last placed snapshot (new line, removed line, or changed qty/side).
  const hasChanges = placed && (() => {
    const snap = placedSnapshot.current
    if (orders.length !== snap.length) return true
    return orders.some((o) => { const s = snap.find((x) => x.id === o.id); return !s || s.qty !== o.qty || s.side !== o.side })
  })()
  const canPlace = !!review && !review.blocked && orders.length > 0 && (!placed || hasChanges)

  // Layout: wide → 3-column (like the window); narrow → stacked. Driven by the
  // real width so a widened docked board switches to the window design.
  const [bodyRef, bodyW] = useWidth<HTMLDivElement>()
  const wide = bodyW > 0 ? bodyW >= 820 : !compact
  const allIdeas = client ? pitchIdeas(client, price) : []
  // "Stronger alternative" only makes sense once there's a buy/sell to compare
  // against; take-profit / momentum come from holdings, so show them from open.
  const ideas = orders.length > 0 ? allIdeas : allIdeas.filter((i) => i.tone !== 'switch')

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#07090e]">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-[rgba(91,155,255,0.2)] bg-gradient-to-r from-[#0b1220] via-[#0d1018] to-[#0f1018] px-3">
        <span className="flex items-center gap-2.5 text-[13px] font-semibold text-content">
          <span className="flex items-center gap-1 rounded bg-[rgba(91,155,255,0.15)] px-1.5 py-0.5 text-[#5b9bff] ring-1 ring-[rgba(91,155,255,0.3)]"><Sparkle /> AI</span>
          Order Placement · AI
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[#5b9bff]/60">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-[#5b9bff] shadow-[0_0_6px_#5b9bff]" />AI Active
          </span>
        </span>
        <div className="flex items-center gap-2">
          <button onClick={reset} title="Clear the desk and start a fresh call (temporary)" className="inline-flex items-center gap-1.5 rounded-md border border-border-dark bg-surface px-2.5 py-1 text-[11px] font-medium text-content hover:bg-[rgba(255,255,255,0.06)]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg> Reset
          </button>
          {onDock ? (
            <button onClick={handleDock} className="inline-flex items-center gap-1.5 rounded-md border border-border-dark bg-surface px-2.5 py-1 text-[11px] font-medium text-content hover:bg-[rgba(255,255,255,0.06)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 10l-5 5 5 5" /><path d="M4 15h11a5 5 0 0 0 5-5V4" /></svg> Dock to main
            </button>
          ) : onOpenWindow ? (
            <button onClick={onOpenWindow} className="inline-flex items-center gap-1.5 rounded-md border border-border-dark bg-surface px-2.5 py-1 text-[11px] font-medium text-content hover:bg-[rgba(255,255,255,0.06)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg> Open in window
            </button>
          ) : null}
        </div>
      </div>

      <div ref={bodyRef} className={`flex min-h-0 flex-1 gap-3 p-3 ${wide ? '' : 'flex-col'}`}>
        {/* Client + order flow. Narrow: scroll together above the pinned transcript. */}
        <div className={wide ? 'contents' : 'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto'}>
        <ClientColumn client={client} onOpen={openClient} verifying={verifying} onUseIdea={(t) => setRequest(t)} narrow={!wide} showAdvisory={wide} ideas={ideas} isVip={isVip} onToggleVip={toggleVip} wishlist={wishlist} onAddToWishlist={addToWishlist} onRemoveFromWishlist={removeFromWishlist} onConfirmWishlist={confirmWishlistItem} />

        {/* AI order flow (center) — below the client column when narrow */}
        <div className={`flex min-w-0 flex-col gap-3 ${wide ? 'min-h-0 flex-1 overflow-y-auto' : 'order-2'}`}>
          {/* Capture request */}
          <div className="rounded-xl border border-[rgba(91,155,255,0.22)] bg-[#0c0f1a] shadow-[0_0_0_1px_rgba(91,155,255,0.04),0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(91,155,255,0.07)] p-3">
            <div className="mb-1.5 flex items-center gap-1.5 border-l-2 border-[#5b9bff] pl-2 text-[11px] font-semibold uppercase tracking-wide text-[#5b9bff]">
              <Sparkle /> Client request
            </div>
            <div className="flex items-center gap-2">
              <input
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') analyse() }}
                disabled={!client}
                placeholder={client ? "e.g. “buy 100k Emaar, 50k DIB and sell 30k SALIK”" : 'Verify a client first…'}
                className="h-9 min-w-0 flex-1 rounded-md border border-border-dark bg-[#15171a] px-3 text-[13px] text-content outline-none focus:border-action disabled:opacity-50"
              />
              <button onClick={analyse} disabled={!client || !request.trim()} className="h-9 rounded-md px-3 text-[12px] font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>Analyse</button>
            </div>
            {/* Two demo calls: one funded, one that needs a CASA top-up. */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-content-subtle">Demo calls:</span>
              <button onClick={dictateFunded} disabled={!client} title="Simulate a call the client can afford" className="flex items-center gap-1.5 rounded-md border border-[rgba(47,208,122,0.35)] bg-[rgba(47,208,122,0.07)] px-2.5 py-1.5 text-[11px] font-semibold text-up ring-1 ring-[rgba(47,208,122,0.1)] hover:bg-[rgba(47,208,122,0.13)] disabled:opacity-40">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                Funded call
              </button>
              <button onClick={dictateShort} disabled={!client} title="Simulate a call that needs a CASA top-up" className="flex items-center gap-1.5 rounded-md border border-[rgba(255,170,0,0.35)] bg-[rgba(255,170,0,0.07)] px-2.5 py-1.5 text-[11px] font-semibold text-warning ring-1 ring-[rgba(255,170,0,0.1)] hover:bg-[rgba(255,170,0,0.13)] disabled:opacity-40">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                Short funds call
              </button>
              <button onClick={dictateWishlist} disabled={!client} title="Simulate a client setting a price-target alert" className="flex items-center gap-1.5 rounded-md border border-[rgba(240,185,11,0.35)] bg-[rgba(240,185,11,0.07)] px-2.5 py-1.5 text-[11px] font-semibold text-[#f0c33b] ring-1 ring-[rgba(240,185,11,0.1)] hover:bg-[rgba(240,185,11,0.13)] disabled:opacity-40">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                Wishlist call
              </button>
            </div>
            {orders.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-content-subtle">Order basket · {orders.length} line{orders.length > 1 ? 's' : ''}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => addLine('buy')} className="rounded border border-[rgba(0,98,255,0.35)] bg-[rgba(0,98,255,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#9cc0ff] hover:bg-[rgba(0,98,255,0.18)]">＋ Buy</button>
                    <button onClick={() => addLine('sell')} className="rounded border border-[rgba(255,107,114,0.35)] bg-offer-surface px-2 py-0.5 text-[10px] font-semibold text-down hover:brightness-125">＋ Sell</button>
                  </div>
                </div>
                {/* Buy section */}
                {orders.some((o) => o.side === 'buy') && (
                  <div className="overflow-hidden rounded-lg border-2 border-[#0062ff] bg-[rgba(0,98,255,0.08)]">
                    <div className="flex items-center justify-between px-2.5 py-1.5" style={{ background: 'linear-gradient(135deg, #0062ff 0%, #0040cc 100%)' }}>
                      <span className="text-[13px] font-black uppercase tracking-widest text-white">↑ Buy · {orders.filter((o) => o.side === 'buy').length}</span>
                      <span className="text-[10px] tabular-nums text-white/80">{fmtMoney(orders.filter((o) => o.side === 'buy').reduce((a, o) => { const s = FULL_MARKET.find((x) => x.symbolShortName === o.symbol); const last = s ? (price(o.symbol)?.last ?? s.lastPrice) : 0; return a + last * o.qty }, 0))}</span>
                    </div>
                    <ul className="flex flex-col divide-y divide-[rgba(0,98,255,0.25)]">
                      {orders.filter((o) => o.side === 'buy').map((o) => {
                        const s = FULL_MARKET.find((x) => x.symbolShortName === o.symbol)
                        const last = s ? (price(o.symbol)?.last ?? s.lastPrice) : 0
                        return (
                          <li key={o.id} className="flex items-center gap-2 px-2 py-1.5">
                            <select value={o.symbol} onChange={(e) => updateLine(o.id, { symbol: e.target.value })} className="h-7 min-w-0 flex-1 rounded border border-border-dark bg-[#15171a] px-2 text-[12px] text-content outline-none focus:border-action">
                              {FULL_MARKET.map((x) => <option key={x.symbolShortName} value={x.symbolShortName} className="bg-surface">{x.symbolShortName}</option>)}
                            </select>
                            <input type="number" value={o.qty} onChange={(e) => updateLine(o.id, { qty: Math.max(0, +e.target.value) })} className="h-7 w-24 rounded border border-border-dark bg-[#15171a] px-2 text-right text-[12px] text-content outline-none focus:border-action" />
                            <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-content-muted">{fmtMoney(last * o.qty)}</span>
                            <button onClick={() => updateLine(o.id, { side: 'sell' })} title="Move to Sell" className="shrink-0 text-[10px] text-content-subtle hover:text-down">↓</button>
                            <button onClick={() => removeLine(o.id)} className="shrink-0 text-content-muted hover:text-down" title="Remove" aria-label="Remove">✕</button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
                {/* Sell section */}
                {orders.some((o) => o.side === 'sell') && (
                  <div className="overflow-hidden rounded-lg border-2 border-[#e0383d] bg-[rgba(224,56,61,0.08)]">
                    <div className="flex items-center justify-between px-2.5 py-1.5" style={{ background: 'linear-gradient(135deg, #e0383d 0%, #b02428 100%)' }}>
                      <span className="text-[13px] font-black uppercase tracking-widest text-white">↓ Sell · {orders.filter((o) => o.side === 'sell').length}</span>
                      <span className="text-[10px] tabular-nums text-white/80">{fmtMoney(orders.filter((o) => o.side === 'sell').reduce((a, o) => { const s = FULL_MARKET.find((x) => x.symbolShortName === o.symbol); const last = s ? (price(o.symbol)?.last ?? s.lastPrice) : 0; return a + last * o.qty }, 0))}</span>
                    </div>
                    <ul className="flex flex-col divide-y divide-[rgba(224,56,61,0.25)]">
                      {orders.filter((o) => o.side === 'sell').map((o) => {
                        const s = FULL_MARKET.find((x) => x.symbolShortName === o.symbol)
                        const last = s ? (price(o.symbol)?.last ?? s.lastPrice) : 0
                        return (
                          <li key={o.id} className="flex items-center gap-2 px-2 py-1.5">
                            <select value={o.symbol} onChange={(e) => updateLine(o.id, { symbol: e.target.value })} className="h-7 min-w-0 flex-1 rounded border border-border-dark bg-[#15171a] px-2 text-[12px] text-content outline-none focus:border-action">
                              {FULL_MARKET.map((x) => <option key={x.symbolShortName} value={x.symbolShortName} className="bg-surface">{x.symbolShortName}</option>)}
                            </select>
                            <input type="number" value={o.qty} onChange={(e) => updateLine(o.id, { qty: Math.max(0, +e.target.value) })} className="h-7 w-24 rounded border border-border-dark bg-[#15171a] px-2 text-right text-[12px] text-content outline-none focus:border-action" />
                            <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-content-muted">{fmtMoney(last * o.qty)}</span>
                            <button onClick={() => updateLine(o.id, { side: 'buy' })} title="Move to Buy" className="shrink-0 text-[10px] text-content-subtle hover:text-[#9cc0ff]">↑</button>
                            <button onClick={() => removeLine(o.id)} className="shrink-0 text-content-muted hover:text-down" title="Remove" aria-label="Remove">✕</button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advisory sits between the request and review in the narrow layout. */}
          {!wide && client && <AdvisoryCard ideas={ideas} onUse={setRequest} />}

          {/* AI review — hidden after placement unless the basket has changed */}
          {review && client && (!placed || hasChanges) && (
            <div className="rounded-xl border border-[rgba(91,155,255,0.22)] bg-[#0c0f1a] shadow-[0_0_0_1px_rgba(91,155,255,0.04),0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(91,155,255,0.07)]">
              <div className="flex items-center justify-between border-b border-[rgba(91,155,255,0.2)] bg-[rgba(91,155,255,0.06)] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#5b9bff]"><Sparkle /> AI review &amp; checks</span>
                <span className="text-[11px] text-content-muted">{review.buys} buy{review.buys === 1 ? '' : 's'} · {review.sells} sell{review.sells === 1 ? '' : 's'}</span>
              </div>

              {/* Aggregate across the basket */}
              <div className="grid grid-cols-4 gap-3 border-b border-[rgba(91,155,255,0.15)] px-3 py-2.5">
                <Field label="Total buys" value={fmtMoney(review.totalBuy)} tone="text-[#9cc0ff]" />
                <Field label="Total sells" value={fmtMoney(review.totalSell)} tone="text-down" />
                <Field label="Net cash" value={fmtMoney(review.netCash)} tone={review.short > 0 ? 'text-warning' : 'text-content'} />
                <Field label="Available" value={fmtMoney(review.cash)} tone={casaMoved > 0 ? 'text-up' : 'text-content'} />
              </div>

              {/* Per-line */}
              <ul className="divide-y divide-[rgba(91,155,255,0.12)]">
                {review.lines.map((l) => {
                  const block = l.issues.some((i) => i.tone === 'block')
                  const warn = l.issues.some((i) => i.tone === 'warn')
                  return (
                    <li key={l.o.id} className="flex items-start gap-2.5 px-3 py-2">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${l.o.side === 'buy' ? 'bg-[rgba(0,98,255,0.16)] text-[#9cc0ff]' : 'bg-offer-surface text-down'}`}>{l.o.side}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                          <span className="text-[12px] font-semibold text-content">{l.o.symbol}</span>
                          <span className="rounded bg-[#15171a] px-1.5 py-0.5 text-[14px] font-bold tabular-nums text-content">{fmtInt(l.o.qty)}<span className="ml-0.5 text-[9px] font-medium text-content-muted">sh</span></span>
                          <span className="text-[11px] text-content-subtle">@</span>
                          <span className="rounded bg-[rgba(0,98,255,0.14)] px-1.5 py-0.5 text-[14px] font-bold tabular-nums text-[#9cc0ff]">{fmtPrice(l.last)}</span>
                          <span className="text-[11px] text-content-subtle">=</span>
                          <span className="text-[12px] font-semibold tabular-nums text-content">{fmtMoney(l.value)}</span>
                        </div>
                        {l.issues.length > 0 && <div className={`text-[11px] ${block ? 'text-down' : warn ? 'text-warning' : 'text-content-muted'}`}>{l.issues.map((i) => i.text).join(' · ')}</div>}
                      </div>
                      <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-[#0b0c0d] ${block ? 'bg-down' : warn ? 'bg-warning' : 'bg-up'}`}>{block ? '✕' : warn ? '!' : '✓'}</span>
                    </li>
                  )
                })}
              </ul>

              {/* Basket-level checks */}
              <ul className="divide-y divide-[rgba(91,155,255,0.12)] border-t border-[rgba(91,155,255,0.15)]">
                <CheckRow
                  tone={review.short > 0 ? 'warn' : 'pass'}
                  title="Buying power"
                  detail={review.short > 0
                    ? `Not enough cash — the basket needs ${fmtMoney(review.netCash)} but only ${fmtMoney(review.cash)} is available (short ${fmtMoney(review.short)}). CASA ${client.casa} holds ${fmtMoney(review.casaBalance)}. Ask the client to approve moving the difference.`
                    : `Covered — net ${fmtMoney(review.netCash)} within ${fmtMoney(review.cash)} available${casaMoved > 0 ? ` (incl. ${fmtMoney(casaMoved)} moved from CASA)` : ''}.`}
                  action={review.short > 0 ? <button onClick={moveFromCasa} className="shrink-0 self-center rounded px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: BLUE }}>Move {fmtMoney(review.short)} from CASA</button> : undefined}
                />
                <CheckRow tone={client.kyc === 'Valid' ? 'pass' : 'warn'} title="KYC & mandate" detail={client.kyc === 'Valid' ? 'KYC valid; basket within mandate.' : 'Client KYC review due before large orders.'} />
                <CheckRow tone={review.blocked ? 'block' : 'pass'} title="Compliance" detail={review.blocked ? 'One or more lines are blocked — fix them before placing.' : 'All lines clear of restricted / watch lists.'} />
              </ul>

              <div className="flex items-center justify-between gap-3 border-t border-[rgba(91,155,255,0.15)] px-3 py-2.5">
                <span className="text-[11px] text-content-muted">{review.blocked ? (review.short > 0 ? 'Not enough cash — move funds from CASA (with the client’s approval) to place.' : 'Resolve the blocking line before placing.') : 'Reviewed — confirm with the client, then place the basket.'}</span>
                <button onClick={placeOrder} disabled={!canPlace} className={`rounded-md px-4 py-1.5 text-[13px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 ${canPlace ? 'btn-glow-ai' : ''}`} style={{ background: review.blocked ? '#5b6472' : BLUE }}>
                  Place {orders.length} order{orders.length > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Post-trade — visible after placement, hidden while broker edits for a new batch */}
          {placed && placedReview && client && !hasChanges && (
            <div key={placeCount} className="anim-pop-in shrink-0 overflow-hidden rounded-xl border border-[rgba(47,208,122,0.45)] bg-[#060d0a]" style={{ boxShadow: '0 0 40px rgba(47,208,122,0.1), 0 0 0 1px rgba(47,208,122,0.12)' }}>
              <div className="flex items-center gap-2.5 border-b border-[rgba(47,208,122,0.18)] bg-gradient-to-r from-[rgba(47,208,122,0.14)] via-[rgba(47,208,122,0.06)] to-transparent px-3 py-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-up text-[12px] font-black text-[#060d0a]">✓</span>
                <span className="text-[13px] font-bold text-up">Orders executed</span>
                <span className="ml-auto text-[10px] tabular-nums text-content-muted">{client.name} · {client.cif}</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-[rgba(47,208,122,0.1)]">
                <div className="flex flex-col items-center justify-center gap-0.5 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-content-subtle">{placedReview.buys} Buy{placedReview.buys === 1 ? '' : 's'}</div>
                  <div className="text-[19px] font-black tabular-nums text-[#5b9bff]">{fmtMoney(placedReview.totalBuy)}</div>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-content-subtle">{placedReview.sells} Sell{placedReview.sells === 1 ? '' : 's'}</div>
                  <div className="text-[19px] font-black tabular-nums text-down">{fmtMoney(placedReview.totalSell)}</div>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-content-subtle">Net cash</div>
                  <div className="text-[19px] font-black tabular-nums text-up">{fmtMoney(placedReview.netCash)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 border-t border-[rgba(47,208,122,0.1)] px-3 py-1.5 text-[10px] text-content-subtle">
                <Sparkle className="text-[#5b9bff]" /> Logged to CRM &amp; audit trail automatically.
                {placedAt && <span className="ml-auto tabular-nums font-semibold text-content-muted">{placedAt}</span>}
              </div>
            </div>
          )}
        </div>

        </div>{/* end client + order-flow wrapper */}

        {/* Live call transcript — right column (resizable) or pinned to the bottom when docked. */}
        {(client || verifying || transcript.length > 0) && (
          <div
            className={`relative flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-[rgba(91,155,255,0.35)] bg-[#05070d] ${wide ? '' : 'h-[220px] w-full'}`}
            style={wide ? { width: transcriptW } : undefined}
          >
            {wide && (
              <div
                onPointerDown={beginResize}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onLostPointerCapture={endResize}
                title="Drag to widen the transcript"
                className="absolute bottom-0 left-0 top-0 z-20 w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-[#5b9bff]/60"
              />
            )}
            <div className="flex items-center justify-between border-b border-[rgba(91,155,255,0.2)] bg-[rgba(91,155,255,0.06)] px-3 py-2">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-content"><Sparkle className="text-[#5b9bff]" /> Live call transcript</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#ff6b72]">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-[#ff6b72] shadow-[0_0_5px_#ff6b72]" /> Rec
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-[11px] text-content-muted">
                  <span className="inline-block size-2 animate-pulse rounded-full bg-[#5b9bff] shadow-[0_0_8px_#5b9bff]" />
                  Connecting call…
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {transcript.map((t) => {
                    const animate = freshTurnIds.current.has(t.id)
                    return (
                      <li key={t.id} className={t.speaker === 'AI' ? 'flex justify-center' : t.speaker === 'Broker' ? 'flex justify-end' : 'flex justify-start'}>
                        {t.speaker === 'AI' ? (
                          <span className="flex max-w-[90%] items-center gap-1.5 rounded-lg border border-[rgba(91,155,255,0.25)] bg-[rgba(91,155,255,0.07)] px-3 py-1.5 text-[11px] text-[#8bb8ff] shadow-[0_0_12px_rgba(91,155,255,0.08)]">
                            <Sparkle className="shrink-0 text-[#5b9bff]" /><TypedText text={t.text} animate={animate} />
                          </span>
                        ) : (
                          <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[12px] ${
                            t.speaker === 'Broker'
                              ? 'bg-gradient-to-br from-[rgba(0,98,255,0.25)] to-[rgba(0,98,255,0.14)] ring-1 ring-[rgba(0,98,255,0.3)] text-content'
                              : 'bg-[rgba(255,255,255,0.05)] ring-1 ring-[rgba(255,255,255,0.08)] text-content'
                          }`}>
                            <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-content-subtle">
                              <span>{t.speaker}</span><span className="tabular-nums font-normal normal-case opacity-60">{t.time}</span>
                            </div>
                            <TypedText text={t.text} animate={animate} />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
