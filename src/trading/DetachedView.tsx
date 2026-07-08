import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import FabTerminal, { DetachedPanel } from './components/FabTerminal'
import MarketIndices from './components/MarketIndices'
import MarketStrip from './components/MarketStrip'
import FullMarket from './components/FullMarket'
import RightPanel from './components/RightPanel'
import BrokerDesk from './components/BrokerDesk'
import OrderPlacementAI from './components/OrderPlacementAI'
import BuySellDrawer from './components/BuySellDrawer'
import { dockPanelToMain } from './popout'
import { FULL_MARKET_COLUMNS } from './data'
import type { Symbol, MarketCode } from './data'

type Side = 'buy' | 'sell'
const defaultCols = FULL_MARKET_COLUMNS.filter((c) => c.default).map((c) => c.key)

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
const fmtKey = (key: string) => (isMac ? key.replace(/(F\d+)/, 'fn $1') : key)

type WViewMode = 'detailed' | 'graph'

/** Detailed ⇄ Graph toggle — self-contained, no outside state. */
function WViewModeToggle({ mode, onChange }: { mode: WViewMode; onChange: (m: WViewMode) => void }) {
  return (
    <div
      className="ml-4 flex items-center gap-1.5 rounded-lg border border-[#5b9bff]/40 bg-[#5b9bff]/10 px-1.5 py-1"
      title="Switch workspace look — shortcut: F11"
    >
      <div className="flex items-center gap-0.5">
        {(['detailed', 'graph'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-semibold transition-colors ${
              mode === m ? 'bg-[#5b9bff] text-white shadow' : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {m === 'detailed' ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h18M3 12h18M3 19h12" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 4-5" /></svg>
            )}
            {m === 'detailed' ? 'Detailed' : 'Graph'}
          </button>
        ))}
      </div>
      <kbd className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-[#9cc0ff]">F11</kbd>
    </div>
  )
}

const WS_HOTKEYS = [
  { key: 'F2', label: 'Buy', hint: 'Open a buy ticket' },
  { key: 'F3', label: 'Sell', hint: 'Open a sell ticket' },
  { key: 'F11', label: 'Switch look', hint: 'Toggle Detailed ⇄ Graph' },
]

function WShortcutBar({ onBuy, onSell, onToggle }: { onBuy: () => void; onSell: () => void; onToggle: () => void }) {
  const handlers: Record<string, () => void> = { F2: onBuy, F3: onSell, F11: onToggle }
  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap border-t border-border-dark bg-[#15171a] px-3 py-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-content-subtle">Shortcuts</span>
      {WS_HOTKEYS.map((h) => (
        <button
          key={h.key}
          type="button"
          title={h.hint}
          onClick={handlers[h.key]}
          className="flex items-center gap-1.5 rounded border border-border-dark bg-[#1a1c1e] px-1.5 py-0.5 text-[11px] text-content-muted transition-colors hover:border-action/60 hover:text-content"
        >
          <kbd className="rounded bg-[#0b0c0d] px-1 py-px font-mono text-[10px] font-semibold text-action">{fmtKey(h.key)}</kbd>
          {h.label}
        </button>
      ))}
    </div>
  )
}

const MARKET_LABEL: Record<string, string> = {
  DFM: 'Dubai Financial Market',
  ADX: 'Abu Dhabi Securities Exchange',
}

/**
 * Standalone workspace window with Detailed ⇄ Graph toggle.
 * No main app navigation (logo, tab bar) — only the mode switcher bar.
 */
function WorkspaceWindow({ market }: { market: MarketCode }) {
  const [mode, setMode] = useState<WViewMode>('graph')
  const [trade, setTrade] = useState<{ open: boolean; side: Side; symbol: Symbol | null }>({
    open: false, side: 'buy', symbol: null,
  })

  const openTrade = (symbol: Symbol, side: Side) => setTrade({ open: true, side, symbol })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F11') { e.preventDefault(); setMode((m) => (m === 'graph' ? 'detailed' : 'graph')) }
      if (e.key === 'F2') { e.preventDefault(); setTrade({ open: true, side: 'buy', symbol: null }) }
      if (e.key === 'F3') { e.preventDefault(); setTrade({ open: true, side: 'sell', symbol: null }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-page text-content">
      {/* ── Minimal top bar: brand + mode toggle + status ───────── */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-dark bg-[#0b1b4d] px-4">
        <span className="text-[14px] font-bold tracking-tight text-white">
          FAB <span className="font-light text-[#5b9bff]">x</span> Trade
        </span>
        <span className="text-white/30">/</span>
        <span className="text-[13px] font-medium text-white/80">{MARKET_LABEL[market] ?? market}</span>

        <WViewModeToggle mode={mode} onChange={setMode} />

        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12px] text-white/70">
            <span className="size-2 rounded-full bg-up shadow-[0_0_6px_rgba(47,208,122,0.8)]" />
            Connected
          </span>
          <span className="hidden text-[12px] text-white/50 lg:inline">BANKFAB0335R1</span>
        </div>
      </header>

      {/* ── Workspace content ────────────────────────────────────── */}
      {mode === 'graph' ? (
        <div className="min-h-0 flex-1 overflow-hidden bg-page">
          <FabTerminal market={market} onTrade={openTrade} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <MarketStrip />
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
              <MarketIndices market={MARKET_LABEL[market]} />
              <FullMarket
                visibleColumns={defaultCols}
                onOpenColumns={() => {}}
                onTrade={openTrade}
                defaultMarket={MARKET_LABEL[market]}
              />
            </div>
            <RightPanel onTrade={openTrade} />
          </div>
          <WShortcutBar
            onBuy={() => setTrade({ open: true, side: 'buy', symbol: null })}
            onSell={() => setTrade({ open: true, side: 'sell', symbol: null })}
            onToggle={() => setMode((m) => (m === 'graph' ? 'detailed' : 'graph'))}
          />
        </div>
      )}

      <BuySellDrawer
        open={trade.open}
        side={trade.side}
        symbol={trade.symbol}
        onSideChange={(side) => setTrade((t) => ({ ...t, side }))}
        onClose={() => setTrade((t) => ({ ...t, open: false }))}
      />
    </div>
  )
}

/**
 * Wraps a panel so its Buy/Sell buttons open a real order ticket *inside this
 * window*. The detached window has no parent TradingPlatform to host the
 * drawer, so each trading panel carries its own.
 */
function TradeHost({ render }: { render: (onTrade: (s: Symbol, side: Side) => void) => ReactNode }) {
  const [trade, setTrade] = useState<{ open: boolean; side: Side; symbol: Symbol | null }>({ open: false, side: 'buy', symbol: null })
  return (
    <div className="h-screen w-screen overflow-auto bg-page p-3 text-content">
      {render((symbol, side) => setTrade({ open: true, side, symbol }))}
      <BuySellDrawer
        open={trade.open}
        side={trade.side}
        symbol={trade.symbol}
        onSideChange={(side) => setTrade((t) => ({ ...t, side }))}
        onClose={() => setTrade((t) => ({ ...t, open: false }))}
      />
    </div>
  )
}

/**
 * Renders ONE panel filling its own window (the target of `/?detach=<id>`).
 * `d-*` ids are Detailed-view sections; everything else is a Graph panel and
 * is delegated to FabTerminal's standalone renderer.
 */
export default function DetachedView({ id }: { id: string }) {
  switch (id) {
    case 'd-indices':
      return <div className="h-screen w-screen overflow-auto bg-page p-3 text-content"><MarketIndices /></div>
    case 'd-market':
      return <TradeHost render={(onTrade) => <FullMarket visibleColumns={defaultCols} onOpenColumns={() => {}} onTrade={onTrade} />} />
    case 'd-right':
      return <TradeHost render={(onTrade) => <RightPanel onTrade={onTrade} />} />
    case 'workspace-dfm':
      return <WorkspaceWindow market="DFM" />
    case 'workspace-adx':
      return <WorkspaceWindow market="ADX" />
    case 'broker-flow':
      return <div className="h-screen w-screen bg-page"><BrokerDesk onDock={() => void dockPanelToMain(['broker-flow'])} /></div>
    case 'order-ai':
      return <div className="h-screen w-screen bg-page"><OrderPlacementAI onDock={() => void dockPanelToMain(['order-ai'])} /></div>
    default:
      return <DetachedPanel id={id} />
  }
}
