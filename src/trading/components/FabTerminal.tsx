import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import RGL, { WidthProvider } from 'react-grid-layout/legacy'
import type { Layout as RGLLayout, LayoutItem as RGLLayoutItem } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { sendToBoard } from '../popout'
import { usePrices, useLiveSymbols } from '../simData'
import { Panel, Button, Badge, SegmentedTabs, Drawer } from './ui'
import BuySellDrawer from './BuySellDrawer'
import {
  MARKET_INDICES,
  FULL_MARKET,
  WATCHLIST,
  TICKERS,
  MARKET_DEPTH_FULL,
  TIME_SALES,
  MARKET_NAMES,
  getCandles,
  fmtPrice,
  fmtInt,
  fmtPct,
  fmtChange,
  fmtMoney,
} from '../data'
import type { Symbol, Candle, MarketCode, MarketIndex } from '../data'
import { useLiveData } from '../liveData'

// ── Market scoping ───────────────────────────────────────────────────────────
// The terminal is bound to one market at a time (driven by the active tab).
// DFM carries as much real Yahoo data as we can get; ADX / Nasdaq are simulated.
const PREFERRED_SYMBOL: Partial<Record<MarketCode, string>> = { DFM: 'EMAAR', ADX: 'FAB', NASDAQ: 'DPW' }

/** All symbols listed on a given market. */
function symbolsForMarket(market: MarketCode): Symbol[] {
  return FULL_MARKET.filter((s) => s.marketShortName === market)
}

/** A sensible default symbol to open the terminal on for a market. */
function defaultSymbolFor(market: MarketCode): Symbol {
  const list = symbolsForMarket(market)
  const pref = PREFERRED_SYMBOL[market]
  return list.find((s) => s.symbolShortName === pref) ?? list[0] ?? FULL_MARKET[0]
}

/** Indices that belong to a market. */
function indicesForMarket(market: MarketCode) {
  return MARKET_INDICES.filter((ix) => ix.marketName === MARKET_NAMES[market])
}

/** Watchlist scoped to the market (the curated DFM list, or the market's names). */
function watchlistForMarket(market: MarketCode): Symbol[] {
  if (market === 'DFM') return WATCHLIST
  return symbolsForMarket(market).slice(0, 10)
}

/** Whether a market has genuine live coverage (only DFM, via Yahoo). */
function marketHasLiveFeed(market: MarketCode): boolean {
  return market === 'DFM'
}

/**
 * FabTerminal — a Bloomberg-grade, information-dense multi-panel securities
 * terminal re-skinned in the FAB design language: rounded #1a1c1e cards on a
 * #111315 page, 1px #2a2c2e borders, FAB-blue accents, Inter type, soft
 * green/red market movement and crisp pure-inline-SVG charts. No literal
 * amber/black mono Bloomberg styling — same density & features, FAB beautiful.
 */

// ── Chart palette ──────────────────────────────────────────────────────────
const UP = '#2fd07a'
const DOWN = '#ff6b72'
const GRID = '#2a2c2e'
const LABEL = '#979797'

// ── Deterministic LCG (stable across renders, no Math.random) ───────────────
function makeRng(seedStr: string) {
  let seed = [...seedStr].reduce((a, c) => a + c.charCodeAt(0), 7) & 0x7fffffff
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

/** A faint deterministic 24-point sparkline series for an index. */
function sparkSeries(seedStr: string, count = 24): number[] {
  const rng = makeRng(seedStr)
  const out: number[] = []
  let v = 50
  for (let i = 0; i < count; i++) {
    v += (rng() - 0.48) * 14
    v = Math.max(8, Math.min(92, v))
    out.push(v)
  }
  return out
}

function buildPath(values: number[], w: number, h: number, pad = 1): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = (w - pad * 2) / (values.length - 1)
  return values
    .map((v, i) => {
      const x = pad + i * step
      const y = pad + (1 - (v - min) / span) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

const fmt2 = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`

// ── Simulated live feed ─────────────────────────────────────────────────────
// A single shared tick drives every animated value. Values OSCILLATE around
// their base via Math.sin, so they "breathe" and loop back instead of drifting.

/** Shared 1.2s tick. Static (no interval) when prefers-reduced-motion. */
function useLiveTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setTick((t) => t + 1), 1200)
    return () => clearInterval(id)
  }, [])
  return tick
}

/** Oscillate `base` around itself (loops, never drifts). `amp` ≤ 0.4%. */
function live(base: number, tick: number, seed: number, amp = 0.0018): number {
  return base * (1 + Math.sin(tick * 0.7 + seed) * amp)
}

/** Stable per-item seed from a string (sum of char codes). */
function seedOf(s: string): number {
  return [...s].reduce((a, c) => a + c.charCodeAt(0), 0)
}

/**
 * Brief green/red flash on change. Keeps a ref of the previously shown value
 * and returns the matching `tick-up` / `tick-down` class, re-triggered by `key`.
 */
function FlashNum({ value, className = '' }: { value: number; className?: string }) {
  const prev = useRef(value)
  const dir = value > prev.current ? 'tick-up' : value < prev.current ? 'tick-down' : ''
  prev.current = value
  return <span className={`${className} ${dir}`}>{fmtPrice(value)}</span>
}

// ── Sparkline ────────────────────────────────────────────────────────────
function Sparkline({ seed, dir }: { seed: string; dir: 'up' | 'down' | 'flat' }) {
  const w = 70
  const h = 20
  const values = sparkSeries(seed)
  const stroke = dir === 'down' ? DOWN : dir === 'up' ? UP : LABEL
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <path d={buildPath(values, w, h)} fill="none" stroke={stroke} strokeWidth={1.25} strokeOpacity={0.7} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Row sparkline (close-price micro chart for a symbol) ────────────────────
function RowSparkline({ short, w = 56, h = 16 }: { short: string; w?: number; h?: number }) {
  const closes = getCandles(short).slice(-20).map((c) => c.c)
  const dir: 'up' | 'down' | 'flat' =
    closes.length < 2 ? 'flat' : closes[closes.length - 1] > closes[0] ? 'up' : closes[closes.length - 1] < closes[0] ? 'down' : 'flat'
  const stroke = dir === 'down' ? DOWN : dir === 'up' ? UP : LABEL
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <path d={buildPath(closes, w, h)} fill="none" stroke={stroke} strokeWidth={1.25} strokeOpacity={0.85} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Resolve a full Symbol from FULL_MARKET by short name. */
function bySymbol(short: string): Symbol | undefined {
  return FULL_MARKET.find((r) => r.symbolShortName === short)
}

// ── Indices panel ──────────────────────────────────────────────────────────
function IndicesPanel({ tick, indices }: { tick: number; indices: MarketIndex[] }) {
  const price = usePrices()
  return (
    <Panel title="Indices" bodyClassName="overflow-y-auto" noPadding>
      <ul className="divide-y divide-border-dark">
        {indices.map((ix) => {
          // Base off the real (DFM index) / simulated (ADX etc.) value, then a
          // tiny oscillation; chg% recomputed vs prevClose so ▲/▼ stay in sync.
          const base = price(ix.shortName)?.last ?? ix.indexCurrent
          const liveVal = live(base, tick, seedOf(ix.shortName))
          const liveChgPct = ((liveVal - ix.prevClose) / ix.prevClose) * 100
          const dir: 'up' | 'down' | 'flat' = liveChgPct > 0.0005 ? 'up' : liveChgPct < -0.0005 ? 'down' : 'flat'
          const tone = dir === 'down' ? 'text-down' : dir === 'up' ? 'text-up' : 'text-flat'
          return (
            <li key={ix.shortName} className="flex items-center gap-2.5 px-4 py-2">
              <span className="w-16 shrink-0 truncate text-[12px] font-medium text-content" title={ix.name}>
                {ix.shortName}
              </span>
              <Sparkline seed={ix.shortName} dir={ix.direction} />
              <span className="ml-auto text-right text-[12px] tabular-nums text-content">
                <FlashNum value={liveVal} />
              </span>
              <span className={`flex w-[64px] shrink-0 items-center gap-1 text-[12px] tabular-nums ${tone}`}>
                <span className="w-3 shrink-0 text-center text-[10px]">{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—'}</span>
                <span className="flex-1 text-right">{fmtPct(liveChgPct).replace('+', '')}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

// ── EMAAR hero + candlestick + volume ───────────────────────────────────────
const PAD_L = 12
const PAD_R = 46

/** Track an element's live pixel width (responsive to panel resize). */
function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

function CandleChart({ candles: src, mode, tick, width }: { candles: Candle[]; mode: 'Candles' | 'Line'; tick: number; width: number }) {
  // Render at the container's real pixel width, 1:1 (no viewBox scaling), so the
  // chart fills the panel and spreads as it resizes — without stretching candles
  // or axis text. Callers only mount this once `width` is measured (> 0).
  const w = Math.max(160, Math.round(width))
  const h = 220
  const padL = PAD_L
  const padR = PAD_R
  const padT = 8
  const padB = 8
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const [hover, setHover] = useState<number | null>(null)

  // Animate ONLY the last candle so the chart "breathes" — never mutate source.
  const candles = useMemo(() => {
    if (src.length === 0) return src
    const last = src[src.length - 1]
    const lc = live(last.c, tick, 1, 0.004)
    const next = src.slice()
    next[next.length - 1] = { ...last, c: lc, h: Math.max(last.h, lc), l: Math.min(last.l, lc) }
    return next
  }, [src, tick])

  const highs = candles.map((c) => c.h)
  const lows = candles.map((c) => c.l)
  const max = Math.max(...highs)
  const min = Math.min(...lows)
  const span = max - min || 1
  const y = (p: number) => padT + (1 - (p - min) / span) * plotH

  const slot = plotW / candles.length
  const bodyW = Math.max(2, slot * 0.62)
  const xAt = (i: number) => padL + i * slot + slot / 2

  const gridVals = Array.from({ length: 5 }, (_, i) => min + (span * i) / 4)

  // Smooth-ish close-price line (centred in each slot) for Line mode.
  const linePts = candles.map((c, i) => ({ x: xAt(i), y: y(c.c) }))
  const linePath = linePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath =
    linePts.length > 0
      ? `${linePath} L${linePts[linePts.length - 1].x.toFixed(1)},${h - padB} L${linePts[0].x.toFixed(1)},${h - padB} Z`
      : ''
  const lineDir = candles.length >= 2 && candles[candles.length - 1].c >= candles[0].c ? UP : DOWN

  // Map a pointer event to the nearest candle index (viewBox units == px here).
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const px = ((e.clientX - rect.left) / rect.width) * w
    const idx = Math.max(0, Math.min(candles.length - 1, Math.round((px - padL - slot / 2) / slot)))
    setHover(idx)
  }

  const hc = hover != null ? candles[hover] : null
  const hx = hover != null ? xAt(hover) : 0
  const hUp = hc ? hc.c >= hc.o : true
  // Tooltip box, flipped to the left of the cursor near the right edge.
  const boxW = 92
  const boxH = 62
  const bx = hover != null ? (hx + boxW + 12 > w - padR ? hx - boxW - 8 : hx + 8) : 0

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="block w-full touch-none"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0062ff" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#0062ff" stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridVals.map((gv, i) => (
        <g key={i}>
          <line x1={padL} x2={padL + plotW} y1={y(gv)} y2={y(gv)} stroke={GRID} strokeWidth={1} />
          <text x={w - 4} y={y(gv) + 3} textAnchor="end" fontSize={9} fill={LABEL} className="tabular-nums">
            {gv.toFixed(2)}
          </text>
        </g>
      ))}
      {mode === 'Line' ? (
        <>
          {areaPath && <path d={areaPath} fill="url(#heroArea)" stroke="none" />}
          <path d={linePath} fill="none" stroke="#0062ff" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
          {linePts.length > 0 && <circle cx={linePts[linePts.length - 1].x} cy={linePts[linePts.length - 1].y} r={2.6} fill={lineDir} />}
        </>
      ) : (
        candles.map((c, i) => {
          const cx = xAt(i)
          const up = c.c >= c.o
          const col = up ? UP : DOWN
          const yo = y(c.o)
          const yc = y(c.c)
          const top = Math.min(yo, yc)
          const bh = Math.max(1, Math.abs(yc - yo))
          return (
            <g key={i} opacity={hover != null && hover !== i ? 0.55 : 1}>
              <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1} />
              <rect x={cx - bodyW / 2} y={top} width={bodyW} height={bh} fill={col} rx={0.6} />
            </g>
          )
        })
      )}

      {/* Interactive crosshair + OHLC tooltip */}
      {hc && (
        <g pointerEvents="none">
          <line x1={hx} x2={hx} y1={padT} y2={h - padB} stroke={LABEL} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          <line x1={padL} x2={padL + plotW} y1={y(hc.c)} y2={y(hc.c)} stroke={LABEL} strokeWidth={1} strokeDasharray="3 3" opacity={0.35} />
          <circle cx={hx} cy={y(hc.c)} r={3} fill={hUp ? UP : DOWN} />
          <rect x={w - padR + 1} y={y(hc.c) - 7} width={padR - 2} height={14} rx={2} fill={hUp ? UP : DOWN} />
          <text x={w - 3} y={y(hc.c) + 3} textAnchor="end" fontSize={9} fill="#0b0c0d" className="tabular-nums" fontWeight={700}>{hc.c.toFixed(2)}</text>
          <g transform={`translate(${bx}, ${padT + 4})`}>
            <rect width={boxW} height={boxH} rx={4} fill="#0b0c0d" stroke={GRID} />
            {([['O', hc.o], ['H', hc.h], ['L', hc.l], ['C', hc.c]] as const).map(([k, v], i) => (
              <text key={k} x={8} y={15 + i * 13} fontSize={9} className="tabular-nums" fill={LABEL}>
                {k} <tspan fill={hUp ? UP : DOWN}>{v.toFixed(2)}</tspan>
              </text>
            ))}
          </g>
        </g>
      )}
    </svg>
  )
}

function VolumeChart({ candles, width }: { candles: Candle[]; width: number }) {
  const w = Math.max(160, Math.round(width))
  const h = 40
  const padL = PAD_L
  const padR = PAD_R
  const plotW = w - padL - padR
  const max = Math.max(...candles.map((c) => c.v)) || 1
  const slot = plotW / candles.length
  const barW = Math.max(2, slot * 0.62)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block w-full">
      {candles.map((c, i) => {
        const cx = padL + i * slot + slot / 2
        const bh = (c.v / max) * (h - 2)
        const up = c.c >= c.o
        return <rect key={i} x={cx - barW / 2} y={h - bh} width={barW} height={bh} fill={up ? UP : DOWN} opacity={0.4} />
      })}
    </svg>
  )
}

function HeroField({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-content-muted">{label}</span>
      <span className={`text-[13px] tabular-nums ${tone ?? 'text-content'}`}>{value}</span>
    </div>
  )
}

const CHART_MODES = ['Candles', 'Line'] as const
type ChartMode = (typeof CHART_MODES)[number]

function HeroPanel({ sym, onTrade, tick }: { sym: Symbol; onTrade: (symbol: Symbol, side: 'buy' | 'sell') => void; tick: number }) {
  const [mode, setMode] = useState<ChartMode>('Candles')
  const [chartRef, chartW] = useElementWidth<HTMLDivElement>()
  const candles = useMemo(() => getCandles(sym.symbolShortName).slice(-45), [sym.symbolShortName])

  // Base off the real live (DFM) / simulated (ADX) price where available, then
  // add a tiny oscillation so ▲/▼, colour and the pct chip move together.
  const price = usePrices()
  const base = price(sym.symbolShortName)?.last ?? sym.lastPrice
  const liveLast = live(base, tick, seedOf(sym.symbolShortName), 0.0022)
  const liveChange = liveLast - sym.prevClose
  const liveChangePct = sym.prevClose ? (liveChange / sym.prevClose) * 100 : 0
  const tone = liveChange > 0 ? 'text-up' : liveChange < 0 ? 'text-down' : 'text-flat'
  return (
    <Panel
      title={
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-semibold text-content">{sym.symbolShortName}</span>
          <span className="text-[12px] text-content-muted">· {sym.symbolName}</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-1.5 pr-14">
          <Button variant="buy" size="sm" onClick={() => onTrade(sym, 'buy')}>Buy</Button>
          <Button variant="sell" size="sm" onClick={() => onTrade(sym, 'sell')}>Sell</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Last + change */}
        <div className="flex flex-wrap items-end gap-3">
          <FlashNum value={liveLast} className={`text-[32px] font-semibold leading-none tabular-nums ${tone}`} />
          <span className={`text-[15px] tabular-nums ${tone}`}>
            {liveChange > 0 ? '▲' : liveChange < 0 ? '▼' : '—'} {fmtChange(liveChange)}
          </span>
          <Badge tone={liveChange > 0 ? 'up' : liveChange < 0 ? 'down' : 'neutral'}>{fmtPct(liveChangePct)}</Badge>
          <span className="ml-auto text-[11px] text-content-muted">AED · {sym.marketShortName} · {sym.sector}</span>
        </div>

        {/* Field grid */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 rounded-lg border border-border-dark bg-[#15171a] p-3.5">
          <HeroField label="Open" value={fmtPrice(sym.openPrice)} />
          <HeroField label="High" value={fmtPrice(sym.high)} tone="text-up" />
          <HeroField label="Low" value={fmtPrice(sym.low)} tone="text-down" />
          <HeroField label="Prev Close" value={fmtPrice(sym.prevClose)} />
          <HeroField label="Bid" value={fmtPrice(sym.bidPrice)} tone="text-up" />
          <HeroField label="Ask" value={fmtPrice(sym.offerPrice)} tone="text-down" />
          <HeroField label="Volume" value={fmtInt(sym.volume)} />
          <HeroField label="Value" value={fmtMoney(sym.value)} />
          <HeroField label="VWAP" value={fmtPrice(sym.vwap)} />
          <HeroField label="52W Hi" value={fmtPrice(sym.weekHigh52)} />
          <HeroField label="52W Lo" value={fmtPrice(sym.weekLow52)} />
          <HeroField label="P/E" value={sym.per.toFixed(2)} />
          <HeroField label="Mkt Cap" value={fmtMoney(sym.marketCap)} />
          <HeroField label="Sector" value={sym.sector} />
        </div>

        {/* Candles + volume */}
        <div className="rounded-lg border border-border-dark bg-[#15171a] p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-content-muted">Price · last 45 sessions</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-content-subtle tabular-nums">{mode === 'Line' ? 'Close line' : 'OHLC daily'}</span>
              <SegmentedTabs tabs={CHART_MODES} value={mode} onChange={setMode} />
            </div>
          </div>
          <div ref={chartRef} style={{ minHeight: 260 }}>
            {chartW > 0 && (
              <>
                <CandleChart candles={candles} mode={mode} tick={tick} width={chartW} />
                <VolumeChart candles={candles} width={chartW} />
              </>
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}

// ── Order Book ───────────────────────────────────────────────────────────
function OrderBookPanel({ short, tick }: { short: string; tick: number }) {
  const maxSize = Math.max(...MARKET_DEPTH_FULL.flatMap((l) => [l.bidSize, l.offerSize])) || 1

  // Cumulative depth area chart, mirrored around mid.
  const w = 280
  const h = 60
  const half = w / 2
  let cumB = 0
  let cumO = 0
  const totBid = MARKET_DEPTH_FULL.reduce((s, l) => s + l.bidSize, 0)
  const totOff = MARKET_DEPTH_FULL.reduce((s, l) => s + l.offerSize, 0)
  const totMax = Math.max(totBid, totOff) || 1
  const bidPts = MARKET_DEPTH_FULL.map((l, i) => {
    cumB += l.bidSize
    const x = half - (i / (MARKET_DEPTH_FULL.length - 1)) * half
    const y = h - (cumB / totMax) * (h - 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const offPts = MARKET_DEPTH_FULL.map((l, i) => {
    cumO += l.offerSize
    const x = half + (i / (MARKET_DEPTH_FULL.length - 1)) * half
    const y = h - (cumO / totMax) * (h - 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <Panel title={`Order Book — ${short}`} noPadding>
      <div className="flex h-full flex-col">
        <div className="grid grid-cols-4 gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wide text-content-muted">
          <span className="text-right">Bid Size</span>
          <span className="text-right">Bid</span>
          <span className="text-left">Ask</span>
          <span className="text-left">Ask Size</span>
        </div>
        <ul className="flex-1">
          {MARKET_DEPTH_FULL.map((l, i) => (
            <li key={i} className="grid grid-cols-4 items-center gap-1 px-3 py-[3px] text-[11px] tabular-nums">
              <div className="relative text-right">
                <span className="absolute inset-y-0 right-0 rounded-sm bg-bid-surface" style={{ width: `${(l.bidSize / maxSize) * 100}%` }} />
                <span className="relative text-content">{fmtInt(l.bidSize)}</span>
              </div>
              <span className="text-right font-medium text-up">{live(l.bidPrice, tick, seedOf(short) + i, 0.0006).toFixed(2)}</span>
              <span className="text-left font-medium text-down">{live(l.offerPrice, tick, seedOf(short) + i + 50, 0.0006).toFixed(2)}</span>
              <div className="relative text-left">
                <span className="absolute inset-y-0 left-0 rounded-sm bg-offer-surface" style={{ width: `${(l.offerSize / maxSize) * 100}%` }} />
                <span className="relative text-content">{fmtInt(l.offerSize)}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-border-dark p-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] text-content-muted">
            <span className="text-up">Cumulative Bids</span>
            <span>Depth</span>
            <span className="text-down">Cumulative Offers</span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none">
            <polygon points={`${half},${h} ${bidPts.join(' ')} ${bidPts[bidPts.length - 1].split(',')[0]},${h}`} fill={UP} fillOpacity={0.18} />
            <polyline points={bidPts.join(' ')} fill="none" stroke={UP} strokeWidth={1.5} />
            <polygon points={`${half},${h} ${offPts.join(' ')} ${offPts[offPts.length - 1].split(',')[0]},${h}`} fill={DOWN} fillOpacity={0.18} />
            <polyline points={offPts.join(' ')} fill="none" stroke={DOWN} strokeWidth={1.5} />
            <line x1={half} x2={half} y1={0} y2={h} stroke={GRID} strokeWidth={1} strokeDasharray="2 2" />
          </svg>
        </div>
      </div>
    </Panel>
  )
}

// ── Market Breadth ───────────────────────────────────────────────────────
function BreadthPanel({ tick, symbols }: { tick: number; symbols: Symbol[] }) {
  const adv = symbols.filter((s) => s.changePct > 0)
  const dec = symbols.filter((s) => s.changePct < 0)
  const unch = symbols.filter((s) => s.changePct === 0)
  const total = symbols.length || 1
  const upVol = adv.reduce((s, x) => s + x.volume, 0)
  const downVol = dec.reduce((s, x) => s + x.volume, 0)
  const volMax = Math.max(upVol, downVol) || 1

  // Subtle deterministic ±1 wobble (one ticker flips adv↔dec each beat).
  const jitter = Math.round(Math.sin(tick * 0.7))
  const advN = Math.max(0, Math.min(total, adv.length + jitter))
  const decN = Math.max(0, Math.min(total, dec.length - jitter))

  // Donut
  const R = 26
  const C = 2 * Math.PI * R
  const advFrac = advN / (advN + decN || 1)
  const advLen = C * advFrac

  return (
    <Panel title="Market Breadth">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90">
            <circle cx="32" cy="32" r={R} fill="none" stroke={DOWN} strokeWidth="8" />
            <circle cx="32" cy="32" r={R} fill="none" stroke={UP} strokeWidth="8" strokeDasharray={`${advLen} ${C}`} strokeLinecap="butt" />
          </svg>
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-[11px]">
              <span className="text-up">▲ {advN} Adv</span>
              <span className="text-content-muted">— {unch.length} Unch</span>
              <span className="text-down">▼ {decN} Dec</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-[#15171a]">
              <div className="bg-up" style={{ width: `${(advN / total) * 100}%` }} />
              <div className="bg-flat opacity-50" style={{ width: `${(unch.length / total) * 100}%` }} />
              <div className="bg-down" style={{ width: `${(decN / total) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            <span className="w-16 text-content-muted">Up Vol</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#15171a]">
              <div className="h-full rounded-full bg-up" style={{ width: `${(upVol / volMax) * 100}%` }} />
            </div>
            <span className="w-24 text-right text-up">{fmtInt(upVol)}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            <span className="w-16 text-content-muted">Down Vol</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#15171a]">
              <div className="h-full rounded-full bg-down" style={{ width: `${(downVol / volMax) * 100}%` }} />
            </div>
            <span className="w-24 text-right text-down">{fmtInt(downVol)}</span>
          </div>
        </div>
      </div>
    </Panel>
  )
}

// ── Sector Performance ─────────────────────────────────────────────────────
function SectorPanel({ symbols }: { symbols: Symbol[] }) {
  const map = new Map<string, { sum: number; n: number }>()
  for (const s of symbols) {
    const e = map.get(s.sector) ?? { sum: 0, n: 0 }
    e.sum += s.changePct
    e.n += 1
    map.set(s.sector, e)
  }
  const rows = [...map.entries()]
    .map(([sector, { sum, n }]) => ({ sector, avg: sum / n }))
    .sort((a, b) => b.avg - a.avg)
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.avg)), 0.1)

  // Tile background tinted green→red by avg change%.
  const tileBg = (avg: number) => {
    const t = Math.min(1, Math.abs(avg) / maxAbs)
    const alpha = (0.1 + t * 0.42).toFixed(2)
    return avg >= 0 ? `rgba(47,208,122,${alpha})` : `rgba(255,107,114,${alpha})`
  }

  return (
    <Panel title="Sector Performance" bodyClassName="overflow-y-auto">
      {/* Heatmap grid */}
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {rows.map((r) => (
          <div
            key={r.sector}
            className="flex flex-col justify-between rounded-md px-2 py-1.5"
            style={{ backgroundColor: tileBg(r.avg) }}
            title={r.sector}
          >
            <span className="truncate text-[10px] font-medium text-content">{r.sector}</span>
            <span className={`text-[11px] font-semibold tabular-nums ${r.avg >= 0 ? 'text-up' : 'text-down'}`}>{fmt2(r.avg)}</span>
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const pos = r.avg >= 0
          const widthPct = (Math.abs(r.avg) / maxAbs) * 50
          return (
            <li key={r.sector} className="flex items-center gap-2 text-[11px]">
              <span className="w-20 shrink-0 truncate text-content-muted" title={r.sector}>{r.sector}</span>
              <div className="relative flex h-3.5 flex-1 items-center">
                <span className="absolute inset-y-0 left-1/2 w-px bg-border-dark" />
                {pos ? (
                  <span className="absolute left-1/2 h-2.5 rounded-r-sm bg-up" style={{ width: `${widthPct}%` }} />
                ) : (
                  <span className="absolute right-1/2 h-2.5 rounded-l-sm bg-down" style={{ width: `${widthPct}%` }} />
                )}
              </div>
              <span className={`w-12 shrink-0 text-right tabular-nums ${pos ? 'text-up' : 'text-down'}`}>{fmt2(r.avg)}</span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

// ── Movers ─────────────────────────────────────────────────────────────────
function MoversPanel({ onSelect, onTrade, symbols }: { onSelect: (s: Symbol) => void; onTrade: (symbol: Symbol, side: 'buy' | 'sell') => void; symbols: Symbol[] }) {
  const active = useLiveSymbols(symbols).filter((s) => s.lastPrice > 0)
  const gainers = [...active].sort((a, b) => b.changePct - a.changePct).slice(0, 6)
  const losers = [...active].sort((a, b) => a.changePct - b.changePct).slice(0, 6)
  const maxG = Math.max(...gainers.map((s) => s.changePct), 0.1)
  const maxL = Math.max(...losers.map((s) => Math.abs(s.changePct)), 0.1)

  const Row = ({ s, up, max }: { s: Symbol; up: boolean; max: number }) => (
    <li
      onClick={() => onSelect(s)}
      className="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-0.5 text-[11px] tabular-nums hover:bg-[rgba(255,255,255,0.04)]"
    >
      <span className="w-16 shrink-0 truncate font-medium text-content">{s.symbolShortName}</span>
      <RowSparkline short={s.symbolShortName} w={42} h={14} />
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#15171a] group-hover:hidden">
        <div className={`h-full rounded-full ${up ? 'bg-up' : 'bg-down'}`} style={{ width: `${(Math.abs(s.changePct) / max) * 100}%` }} />
      </div>
      <div className="hidden flex-1 items-center justify-end gap-1 group-hover:flex">
        <Button size="sm" variant="buy" className="h-5 px-1.5 text-[10px]" onClick={(e) => { e.stopPropagation(); onTrade(s, 'buy') }}>Buy</Button>
        <Button size="sm" variant="sell" className="h-5 px-1.5 text-[10px]" onClick={(e) => { e.stopPropagation(); onTrade(s, 'sell') }}>Sell</Button>
      </div>
      <span className={`w-12 shrink-0 text-right ${up ? 'text-up' : 'text-down'}`}>{fmtPct(s.changePct)}</span>
    </li>
  )

  return (
    <Panel title="Movers">
      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-up">Top Gainers</div>
          <ul className="flex flex-col gap-1">
            {gainers.map((s) => <Row key={s.id} s={s} up max={maxG} />)}
          </ul>
        </div>
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-down">Top Losers</div>
          <ul className="flex flex-col gap-1">
            {losers.map((s) => <Row key={s.id} s={s} up={false} max={maxL} />)}
          </ul>
        </div>
      </div>
    </Panel>
  )
}

// ── Most Active ──────────────────────────────────────────────────────────
function MostActivePanel({ onSelect, onTrade, symbols }: { onSelect: (s: Symbol) => void; onTrade: (symbol: Symbol, side: 'buy' | 'sell') => void; symbols: Symbol[] }) {
  const price = usePrices()
  const rows = [...symbols].filter((s) => s.volume > 0).sort((a, b) => b.volume - a.volume).slice(0, 10)
  return (
    <Panel title="Most Active" bodyClassName="overflow-y-auto" noPadding>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-content-muted">
            <th className="px-4 py-1.5 text-left font-medium">Symbol</th>
            <th className="px-2 py-1.5 text-left font-medium">Name</th>
            <th className="px-2 py-1.5 text-center font-medium">Trend</th>
            <th className="px-2 py-1.5 text-right font-medium">Last</th>
            <th className="px-2 py-1.5 text-right font-medium">Chg%</th>
            <th className="px-4 py-1.5 text-right font-medium">Volume</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-dark">
          {rows.map((s) => {
            const q = price(s.symbolShortName)
            const last = q?.last ?? s.lastPrice
            const pct = q?.changePct ?? s.changePct
            const tone = pct > 0 ? 'text-up' : pct < 0 ? 'text-down' : 'text-flat'
            return (
              <tr
                key={s.id}
                onClick={() => onSelect(s)}
                className="group cursor-pointer hover:bg-[rgba(255,255,255,0.03)]"
              >
                <td className="px-4 py-1.5 font-medium text-content">{s.symbolShortName}</td>
                <td className="relative max-w-0 truncate px-2 py-1.5 text-content-muted">
                  <span className="group-hover:invisible">{s.symbolName}</span>
                  <span className="invisible absolute inset-y-0 left-2 flex items-center gap-1 group-hover:visible">
                    <Button size="sm" variant="buy" className="h-5 px-1.5 text-[10px]" onClick={(e) => { e.stopPropagation(); onTrade(s, 'buy') }}>Buy</Button>
                    <Button size="sm" variant="sell" className="h-5 px-1.5 text-[10px]" onClick={(e) => { e.stopPropagation(); onTrade(s, 'sell') }}>Sell</Button>
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center"><span className="inline-flex justify-center"><RowSparkline short={s.symbolShortName} /></span></td>
                <td className="px-2 py-1.5 text-right tabular-nums text-content">{fmtPrice(last)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${tone}`}>{fmtPct(pct)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums text-content-muted">{fmtInt(s.volume)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}

// ── News ─────────────────────────────────────────────────────────────────
export interface NewsItem {
  id: string
  time: string
  headline: string
  source: string
  category: string
  sentiment: 'up' | 'down' | 'neutral'
  /** Related tickers (symbolShortName) — drives the "Related to <symbol>" feed. */
  symbols: string[]
  summary: string
  body: string[]
}

const NEWS: NewsItem[] = [
  {
    id: 'n1', time: '10:42', source: 'Reuters', category: 'Markets', sentiment: 'up',
    symbols: ['EMAAR', 'EMAARDEV', 'DAMAC', 'DEYAAR'],
    headline: 'DFM extends gains led by real estate',
    summary: 'Dubai’s benchmark index climbed for a third session as property developers rallied on strong off-plan sales momentum.',
    body: [
      'The DFM General Index rose 0.4% in morning trade, on course for its longest winning streak in six weeks, with real-estate names accounting for the bulk of the advance.',
      'Turnover was concentrated in blue-chip developers, where foreign institutional buying picked up after upbeat off-plan sales data for the quarter.',
      'Analysts pointed to resilient population growth and a firm rental market as continuing tailwinds for the sector into the second half.',
    ],
  },
  {
    id: 'n2', time: '10:31', source: 'Bloomberg', category: 'Earnings', sentiment: 'up',
    symbols: ['EMAAR'],
    headline: 'Emaar Q4 profit beats estimates',
    summary: 'Emaar Properties reported quarterly net income ahead of consensus, driven by record property handovers and recurring mall revenue.',
    body: [
      'Emaar Properties posted a forecast-beating quarterly profit, as a surge in completed unit handovers and resilient footfall across its retail assets lifted the top line.',
      'Management flagged a healthy development backlog and reiterated full-year revenue guidance, adding that recurring income from malls and hospitality continued to grow double digits.',
      'The board is expected to recommend a dividend broadly in line with the prior-year distribution, subject to shareholder approval.',
    ],
  },
  {
    id: 'n3', time: '10:24', source: 'Zawya', category: 'Dividends', sentiment: 'up',
    symbols: ['EMAAR', 'EMAARDEV'],
    headline: 'Emaar board proposes higher cash dividend',
    summary: 'Directors recommended an increased payout after a record year for property sales, pending approval at the annual general meeting.',
    body: [
      'Emaar’s board proposed a higher cash dividend for the year, rewarding shareholders after record residential sales and a strong recurring-income performance.',
      'Emaar Development, the group’s UAE build-to-sell unit, is expected to contribute a substantial share of the distributable profit on the back of accelerated handovers.',
      'The proposal is subject to shareholder approval at the upcoming annual general meeting.',
    ],
  },
  {
    id: 'n4', time: '10:18', source: 'The National', category: 'Dividends', sentiment: 'up',
    symbols: ['ADNOCDRILL'],
    headline: 'ADNOC Drilling declares dividend',
    summary: 'The driller confirmed its progressive dividend policy as fleet expansion lifts contracted day-rates.',
    body: [
      'ADNOC Drilling reaffirmed its progressive dividend policy, pointing to a growing rig fleet and higher contracted day-rates across its onshore and offshore operations.',
      'The company continues to expand into unconventional and geothermal services as part of its diversification strategy.',
    ],
  },
  {
    id: 'n5', time: '09:57', source: 'Reuters', category: 'Banking', sentiment: 'up',
    symbols: ['EMIRATESNBD', 'DIB', 'CBD'],
    headline: 'UAE banks rally on rate outlook',
    summary: 'Lenders advanced as investors positioned for a softer rate path and resilient regional loan growth.',
    body: [
      'UAE banking stocks climbed as investors positioned for a gentler interest-rate path while regional loan growth stayed resilient.',
      'Net interest margins are expected to hold up better than feared, with fee income and buoyant capital-markets activity cushioning the outlook.',
    ],
  },
  {
    id: 'n6', time: '09:44', source: 'Mubasher', category: 'Infrastructure', sentiment: 'up',
    symbols: ['SALIK'],
    headline: 'Salik volumes surge as traffic scheme expands',
    summary: 'Toll-gate revenue is tracking ahead of guidance after new gates came online across Dubai.',
    body: [
      'Salik reported a jump in chargeable trips after new toll gates were activated, pushing revenue ahead of the company’s own guidance.',
      'Management highlighted dynamic pricing pilots and a broadening network as structural growth drivers.',
    ],
  },
  {
    id: 'n7', time: '09:30', source: 'Bloomberg', category: 'IPO', sentiment: 'neutral',
    symbols: [],
    headline: 'ADX IPO pipeline broadens into industrials',
    summary: 'Abu Dhabi’s listing pipeline is widening beyond energy and financials into industrial names.',
    body: [
      'Abu Dhabi’s exchange said its listing pipeline is broadening into industrial and consumer names, beyond the energy and financial issuers that dominated recent years.',
      'Bankers expect a steady cadence of mid-cap offerings to deepen secondary-market liquidity.',
    ],
  },
  {
    id: 'n8', time: '09:12', source: 'Zawya', category: 'Contracts', sentiment: 'up',
    symbols: ['TABREED'],
    headline: 'Tabreed wins KSA district-cooling concession',
    summary: 'The award extends the utility’s connected-capacity pipeline across the Gulf.',
    body: [
      'National Central Cooling Company (Tabreed) secured a new district-cooling concession in Saudi Arabia, extending its connected-capacity pipeline across the Gulf.',
      'The long-term concession adds contracted, inflation-linked cash flows to the utility’s base.',
    ],
  },
  {
    id: 'n9', time: '08:55', source: 'The National', category: 'Markets', sentiment: 'up',
    symbols: [],
    headline: 'Foreign inflows lift Nasdaq Dubai to fresh high',
    summary: 'Sustained foreign participation pushed the index to a record as liquidity improved.',
    body: [
      'Nasdaq Dubai touched a fresh high as sustained foreign inflows and improving liquidity supported valuations across large-cap names.',
      'Strategists cited index-inclusion flows and a stable dirham peg as supportive factors.',
    ],
  },
  {
    id: 'n10', time: '10:05', source: 'Mubasher', category: 'Consumer', sentiment: 'down',
    symbols: ['TALABAT'],
    headline: 'Talabat eases as competition weighs on margins',
    summary: 'The food-delivery operator slipped on margin concerns amid intensifying regional competition.',
    body: [
      'Talabat shares eased as investors weighed margin pressure from heavier promotional spending and intensifying competition across its core delivery markets.',
      'Management reiterated that order frequency and subscription uptake remain healthy, and pointed to logistics efficiencies expected to support profitability into next year.',
    ],
  },
  {
    id: 'n11', time: '09:20', source: 'Bloomberg', category: 'Banking', sentiment: 'up',
    symbols: ['FAB'],
    headline: 'First Abu Dhabi Bank posts record quarterly income',
    summary: 'FAB reported a record quarter on strong loan growth and investment-banking fees.',
    body: [
      'First Abu Dhabi Bank, the UAE’s largest lender, posted record quarterly income, helped by robust corporate loan growth and a rebound in investment-banking fees.',
      'The bank flagged a resilient net-interest margin and strong capital ratios, leaving room for continued shareholder distributions.',
    ],
  },
]

/** Small coloured dot conveying a story's market sentiment. */
function SentimentDot({ s }: { s: NewsItem['sentiment'] }) {
  const c = s === 'up' ? 'bg-up' : s === 'down' ? 'bg-down' : 'bg-flat'
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c}`} aria-hidden />
}

/** One clickable headline row in the News feed. */
function NewsRow({ item, onOpen }: { item: NewsItem; onOpen: (i: NewsItem) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="group flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(0,98,255,0.08)]"
      >
        <SentimentDot s={item.sentiment} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] text-content-subtle">
            <span className="tabular-nums">{item.time}</span>
            <span className="text-border-dark">·</span>
            <span className="font-medium text-content-muted">{item.source}</span>
            <span className="ml-auto rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-content-muted">
              {item.category}
            </span>
          </div>
          <div className="text-[12.5px] font-medium leading-snug text-content transition-colors group-hover:text-white">
            {item.headline}
          </div>
          {item.symbols.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.symbols.slice(0, 4).map((sym) => (
                <span key={sym} className="rounded bg-[rgba(0,98,255,0.12)] px-1.5 py-px text-[10px] font-medium text-[#5b9bff]">
                  {sym}
                </span>
              ))}
            </div>
          )}
        </div>
        <svg
          className="mt-0.5 shrink-0 text-content-subtle opacity-0 transition-opacity group-hover:opacity-100"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </li>
  )
}

/** Small uppercase section divider inside the News feed. */
function NewsSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border-dark bg-surface/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-content-subtle backdrop-blur">
      {children}
    </div>
  )
}

const NEWS_FILTERS = ['Related', 'All'] as const
type NewsFilter = (typeof NEWS_FILTERS)[number]

function NewsPanel({ selected, onOpen }: { selected: Symbol; onOpen: (i: NewsItem) => void }) {
  // Related = only stories tagged with the selected symbol first; All = every
  // headline regardless of what's selected. Toggle in the panel header.
  const [filter, setFilter] = useState<NewsFilter>('Related')
  const related = NEWS.filter((n) => n.symbols.includes(selected.symbolShortName))
  return (
    <Panel
      title="News"
      // Right padding keeps the toggle clear of the panel's hover drag / pop-out controls.
      actions={<div className="pr-14"><SegmentedTabs tabs={NEWS_FILTERS} value={filter} onChange={setFilter} /></div>}
      bodyClassName="overflow-y-auto"
      noPadding
    >
      {filter === 'All' ? (
        <>
          <NewsSectionLabel>
            All headlines
            <span className="ml-auto font-normal normal-case text-content-subtle">{NEWS.length} stories</span>
          </NewsSectionLabel>
          <ul className="divide-y divide-border-dark">
            {NEWS.map((n) => <NewsRow key={n.id} item={n} onOpen={onOpen} />)}
          </ul>
        </>
      ) : related.length > 0 ? (
        <>
          <NewsSectionLabel>
            <span className="h-1.5 w-1.5 rounded-full bg-action" />
            Related to {selected.symbolShortName}
            <span className="ml-auto font-normal normal-case text-content-subtle">{related.length} stories</span>
          </NewsSectionLabel>
          <ul className="divide-y divide-border-dark">
            {related.map((n) => <NewsRow key={n.id} item={n} onOpen={onOpen} />)}
          </ul>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
          <div className="text-[12px] text-content-muted">No stories for {selected.symbolShortName} right now.</div>
          <div className="text-[11px] text-content-subtle">Switch to <span className="font-medium text-content-muted">All</span> to see every headline.</div>
        </div>
      )}
    </Panel>
  )
}

/** Right-side slide-over showing the full story + related symbols. */
function NewsDrawer({
  item,
  onClose,
  onSelectSymbol,
}: {
  item: NewsItem | null
  onClose: () => void
  onSelectSymbol?: (s: Symbol) => void
}) {
  const sentimentTone = item?.sentiment === 'up' ? 'up' : item?.sentiment === 'down' ? 'down' : 'neutral'
  const sentimentLabel = item?.sentiment === 'up' ? '▲ Positive' : item?.sentiment === 'down' ? '▼ Negative' : '— Neutral'
  const related = item ? item.symbols.map(bySymbol).filter((s): s is Symbol => Boolean(s)) : []
  return (
    <Drawer open={!!item} onClose={onClose} title="Story" width="w-[460px]">
      {item && (
        <article className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{item.source}</Badge>
            <span className="rounded bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-content-muted">{item.category}</span>
            <Badge tone={sentimentTone}>{sentimentLabel}</Badge>
            <span className="ml-auto text-[11px] tabular-nums text-content-subtle">Today · {item.time}</span>
          </div>

          <h2 className="text-[19px] font-semibold leading-snug text-content">{item.headline}</h2>
          <p className="text-[13px] font-medium leading-relaxed text-content-muted">{item.summary}</p>

          <div className="h-px bg-border-dark" />

          <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-content-muted">
            {item.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          {related.length > 0 && (
            <div className="mt-1 flex flex-col gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-content-subtle">Related symbols</div>
              <ul className="flex flex-col gap-1.5">
                {related.map((s) => {
                  const tone = s.changePct > 0 ? 'text-up' : s.changePct < 0 ? 'text-down' : 'text-flat'
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => { onSelectSymbol?.(s); onClose() }}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-border-dark bg-[#15171a] px-3 py-2 text-left transition-colors hover:border-action/50 hover:bg-[rgba(0,98,255,0.08)]"
                      >
                        <span className="w-20 shrink-0 text-[12px] font-semibold text-content">{s.symbolShortName}</span>
                        <span className="flex-1 truncate text-[11px] text-content-muted" title={s.symbolName}>{s.symbolName}</span>
                        <span className="shrink-0 tabular-nums text-[12px] text-content">{fmtPrice(s.lastPrice)}</span>
                        <span className={`w-14 shrink-0 text-right tabular-nums text-[12px] ${tone}`}>{fmtPct(s.changePct)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </article>
      )}
    </Drawer>
  )
}

// ── Time & Sales ───────────────────────────────────────────────────────────
function TimeSalesPanel({ short }: { short: string }) {
  return (
    <Panel title={`Time & Sales — ${short}`} bodyClassName="overflow-y-auto" noPadding>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-content-muted">
            <th className="px-4 py-1.5 text-left font-medium">Time</th>
            <th className="px-2 py-1.5 text-right font-medium">Price</th>
            <th className="px-4 py-1.5 text-right font-medium">Size</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-dark">
          {TIME_SALES.map((t, i) => (
            <tr key={i} className="hover:bg-[rgba(255,255,255,0.03)]">
              <td className="px-4 py-[5px] tabular-nums text-content-muted">{t.time}</td>
              <td className={`px-2 py-[5px] text-right font-medium tabular-nums ${t.side === 'buy' ? 'text-up' : 'text-down'}`}>{fmtPrice(t.price)}</td>
              <td className="px-4 py-[5px] text-right tabular-nums text-content">{fmtInt(t.size)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

// ── Watchlist (from the MSN dashboard) ───────────────────────────────────────
function WatchlistPanel({ selected, onSelect, onTrade, symbols }: { selected: Symbol; onSelect: (s: Symbol) => void; onTrade: (symbol: Symbol, side: 'buy' | 'sell') => void; symbols: Symbol[] }) {
  const rows = useLiveSymbols(symbols)
  return (
    <Panel title="Watchlist" bodyClassName="overflow-y-auto" noPadding>
      <ul className="divide-y divide-border-dark">
        {rows.map((s) => {
          const tone = s.changePct > 0 ? 'text-up' : s.changePct < 0 ? 'text-down' : 'text-flat'
          const active = s.symbolShortName === selected.symbolShortName
          return (
            <li
              key={s.id}
              onClick={() => onSelect(s)}
              className={`group flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-[rgba(255,255,255,0.04)] ${active ? 'bg-[rgba(0,98,255,0.12)]' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-content">{s.symbolShortName}</div>
                <div className="truncate text-[10px] text-content-muted" title={s.symbolName}>{s.symbolName}</div>
              </div>
              <RowSparkline short={s.symbolShortName} w={44} h={16} />
              <div className="flex w-[72px] shrink-0 flex-col items-end group-hover:hidden">
                <span className="text-[12px] tabular-nums text-content">{fmtPrice(s.lastPrice)}</span>
                <span className={`text-[10px] tabular-nums ${tone}`}>{fmtPct(s.changePct)}</span>
              </div>
              <div className="hidden w-[72px] shrink-0 items-center justify-end gap-1 group-hover:flex">
                <Button size="sm" variant="buy" className="h-5 px-1.5 text-[10px]" onClick={(e) => { e.stopPropagation(); onTrade(s, 'buy') }}>Buy</Button>
                <Button size="sm" variant="sell" className="h-5 px-1.5 text-[10px]" onClick={(e) => { e.stopPropagation(); onTrade(s, 'sell') }}>Sell</Button>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

// ── Header — functional symbol picker ───────────────────────────────────────
function Header({
  selected,
  onSelect,
  resetLayout,
  canReset,
  market,
  symbols,
  hidden,
  onShow,
}: {
  selected: Symbol
  onSelect: (s: Symbol) => void
  resetLayout: () => void
  canReset: boolean
  market: MarketCode
  symbols: Symbol[]
  hidden: PanelId[]
  onShow: (id: PanelId) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const { status, quotes } = useLiveData()
  // DFM has a genuine Yahoo feed; ADX / Nasdaq are always simulated.
  const isLive = marketHasLiveFeed(market) && status === 'live' && quotes.size > 0

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? symbols.filter(
          (s) => s.symbolShortName.toLowerCase().includes(q) || s.symbolName.toLowerCase().includes(q),
        )
      : symbols
    return list.slice(0, 12)
  }, [query, symbols])

  const pick = (s: Symbol) => {
    onSelect(s)
    setQuery(s.symbolShortName)
    setOpen(false)
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-dark px-4">
      <h1 className="text-[15px] font-semibold text-content">Securities Terminal</h1>
      <div className="relative">
        <div className="flex h-8 items-center gap-2 rounded-full border border-border-dark bg-[#15171a] px-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={LABEL} strokeWidth="2" className="shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            id="terminal-symbol-search"
            type="text"
            value={query}
            placeholder="Search symbol… (SALIK, DIB, EIB)"
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur() }
              else if (e.key === 'Enter' && matches[0]) pick(matches[0])
            }}
            className="w-56 bg-transparent text-[12px] text-content placeholder:text-content-subtle outline-none"
          />
        </div>
        {open && matches.length > 0 && (
          <ul className="absolute left-0 top-full z-30 mt-1 max-h-72 w-80 overflow-auto rounded-lg border border-border-dark bg-surface shadow-xl">
            {matches.map((s) => {
              const tone = s.changePct > 0 ? 'text-up' : s.changePct < 0 ? 'text-down' : 'text-flat'
              return (
                <li
                  key={s.id}
                  onMouseDown={(e) => { e.preventDefault(); pick(s) }}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-[rgba(255,255,255,0.04)] ${
                    s.symbolShortName === selected.symbolShortName ? 'bg-[rgba(0,98,255,0.12)]' : ''
                  }`}
                >
                  <span className="w-20 shrink-0 font-medium text-content">{s.symbolShortName}</span>
                  <span className="flex-1 truncate text-content-muted" title={s.symbolName}>{s.symbolName}</span>
                  <span className="shrink-0 tabular-nums text-content">{fmtPrice(s.lastPrice)}</span>
                  <span className={`w-14 shrink-0 text-right tabular-nums ${tone}`}>{fmtPct(s.changePct)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <Badge tone="info" className="uppercase">{market}</Badge>
      <div className="ml-auto flex items-center gap-4 text-[12px]">
        <span className="hidden items-center gap-1 text-content-subtle lg:flex" title="Drag a panel's grip to rearrange · drag its right edge to resize (double-click for full width)">
          <span className="text-[13px] leading-none">⠿</span>
          Drag to rearrange · resize edges
        </span>
        {hidden.length > 0 && (
          <div className="relative">
            <Button variant="default" size="sm" onClick={() => setAddOpen((o) => !o)} onBlur={() => setTimeout(() => setAddOpen(false), 150)} title="Show a hidden panel">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Add panel
              <span className="rounded-full bg-action px-1.5 text-[10px] font-semibold text-white">{hidden.length}</span>
            </Button>
            {addOpen && (
              <div className="absolute right-0 top-9 z-50 w-52 rounded-lg border border-border-dark bg-surface py-1 shadow-2xl">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-content-subtle">Hidden panels</div>
                {hidden.map((id) => (
                  <button
                    key={id}
                    onMouseDown={(e) => { e.preventDefault(); onShow(id); setAddOpen(false) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-content hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-content-muted"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    {PANEL_TITLES[id]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={resetLayout} disabled={!canReset} title="Restore the default panel layout">
          Reset layout
        </Button>
        {isLive ? (
          <span className="flex items-center gap-1.5 text-up" title="Real-time DFM quotes via Yahoo Finance">
            <span className="inline-block h-2 w-2 rounded-full bg-up shadow-[0_0_6px_#2fd07a]" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-content-muted" title={marketHasLiveFeed(market) ? 'No live DFM feed reachable — showing simulated data' : `${MARKET_NAMES[market]} has no free live feed — data is simulated`}>
            <span className="inline-block h-2 w-2 rounded-full bg-white/40" />
            Simulated
          </span>
        )}
        <span className="font-medium text-content">{selected.symbolShortName}</span>
      </div>
    </header>
  )
}

// ── Ticker tape ──────────────────────────────────────────────────────────
function TickerTape({ tick }: { tick: number }) {
  return (
    <div className="shrink-0 overflow-x-auto whitespace-nowrap border-t border-border-dark bg-surface px-3 py-2">
      {TICKERS.map((t, i) => {
        // Live value oscillates; net change/pct recomputed from the same base so
        // the ▲/▼ glyph and colour stay in sync with the moving number.
        const liveVal = live(t.value, tick, seedOf(t.label))
        const base = t.value - t.netChange // implied previous close
        const liveNet = liveVal - base
        const livePct = base ? (liveNet / base) * 100 : 0
        const dir: 'up' | 'down' | 'flat' = liveNet > 0.0005 ? 'up' : liveNet < -0.0005 ? 'down' : 'flat'
        const tone = dir === 'up' ? 'text-up' : dir === 'down' ? 'text-down' : 'text-flat'
        return (
          <span key={t.label} className="inline-flex items-center gap-2 text-[12px]">
            {i > 0 && <span className="mx-3 text-content-subtle">·</span>}
            <span className="text-content-muted">{t.label}</span>
            <span className="font-medium tabular-nums text-content">{fmtPrice(liveVal)}</span>
            <span className={`tabular-nums ${tone}`}>
              {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—'} {fmtChange(liveNet)} ({fmtPct(livePct)})
            </span>
          </span>
        )
      })}
    </div>
  )
}

// ── Layout engine (react-grid-layout) ────────────────────────────────────────
// Panels are positioned on an explicit x/y grid. The broker can freely drag any
// panel to any position and resize it from any edge — no automatic reshuffling.

type PanelId =
  | 'indices' | 'hero' | 'orderbook' | 'breadth' | 'sector'
  | 'movers' | 'watchlist' | 'mostactive' | 'news' | 'timesales'

interface PanelDef {
  id: PanelId
  render: () => ReactNode
}

const LAYOUT_KEY = 'fab-terminal-layout-v6'
const GRID_COLS = 12
const GRID_ROW_H = 80

const ALL_PANEL_IDS: PanelId[] = [
  'indices', 'hero', 'orderbook', 'breadth', 'sector',
  'movers', 'watchlist', 'mostactive', 'news', 'timesales',
]

// Default layout:
//   Row 0 (y=0):  Indices(3) · Hero(6) · Orderbook(3)
//   Col 0 (y=3):  Sector(3) fills blank space below Indices (which is only 3 rows)
//   Row 1 (y=8):  Breadth(6) · Movers(6)
//   Row 2 (y=12): Watchlist(3) · MostActive(6) · News(3)
//   Row 3 (y=18): Time & Sales(12)
const DEFAULT_GRID_LAYOUT: RGLLayoutItem[] = [
  { i: 'indices',    x: 0,  y: 0,  w: 3,  h: 3,  minW: 2, minH: 2 },
  { i: 'hero',       x: 3,  y: 0,  w: 6,  h: 8,  minW: 2, minH: 2 },
  { i: 'orderbook',  x: 9,  y: 0,  w: 3,  h: 6,  minW: 2, minH: 2 },
  { i: 'sector',     x: 0,  y: 3,  w: 3,  h: 5,  minW: 2, minH: 2 },
  { i: 'breadth',    x: 0,  y: 8,  w: 6,  h: 4,  minW: 2, minH: 2 },
  { i: 'movers',     x: 6,  y: 8,  w: 6,  h: 4,  minW: 2, minH: 2 },
  { i: 'watchlist',  x: 0,  y: 12, w: 3,  h: 5,  minW: 2, minH: 2 },
  { i: 'mostactive', x: 3,  y: 12, w: 6,  h: 6,  minW: 2, minH: 2 },
  { i: 'news',       x: 9,  y: 12, w: 3,  h: 5,  minW: 2, minH: 2 },
  { i: 'timesales',  x: 0,  y: 18, w: 12, h: 3,  minW: 2, minH: 2 },
]

function loadGridLayout(): RGLLayoutItem[] {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return DEFAULT_GRID_LAYOUT
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_GRID_LAYOUT
    return parsed as RGLLayoutItem[]
  } catch {
    return DEFAULT_GRID_LAYOUT
  }
}

const TerminalGrid = WidthProvider(RGL)

// ── Panel card wrapper ────────────────────────────────────────────────────────
// Thin wrapper providing the drag handle strip and panel controls (hide, send to
// board). react-grid-layout owns all drag + resize; this only renders the chrome.
function PanelCard({
  id,
  onTearOut,
  onHide,
  highlight,
  children,
}: {
  id: PanelId
  onTearOut?: (id: PanelId) => void
  onHide?: (id: PanelId) => void
  highlight?: boolean
  children: ReactNode
}) {
  return (
    <div
      data-panel-id={id}
      className={`group relative isolate h-full w-full [&>section]:h-full ${
        highlight ? 'rounded-xl ring-2 ring-action shadow-[0_0_0_4px_rgba(0,98,255,0.25)]' : ''
      }`}
    >
      {/* Drag handle — RGL intercepts pointer events on this class. */}
      <div className="fab-panel-handle absolute left-0 right-14 top-0 z-10 h-11 cursor-move touch-none" title="Drag to move" />
      {/* Hide + send-to-board buttons. */}
      <div className="absolute right-1.5 top-0 z-30 flex h-11 items-center">
        <div className="flex items-center gap-0.5 rounded-md border border-border-dark bg-[#1a1c1e] px-0.5 py-0.5 shadow-sm">
          <button
            type="button"
            aria-label="Hide panel"
            title="Hide this panel"
            onClick={() => onHide?.(id)}
            className="flex h-6 w-6 items-center justify-center rounded text-content-muted transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-content"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /><path d="M6.61 6.61A13.5 13.5 0 0 0 1 12s4 8 11 8a9.7 9.7 0 0 0 5.39-1.61" /></svg>
          </button>
          <button
            type="button"
            aria-label="Send panel to the Workspace board"
            title="Send to the Workspace board"
            onClick={() => onTearOut?.(id)}
            className="flex h-6 w-6 items-center justify-center rounded text-content-muted transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-content"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Function-key hotkeys ─────────────────────────────────────────────────────
// F1–F10 drive the terminal the way a Bloomberg-style desk would. `panel` keys
// scroll the matching card into view and flash it; the rest fire an action.
type HotkeyAction =
  | { kind: 'help' }
  | { kind: 'buy' }
  | { kind: 'sell' }
  | { kind: 'search' }
  | { kind: 'reset' }
  | { kind: 'broker' }
  | { kind: 'broker-ai' }
  | { kind: 'panel'; panel: PanelId }

const HOTKEYS: { key: string; label: string; hint: string; action: HotkeyAction }[] = [
  { key: 'F1', label: 'Help', hint: 'Show / hide this shortcuts panel', action: { kind: 'help' } },
  { key: 'F2', label: 'Buy', hint: 'Open a buy ticket for the selected symbol', action: { kind: 'buy' } },
  { key: 'F3', label: 'Sell', hint: 'Open a sell ticket for the selected symbol', action: { kind: 'sell' } },
  { key: 'F4', label: 'Search', hint: 'Jump to the symbol search box', action: { kind: 'search' } },
  { key: 'F5', label: 'Order Placement', hint: 'Open Order Placement as its own window', action: { kind: 'broker' } },
  { key: '⇧F5', label: 'Order · AI', hint: 'Open AI-assisted Order Placement as its own window', action: { kind: 'broker-ai' } },
  { key: 'F6', label: 'Movers', hint: 'Jump to the Top Movers panel', action: { kind: 'panel', panel: 'movers' } },
  { key: 'F7', label: 'Order Book', hint: 'Jump to the Order Book panel', action: { kind: 'panel', panel: 'orderbook' } },
  { key: 'F8', label: 'News', hint: 'Jump to the News panel', action: { kind: 'panel', panel: 'news' } },
  { key: 'F9', label: 'Time & Sales', hint: 'Jump to the Time & Sales panel', action: { kind: 'panel', panel: 'timesales' } },
  { key: 'F10', label: 'Reset', hint: 'Restore the default panel layout', action: { kind: 'reset' } },
]

/** Always-visible legend strip above the ticker tape. */
function HotkeyBar({ onTrigger }: { onTrigger: (a: HotkeyAction) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap border-t border-border-dark bg-[#15171a] px-3 py-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-content-subtle">Shortcuts</span>
      {HOTKEYS.map((h) => (
        <button
          key={h.key}
          type="button"
          title={h.hint}
          onClick={() => onTrigger(h.action)}
          className="flex items-center gap-1.5 rounded border border-border-dark bg-[#1a1c1e] px-1.5 py-0.5 text-[11px] text-content-muted transition-colors hover:border-action/60 hover:text-content"
        >
          <kbd className="rounded bg-[#0b0c0d] px-1 py-px font-mono text-[10px] font-semibold text-action">{h.key}</kbd>
          {h.label}
        </button>
      ))}
    </div>
  )
}

/** Centered overlay opened by F1. */
function HotkeyHelp({ open, onClose, onTrigger }: { open: boolean; onClose: () => void; onTrigger: (a: HotkeyAction) => void }) {
  if (!open) return null
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[460px] max-w-[90%] rounded-2xl border border-border-dark bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-content">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-content-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-content" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {HOTKEYS.map((h) => (
            <li key={h.key}>
              <button
                type="button"
                onClick={() => onTrigger(h.action)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-[rgba(255,255,255,0.05)]"
              >
                <kbd className="w-10 shrink-0 rounded bg-[#0b0c0d] py-0.5 text-center font-mono text-[11px] font-semibold text-action">{h.key}</kbd>
                <span className="w-24 shrink-0 text-[12px] font-medium text-content">{h.label}</span>
                <span className="flex-1 text-[12px] text-content-muted">{h.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-content-subtle">Press <kbd className="rounded bg-[#0b0c0d] px-1 font-mono text-action">F1</kbd> or <kbd className="rounded bg-[#0b0c0d] px-1 font-mono text-action">Esc</kbd> to close.</p>
      </div>
    </div>
  )
}

// ── Pop-out (tear-off) panels ────────────────────────────────────────────────
export const PANEL_TITLES: Record<PanelId, string> = {
  indices: 'Indices', hero: 'Quote', orderbook: 'Order Book', breadth: 'Breadth',
  sector: 'Sectors', movers: 'Top Movers', watchlist: 'Watchlist',
  mostactive: 'Most Active', news: 'News', timesales: 'Time & Sales',
}

/**
 * Renders ONE Graph panel with its own live tick, local selected symbol and
 * order ticket, filling its parent container. Shared by the full-window
 * `DetachedPanel` and by the Workspace board (a card in the grid).
 */
export function GraphPanelBody({ id, market = 'DFM' }: { id: string; market?: MarketCode }) {
  const tick = useLiveTick()
  const [selected, setSelected] = useState<Symbol>(() => defaultSymbolFor(market))
  // The detached window has no parent terminal to host the order ticket, so it
  // carries its own — this makes Buy/Sell work on another monitor.
  const [trade, setTrade] = useState<{ open: boolean; side: 'buy' | 'sell'; symbol: Symbol | null }>({ open: false, side: 'buy', symbol: null })
  const onTrade = (symbol: Symbol, side: 'buy' | 'sell') => setTrade({ open: true, side, symbol })
  const [newsItem, setNewsItem] = useState<NewsItem | null>(null)

  const symbols = useMemo(() => symbolsForMarket(market), [market])
  const indices = useMemo(() => indicesForMarket(market), [market])
  const watchRows = useMemo(() => watchlistForMarket(market), [market])

  const body = (): ReactNode => {
    switch (id as PanelId) {
      case 'indices': return <IndicesPanel tick={tick} indices={indices} />
      case 'hero': return <HeroPanel sym={selected} onTrade={onTrade} tick={tick} />
      case 'orderbook': return <OrderBookPanel short={selected.symbolShortName} tick={tick} />
      case 'breadth': return <BreadthPanel tick={tick} symbols={symbols} />
      case 'sector': return <SectorPanel symbols={symbols} />
      case 'movers': return <MoversPanel onSelect={setSelected} onTrade={onTrade} symbols={symbols} />
      case 'watchlist': return <WatchlistPanel selected={selected} onSelect={setSelected} onTrade={onTrade} symbols={watchRows} />
      case 'mostactive': return <MostActivePanel onSelect={setSelected} onTrade={onTrade} symbols={symbols} />
      case 'news': return <NewsPanel selected={selected} onOpen={setNewsItem} />
      case 'timesales': return <TimeSalesPanel short={selected.symbolShortName} />
      default: return <div className="p-6 text-content">Unknown panel: {id}</div>
    }
  }

  return (
    <div className="h-full w-full overflow-auto bg-page p-3 [&>section]:h-full">
      {body()}
      <BuySellDrawer
        open={trade.open}
        side={trade.side}
        symbol={trade.symbol}
        onSideChange={(side) => setTrade((t) => ({ ...t, side }))}
        onClose={() => setTrade((t) => ({ ...t, open: false }))}
      />
      <NewsDrawer item={newsItem} onClose={() => setNewsItem(null)} onSelectSymbol={setSelected} />
    </div>
  )
}

/**
 * Renders ONE Graph panel filling its own window (the target of `/?detach=<id>`).
 * Thin wrapper around {@link GraphPanelBody}.
 */
export function DetachedPanel({ id }: { id: string }) {
  return (
    <div className="h-screen w-screen bg-page">
      <GraphPanelBody id={id} />
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function FabTerminal({ onTrade, onBrokerFlow, onOrderAI, market = 'DFM' }: { onTrade: (symbol: Symbol, side: 'buy' | 'sell') => void; onBrokerFlow?: () => void; onOrderAI?: () => void; market?: MarketCode }) {
  const [selected, setSelected] = useState<Symbol>(() => defaultSymbolFor(market))
  const [newsItem, setNewsItem] = useState<NewsItem | null>(null)
  const tick = useLiveTick()

  // Market-scoped datasets — every symbol-driven panel reads these so switching
  // market (via the tab / top-bar dropdown) genuinely changes the terminal.
  const marketSymbolList = useMemo(() => symbolsForMarket(market), [market])
  const marketIndexList = useMemo(() => indicesForMarket(market), [market])
  const marketWatchRows = useMemo(() => watchlistForMarket(market), [market])

  const [gridLayout, setGridLayout] = useState<RGLLayoutItem[]>(() => loadGridLayout())

  // ── Hotkeys (F1–F10) ──────────────────────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false)
  const [flashId, setFlashId] = useState<PanelId | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Pop-out to the shared Workspace board ──────────────────────────────────
  // Popping a Graph panel out sends it to the same draggable board the Detailed
  // look uses (grid arrangement, resize, dock-to-main, always-on-top), so both
  // looks share one workspace board. The panel also stays in the graph.
  const popOut = (id: PanelId) => { void sendToBoard(id) }

  useEffect(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(gridLayout)) } catch { /* ignore */ }
  }, [gridLayout])

  // Panel registry — keeps each panel's existing props/behaviour identical.
  const panels: Record<PanelId, PanelDef> = useMemo(
    () => ({
      indices:    { id: 'indices',    render: () => <IndicesPanel tick={tick} indices={marketIndexList} /> },
      hero:       { id: 'hero',       render: () => <HeroPanel sym={selected} onTrade={onTrade} tick={tick} /> },
      orderbook:  { id: 'orderbook',  render: () => <OrderBookPanel short={selected.symbolShortName} tick={tick} /> },
      breadth:    { id: 'breadth',    render: () => <BreadthPanel tick={tick} symbols={marketSymbolList} /> },
      sector:     { id: 'sector',     render: () => <SectorPanel symbols={marketSymbolList} /> },
      movers:     { id: 'movers',     render: () => <MoversPanel onSelect={setSelected} onTrade={onTrade} symbols={marketSymbolList} /> },
      watchlist:  { id: 'watchlist',  render: () => <WatchlistPanel selected={selected} onSelect={setSelected} onTrade={onTrade} symbols={marketWatchRows} /> },
      mostactive: { id: 'mostactive', render: () => <MostActivePanel onSelect={setSelected} onTrade={onTrade} symbols={marketSymbolList} /> },
      news:       { id: 'news',       render: () => <NewsPanel selected={selected} onOpen={setNewsItem} /> },
      timesales:  { id: 'timesales',  render: () => <TimeSalesPanel short={selected.symbolShortName} /> },
    }),
    [selected, onTrade, tick, marketSymbolList, marketIndexList, marketWatchRows],
  )

  const resetLayout = () => {
    setGridLayout(DEFAULT_GRID_LAYOUT)
    try { localStorage.removeItem(LAYOUT_KEY) } catch { /* ignore */ }
  }

  const handleHide = (id: PanelId) => setGridLayout((prev) => prev.filter((item) => item.i !== id))
  const handleShow = (id: PanelId) => {
    if (gridLayout.some((item) => item.i === id)) return
    const def = DEFAULT_GRID_LAYOUT.find((item) => item.i === id)
    setGridLayout((prev) => [...prev, { ...(def ?? { i: id, x: 0, w: 4, h: 4, minW: 2, minH: 2 }), y: Infinity }])
  }
  const hiddenPanels = ALL_PANEL_IDS.filter((id) => !gridLayout.some((item) => item.i === id))

  // Scroll a panel into view and flash a ring around it for ~1.4s.
  const focusPanel = (id: PanelId) => {
    setFlashId(id)
    document.querySelector(`[data-panel-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashId(null), 1400)
  }

  const runHotkey = (a: HotkeyAction) => {
    switch (a.kind) {
      case 'help': setHelpOpen((o) => !o); break
      case 'buy': onTrade(selected, 'buy'); break
      case 'sell': onTrade(selected, 'sell'); break
      case 'search': setHelpOpen(false); document.getElementById('terminal-symbol-search')?.focus(); break
      case 'reset': resetLayout(); break
      case 'broker': setHelpOpen(false); onBrokerFlow?.(); break
      case 'broker-ai': setHelpOpen(false); onOrderAI?.(); break
      case 'panel': setHelpOpen(false); focusPanel(a.panel); break
    }
  }

  // Global F-key listener. F1–F10 are intercepted (so the webview never reloads
  // on F5 or pops its own help on F1); other keys pass straight through.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && helpOpen) { setHelpOpen(false); return }
      if (e.key === 'F5') return // F5 (Broker Flow) is handled by the workspace
      const hk = HOTKEYS.find((h) => h.key === e.key)
      if (!hk) return
      e.preventDefault()
      runHotkey(hk.action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, helpOpen])

  const isCustomized =
    gridLayout.length !== DEFAULT_GRID_LAYOUT.length ||
    gridLayout.some((item) => {
      const def = DEFAULT_GRID_LAYOUT.find((d) => d.i === item.i)
      return !def || item.x !== def.x || item.y !== def.y || item.w !== def.w || item.h !== def.h
    })

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-page">
      <Header selected={selected} onSelect={setSelected} resetLayout={resetLayout} canReset={isCustomized} market={market} symbols={marketSymbolList} hidden={hiddenPanels} onShow={handleShow} />
      <div className="flex-1 overflow-y-auto p-3">
        <TerminalGrid
          layout={gridLayout}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_H}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          draggableHandle=".fab-panel-handle"
          compactType="vertical"
          isDraggable
          isResizable
          resizeHandles={['s', 'e', 'se']}
          isBounded={false}
          onLayoutChange={(l: RGLLayout) => setGridLayout([...l])}
        >
          {gridLayout.map((item) => {
            const id = item.i as PanelId
            const def = panels[id]
            if (!def) return null
            return (
              <div key={id}>
                <PanelCard id={id} highlight={flashId === id} onTearOut={popOut} onHide={handleHide}>
                  {def.render()}
                </PanelCard>
              </div>
            )
          })}
        </TerminalGrid>
      </div>
      <HotkeyBar onTrigger={runHotkey} />
      <TickerTape tick={tick} />
      <HotkeyHelp open={helpOpen} onClose={() => setHelpOpen(false)} onTrigger={runHotkey} />
      <NewsDrawer item={newsItem} onClose={() => setNewsItem(null)} onSelectSymbol={setSelected} />
    </div>
  )
}
