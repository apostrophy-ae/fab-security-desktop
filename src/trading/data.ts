/**
 * Mock market data + types for the FAB Securities trading dashboard.
 * Stands in for the live feeder/Market Watch data in the legacy TRADENET X.
 * All panels (Market Indices, Full Market, Top Symbols, Watchlist, Market
 * Depth, Portfolio) consume these shapes so the UI is internally consistent.
 */

export type Direction = 'up' | 'down' | 'flat'

/** Top market-summary ticker (the strip above the tables). */
export interface Ticker {
  label: string
  value: number
  netChange: number
  changePct: number
  direction: Direction
}

/** A row in the Market Indices table. */
export interface MarketIndex {
  name: string
  shortName: string
  marketName: string
  indexCurrent: number
  openValue: number
  high: number
  low: number
  totalVolume: number
  totalValue: number
  prevClose: number
  netChange: number
  changePct: number
  direction: Direction
}

/** A symbol row in the Full Market / Watchlist tables. Many optional columns. */
export interface Symbol {
  marketName: string
  marketShortName: string
  symbolName: string
  symbolShortName: string
  id: string
  remarks?: 'suspended' | 'rights' | null
  /** Colour tag the legacy UI applied to the symbol name. */
  tone?: Direction
  bidPrice: number
  bidSize: number
  offerPrice: number
  offerSize: number
  lastPrice: number
  openPrice: number
  high: number
  low: number
  prevClose: number
  change: number
  changePct: number
  volume: number
  value: number
  trades: number
  vwap: number
  weekHigh52: number
  weekLow52: number
  per: number
  marketCap: number
  yield: number
  sector: string
}

export interface TopSymbol {
  symbolName: string
  symbolShortName: string
  id: string
  lastPrice: number
  changePct: number
  volume: number
  direction: Direction
}

export interface PortfolioPosition {
  xchng: string
  symbol: string
  currency: string
  avgCost: number
  evalPrice: number
  quantity: number
  pledged: number
  available: number
  marketValue: number
  cost: number
  gainLoss: number
}

export interface DepthLevel {
  bidAccounts: number
  bidSize: number
  bidPrice: number
  offerPrice: number
  offerSize: number
  offerAccounts: number
}

/** Definition of a Full Market column (drives the column-settings drawer). */
export interface ColumnDef {
  key: string
  label: string
  group: 'Identity' | 'Quote' | 'Trade' | 'Statistics' | 'Valuation' | 'Advanced'
  /** Visible by default. */
  default: boolean
  align?: 'left' | 'right'
  format?: 'price' | 'int' | 'pct' | 'change' | 'text' | 'bid' | 'offer'
}

// ─── Market summary strip ────────────────────────────────────────────────
export const TICKERS: Ticker[] = [
  { label: 'Global Financial Market 201', value: 9.0, netChange: 0.0, changePct: 0.0, direction: 'flat' },
  { label: 'DFM General Index', value: 5278.41, netChange: 12.74, changePct: 0.242, direction: 'up' },
  { label: 'ADX General Index', value: 9612.08, netChange: -18.33, changePct: -0.19, direction: 'down' },
  { label: 'Nasdaq Dubai', value: 3741.66, netChange: 7.4, changePct: 0.198, direction: 'up' },
  { label: 'FTSE ADX 15', value: 3088.12, netChange: 2.05, changePct: 0.066, direction: 'up' },
]

// ─── Market Indices table ────────────────────────────────────────────────
export const MARKET_INDICES: MarketIndex[] = [
  { name: 'DFM General Index', shortName: 'DFMGI', marketName: 'Dubai Financial Market', indexCurrent: 5278.41, openValue: 5265.67, high: 5291.2, low: 5260.4, totalVolume: 168_245_000, totalValue: 421_500_000, prevClose: 5265.67, netChange: 12.74, changePct: 0.242, direction: 'up' },
  { name: 'ADX General Index', shortName: 'ADI', marketName: 'Abu Dhabi Securities Exchange', indexCurrent: 9612.08, openValue: 9630.41, high: 9641.9, low: 9602.1, totalVolume: 254_120_000, totalValue: 980_300_000, prevClose: 9630.41, netChange: -18.33, changePct: -0.19, direction: 'down' },
  { name: 'FTSE ADX 15 Index', shortName: 'FADX15', marketName: 'Abu Dhabi Securities Exchange', indexCurrent: 3088.12, openValue: 3086.07, high: 3092.4, low: 3081.0, totalVolume: 61_400_000, totalValue: 310_900_000, prevClose: 3086.07, netChange: 2.05, changePct: 0.066, direction: 'up' },
  { name: 'Nasdaq Dubai UAE 20', shortName: 'NDUAE20', marketName: 'Nasdaq Dubai', indexCurrent: 3741.66, openValue: 3734.26, high: 3748.1, low: 3730.5, totalVolume: 12_840_000, totalValue: 88_200_000, prevClose: 3734.26, netChange: 7.4, changePct: 0.198, direction: 'up' },
  { name: 'DFM Financials Index', shortName: 'DFMFIN', marketName: 'Dubai Financial Market', indexCurrent: 2317.09, openValue: 2310.44, high: 2320.1, low: 2305.8, totalVolume: 54_220_000, totalValue: 132_400_000, prevClose: 2310.44, netChange: 6.65, changePct: 0.288, direction: 'up' },
  { name: 'DFM Real Estate Index', shortName: 'DFMRE', marketName: 'Dubai Financial Market', indexCurrent: 1483.64, openValue: 1489.2, high: 1491.0, low: 1480.2, totalVolume: 78_900_000, totalValue: 201_700_000, prevClose: 1489.2, netChange: -5.56, changePct: -0.373, direction: 'down' },
  { name: 'DFM Banks Index', shortName: 'DFMBNK', marketName: 'Dubai Financial Market', indexCurrent: 3402.18, openValue: 3398.0, high: 3409.5, low: 3392.7, totalVolume: 33_100_000, totalValue: 145_600_000, prevClose: 3398.0, netChange: 4.18, changePct: 0.123, direction: 'up' },
  { name: 'DFM Services Index', shortName: 'DFMSRV', marketName: 'Dubai Financial Market', indexCurrent: 612.45, openValue: 612.45, high: 614.0, low: 610.9, totalVolume: 9_200_000, totalValue: 21_300_000, prevClose: 612.45, netChange: 0.0, changePct: 0.0, direction: 'flat' },
  { name: 'ADX Banks Index', shortName: 'ADXBNK', marketName: 'Abu Dhabi Securities Exchange', indexCurrent: 5021.77, openValue: 5040.1, high: 5048.3, low: 5012.4, totalVolume: 41_800_000, totalValue: 264_100_000, prevClose: 5040.1, netChange: -18.33, changePct: -0.364, direction: 'down' },
  { name: 'ADX Energy Index', shortName: 'ADXENR', marketName: 'Abu Dhabi Securities Exchange', indexCurrent: 1894.02, openValue: 1888.5, high: 1898.0, low: 1885.1, totalVolume: 22_600_000, totalValue: 119_900_000, prevClose: 1888.5, netChange: 5.52, changePct: 0.292, direction: 'up' },
]

// ─── Full Market column registry ─────────────────────────────────────────
export const FULL_MARKET_COLUMNS: ColumnDef[] = [
  { key: 'symbolName', label: 'Symbol Name', group: 'Identity', default: true, align: 'left', format: 'text' },
  { key: 'symbolShortName', label: 'Symbol Short Name', group: 'Identity', default: true, align: 'left', format: 'text' },
  { key: 'id', label: 'ID', group: 'Identity', default: true, align: 'left', format: 'text' },
  { key: 'marketName', label: 'Market Name', group: 'Identity', default: false, align: 'left', format: 'text' },
  { key: 'marketShortName', label: 'Market Short Name', group: 'Identity', default: false, align: 'left', format: 'text' },
  { key: 'sector', label: 'Sector', group: 'Identity', default: false, align: 'left', format: 'text' },
  { key: 'remarks', label: 'Remarks', group: 'Identity', default: true, align: 'left', format: 'text' },
  { key: 'bidPrice', label: 'Bid Price', group: 'Quote', default: true, align: 'right', format: 'bid' },
  { key: 'bidSize', label: 'Bid Size', group: 'Quote', default: true, align: 'right', format: 'int' },
  { key: 'offerPrice', label: 'Offer Price', group: 'Quote', default: true, align: 'right', format: 'offer' },
  { key: 'offerSize', label: 'Offer Size', group: 'Quote', default: true, align: 'right', format: 'int' },
  { key: 'lastPrice', label: 'Last Price', group: 'Quote', default: true, align: 'right', format: 'price' },
  { key: 'change', label: 'Net Change', group: 'Quote', default: true, align: 'right', format: 'change' },
  { key: 'changePct', label: 'Change %', group: 'Quote', default: true, align: 'right', format: 'pct' },
  { key: 'openPrice', label: 'Open Price', group: 'Trade', default: false, align: 'right', format: 'price' },
  { key: 'high', label: 'High Price', group: 'Trade', default: false, align: 'right', format: 'price' },
  { key: 'low', label: 'Low Price', group: 'Trade', default: false, align: 'right', format: 'price' },
  { key: 'prevClose', label: 'Previous Close', group: 'Trade', default: false, align: 'right', format: 'price' },
  { key: 'vwap', label: 'VWAP', group: 'Trade', default: false, align: 'right', format: 'price' },
  { key: 'volume', label: 'Volume', group: 'Statistics', default: true, align: 'right', format: 'int' },
  { key: 'value', label: 'Total Value', group: 'Statistics', default: false, align: 'right', format: 'int' },
  { key: 'trades', label: 'No. of Trades', group: 'Statistics', default: false, align: 'right', format: 'int' },
  { key: 'weekHigh52', label: '52 Weeks High', group: 'Statistics', default: false, align: 'right', format: 'price' },
  { key: 'weekLow52', label: '52 Weeks Low', group: 'Statistics', default: false, align: 'right', format: 'price' },
  { key: 'per', label: 'PER', group: 'Valuation', default: false, align: 'right', format: 'price' },
  { key: 'marketCap', label: 'Market Capitalization', group: 'Valuation', default: false, align: 'right', format: 'int' },
  { key: 'yield', label: 'Yield', group: 'Valuation', default: false, align: 'right', format: 'pct' },
]

const SECTORS = ['Banking', 'Real Estate', 'Financials', 'Energy', 'Telecom', 'Consumer', 'Industrial', 'Insurance', 'Materials']

export type MarketCode = 'DFM' | 'ADX' | 'NASDAQ'
export const MARKET_NAMES: Record<MarketCode, string> = {
  DFM: 'Dubai Financial Market',
  ADX: 'Abu Dhabi Securities Exchange',
  NASDAQ: 'Nasdaq Dubai',
}

type SeedRow = [name: string, short: string, sector: string, last: number, chgPct: number, tone?: Direction, remarks?: Symbol['remarks'], market?: MarketCode]

const FULL_MARKET_SEED: SeedRow[] = [
  ['Aan Digital Services', 'AAN', 'Telecom', 0.336, 0.0, 'flat'],
  ['ACICO Industries', 'ACICO', 'Industrial', 1.78, 1.71, 'up', 'suspended'],
  ['Agility', 'AGLTY', 'Industrial', 16.0, -0.62, 'down'],
  ['Arab Heavy Industries', 'AHI', 'Industrial', 0.41, 0.0, 'flat', 'suspended'],
  ['Amlak Finance', 'AMLAK', 'Real Estate', 0.84, 2.44, 'up'],
  ['Ajman Bank Rights', 'AJMANB-RI23', 'Banking', 1.05, 0.0, 'flat', 'rights'],
  ['Ajman Bank', 'AJMANBANK', 'Banking', 2.04, 0.99, 'up'],
  ['Al Ansari Financial Services', 'ALANSARI', 'Financials', 1.236, -0.32, 'down'],
  ['Al Firdous Holdings', 'ALFIRDOUS', 'Financials', 0.96, 0.0, 'flat'],
  ['Alliance Insurance', 'ALLIANCE', 'Insurance', 6.5, 0.46, 'up'],
  ['Al Madina for Finance', 'ALMADINA', 'Financials', 0.78, -1.27, 'down'],
  ['Al Ramz Corporate Investment', 'ALRAMZ', 'Financials', 0.482, 1.05, 'up'],
  ['Al Salam Bank Bahrain', 'ALSALAMKW', 'Banking', 1.18, 0.85, 'up'],
  ['Al Salam Bank Sudan', 'ALSALAMSUDAN', 'Banking', 1.454, 0.0, 'flat'],
  ['Dubai Islamic Insurance', 'AMAN', 'Insurance', 0.64, -2.13, 'down'],
  ['Amanat Holdings', 'AMANAT', 'Financials', 1.82, 1.11, 'up'],
  ['Al Mal Capital REIT', 'AMCREIT', 'Real Estate', 0.95, 0.0, 'flat'],
  ['Arabtec Holding', 'ARTC', 'Real Estate', 0.55, -3.51, 'down', 'suspended'],
  ['Al Sagr Insurance', 'ASNIC', 'Insurance', 3.04, 0.66, 'up'],
  ['Al Jazeera Steel', 'ATMI', 'Materials', 1.1, 0.0, 'flat'],
  ['Awtad PrJSC', 'AWTAD', 'Real Estate', 0.71, 1.43, 'up'],
  ['Bayan Investment', 'BAYAN', 'Financials', 0.39, -2.5, 'down'],
  ['BHM Capital Financial', 'BHMCAPITAL', 'Financials', 1.3, 0.78, 'up'],
  ['Commercial Bank of Dubai', 'CBD', 'Banking', 6.42, 0.31, 'up'],
  ['Damac Properties', 'DAMAC', 'Real Estate', 1.5, -0.66, 'down'],
  ['Deyaar Development', 'DEYAAR', 'Real Estate', 0.78, 2.63, 'up'],
  ['Dubai Islamic Bank', 'DIB', 'Banking', 6.98, 0.43, 'up'],
  ['Drake & Scull Intl', 'DSI', 'Industrial', 0.142, 0.0, 'flat', 'suspended'],
  ['Dubai Investments', 'DIC', 'Financials', 2.56, 1.18, 'up'],
  ['DU Telecom (EITC)', 'DU', 'Telecom', 7.1, -0.42, 'down'],
  ['Emaar Properties', 'EMAAR', 'Real Estate', 8.34, 1.46, 'up'],
  ['Emaar Development', 'EMAARDEV', 'Real Estate', 12.05, 2.11, 'up'],
  ['Emirates NBD', 'EMIRATESNBD', 'Banking', 20.16, 0.8, 'up'],
  ['Emirates Islamic Bank', 'EIB', 'Banking', 9.5, 0.0, 'flat'],
  ['Emirates Investment Bank', 'EIBANK', 'Banking', 8.7, -0.57, 'down'],
  ['GFH Financial Group', 'GFH', 'Financials', 3.41, 1.79, 'up'],
  ['Gulf General Investment', 'GGICO', 'Financials', 0.39, 0.0, 'flat'],
  ['Gulf Navigation Holding', 'GULFNAV', 'Industrial', 0.62, -1.59, 'down'],
  ['National Central Cooling (Tabreed)', 'TABREED', 'Energy', 3.66, 0.55, 'up'],
  ['Salik Company', 'SALIK', 'Industrial', 4.5, 1.12, 'up'],
  ['Parkin Company', 'PARKIN', 'Industrial', 6.2, 2.31, 'up'],
  ['Spinneys Holding', 'SPINNEYS', 'Consumer', 1.5, 0.67, 'up'],
  ['Talabat Holding', 'TALABAT', 'Consumer', 1.62, -0.61, 'down'],
  ['Union Properties', 'UPP', 'Real Estate', 0.58, 3.57, 'up'],
  // ── Abu Dhabi Securities Exchange (ADX) — simulated (no free live feed) ──
  ['First Abu Dhabi Bank', 'FAB', 'Banking', 13.9, 0.8, 'up', undefined, 'ADX'],
  ['International Holding Co', 'IHC', 'Financials', 400.0, 1.2, 'up', undefined, 'ADX'],
  ['Aldar Properties', 'ALDAR', 'Real Estate', 8.2, 1.6, 'up', undefined, 'ADX'],
  ['Abu Dhabi Commercial Bank', 'ADCB', 'Banking', 9.8, -0.4, 'down', undefined, 'ADX'],
  ['Abu Dhabi Islamic Bank', 'ADIB', 'Banking', 12.6, 0.5, 'up', undefined, 'ADX'],
  ['e& (Etisalat)', 'ETISALAT', 'Telecom', 17.5, 0.3, 'up', undefined, 'ADX'],
  ['Abu Dhabi National Energy (TAQA)', 'TAQA', 'Energy', 2.9, -0.7, 'down', undefined, 'ADX'],
  ['ADNOC Gas', 'ADNOCGAS', 'Energy', 3.4, 1.1, 'up', undefined, 'ADX'],
  ['ADNOC Drilling', 'ADNOCDRILL', 'Energy', 5.6, 2.0, 'up', undefined, 'ADX'],
  ['Borouge', 'BOROUGE', 'Materials', 2.5, -0.4, 'down', undefined, 'ADX'],
  ['Multiply Group', 'MULTIPLY', 'Financials', 2.6, 0.8, 'up', undefined, 'ADX'],
  ['Pure Health Holding', 'PUREHEALTH', 'Consumer', 4.7, 1.3, 'up', undefined, 'ADX'],
  // ── Nasdaq Dubai — simulated ──
  ['DP World', 'DPW', 'Industrial', 16.75, 0.6, 'up', undefined, 'NASDAQ'],
  ['Emirates REIT', 'EREIT', 'Real Estate', 3.9, -0.5, 'down', undefined, 'NASDAQ'],
]

function buildSymbol([name, short, sector, last, chgPct, tone, remarks, market = 'DFM']: SeedRow): Symbol {
  const prevClose = +(last / (1 + chgPct / 100)).toFixed(3)
  const change = +(last - prevClose).toFixed(3)
  const spread = Math.max(0.005, +(last * 0.001).toFixed(3))
  const suspended = remarks === 'suspended'
  return {
    marketName: MARKET_NAMES[market],
    marketShortName: market,
    symbolName: name,
    symbolShortName: short,
    id: short,
    remarks: remarks ?? null,
    tone: tone ?? 'flat',
    bidPrice: suspended ? 0 : +(last - spread).toFixed(3),
    bidSize: suspended ? 0 : Math.round(((short.length * 37) % 9 + 1) * 1000),
    offerPrice: suspended ? 0 : +(last + spread).toFixed(3),
    offerSize: suspended ? 0 : Math.round(((short.length * 53) % 8 + 1) * 1000),
    lastPrice: suspended ? 0 : last,
    openPrice: prevClose,
    high: +(last * 1.012).toFixed(3),
    low: +(last * 0.988).toFixed(3),
    prevClose,
    change,
    changePct: chgPct,
    volume: suspended ? 0 : Math.round((short.charCodeAt(0) * 9173) % 9_000_000 + 50_000),
    value: suspended ? 0 : Math.round(last * ((short.charCodeAt(0) * 9173) % 9_000_000 + 50_000)),
    trades: suspended ? 0 : (short.charCodeAt(0) * 7) % 1200 + 5,
    vwap: +(last * 0.999).toFixed(3),
    weekHigh52: +(last * 1.35).toFixed(3),
    weekLow52: +(last * 0.72).toFixed(3),
    per: +((short.charCodeAt(0) % 25) + 6 + Math.abs(chgPct)).toFixed(2),
    marketCap: Math.round(last * 1_000_000_000 * ((short.length % 9) + 1)),
    yield: +(((short.charCodeAt(1) ?? 65) % 7) + 0.5).toFixed(2),
    sector,
  }
}

export const FULL_MARKET: Symbol[] = FULL_MARKET_SEED.map(buildSymbol)

export const SECTOR_OPTIONS = ['All', ...SECTORS]
export const MARKET_OPTIONS = ['All Markets', 'Dubai Financial Market', 'Abu Dhabi Securities Exchange', 'Nasdaq Dubai']
export const WATCHLIST_OPTIONS = ['Default', 'My Banks', 'Real Estate Watch', 'High Movers', 'Energy']
export const TRADING_SESSION_OPTIONS = ['Continuous', 'Pre-Open', 'Opening Auction', 'Closing Auction', 'Closed']
export const CLIENT_OPTIONS = ['4447 — FQA First Last', '5521 — Al Futtaim Trading', '6610 — Mahlya Holdings', '7782 — ADNOC Treasury']

// ─── Watchlist (subset of symbols the broker tracks) ─────────────────────
export const WATCHLIST: Symbol[] = ['EMAAR', 'EMIRATESNBD', 'DIB', 'AMANAT', 'GFH', 'SALIK', 'PARKIN', 'TABREED', 'DAMAC', 'AGLTY']
  .map((s) => FULL_MARKET.find((r) => r.symbolShortName === s)!)
  .filter(Boolean)

// ─── Top Symbols (most active by volume) ─────────────────────────────────
export const TOP_SYMBOLS: TopSymbol[] = [...FULL_MARKET]
  .filter((s) => s.volume > 0)
  .sort((a, b) => b.volume - a.volume)
  .slice(0, 10)
  .map((s) => ({
    symbolName: s.symbolName,
    symbolShortName: s.symbolShortName,
    id: s.id,
    lastPrice: s.lastPrice,
    changePct: s.changePct,
    volume: s.volume,
    direction: s.tone ?? 'flat',
  }))

// ─── Market Depth (for the selected symbol — EMAAR) ──────────────────────
export const MARKET_DEPTH_SYMBOL = 'EMAAR'
export const MARKET_DEPTH: DepthLevel[] = [
  { bidAccounts: 12, bidSize: 45_200, bidPrice: 8.33, offerPrice: 8.34, offerSize: 38_100, offerAccounts: 9 },
  { bidAccounts: 8, bidSize: 31_500, bidPrice: 8.32, offerPrice: 8.35, offerSize: 52_400, offerAccounts: 14 },
  { bidAccounts: 15, bidSize: 60_800, bidPrice: 8.31, offerPrice: 8.36, offerSize: 27_900, offerAccounts: 7 },
  { bidAccounts: 6, bidSize: 22_100, bidPrice: 8.3, offerPrice: 8.37, offerSize: 41_600, offerAccounts: 11 },
  { bidAccounts: 10, bidSize: 38_700, bidPrice: 8.29, offerPrice: 8.38, offerSize: 19_300, offerAccounts: 5 },
]

// ─── Portfolio positioning ───────────────────────────────────────────────
export const PORTFOLIO_CLIENT = '4447 — FQA First Last'
export const PORTFOLIO: PortfolioPosition[] = [
  { xchng: 'DFM', symbol: 'EMAAR', currency: 'AED', avgCost: 6.85, evalPrice: 8.34, quantity: 120_000, pledged: 0, available: 120_000, marketValue: 1_000_800, cost: 822_000, gainLoss: 178_800 },
  { xchng: 'DFM', symbol: 'EMIRATESNBD', currency: 'AED', avgCost: 18.4, evalPrice: 20.16, quantity: 40_000, pledged: 10_000, available: 30_000, marketValue: 806_400, cost: 736_000, gainLoss: 70_400 },
  { xchng: 'DFM', symbol: 'DIB', currency: 'AED', avgCost: 7.2, evalPrice: 6.98, quantity: 85_000, pledged: 0, available: 85_000, marketValue: 593_300, cost: 612_000, gainLoss: -18_700 },
  { xchng: 'DFM', symbol: 'AMANAT', currency: 'AED', avgCost: 1.6, evalPrice: 1.82, quantity: 300_000, pledged: 0, available: 300_000, marketValue: 546_000, cost: 480_000, gainLoss: 66_000 },
  { xchng: 'ADX', symbol: 'TABREED', currency: 'AED', avgCost: 3.9, evalPrice: 3.66, quantity: 75_000, pledged: 0, available: 75_000, marketValue: 274_500, cost: 292_500, gainLoss: -18_000 },
]

export const PORTFOLIO_TOTALS = {
  marketValue: PORTFOLIO.reduce((s, p) => s + p.marketValue, 0),
  cost: PORTFOLIO.reduce((s, p) => s + p.cost, 0),
  gainLoss: PORTFOLIO.reduce((s, p) => s + p.gainLoss, 0),
}

export const PURCHASE_POWER = {
  cashAmount: 1_250_000,
  blocked: 180_000,
  coverageRatio: 2.4,
  marginableValue: 2_980_000,
  accountLimit: 5_000_000,
  outstandingBuyOrders: 320_000,
  ltvRatio: 0.38,
  portfolioValue: PORTFOLIO_TOTALS.marketValue,
}

// ─── Formatting helpers ──────────────────────────────────────────────────
export function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}
export function fmtInt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
export function fmtPct(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}
export function fmtChange(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(3)}`
}
export function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
export function directionColor(d: Direction): string {
  return d === 'up' ? 'text-up' : d === 'down' ? 'text-down' : 'text-flat'
}

// ─── Internal brokers (10–12 desk brokers) ───────────────────────────────
export const BROKERS = [
  'broker01 — Sami Haddad', 'broker02 — Ahmed Aziz', 'broker03 — Samantha Vargas', 'broker04 — Mohammed Jabir',
  'broker05 — Wasaadre', 'broker06 — Lina Okeke', 'broker07 — Yusuf Rahman', 'broker08 — Mahlya Holdings Desk',
  'broker09 — Priya Nair', 'broker10 — Omar Saleh', 'broker11 — Dana Fares', 'broker12 — Karim Nseir',
]

// ─── Orders blotter (Order Monitor / Statistics / Suspended) ─────────────
export type OrderStatus = 'Working' | 'Partially Filled' | 'Filled' | 'Cancelled' | 'Rejected' | 'Suspended'

export interface Order {
  id: string
  time: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'Limit' | 'Market'
  qty: number
  filled: number
  price: number
  avgFill: number
  status: OrderStatus
  validity: 'Day' | 'GTC' | 'IOC'
  client: string
  broker: string
}

export const ORDERS: Order[] = [
  { id: 'ORD-100482', time: '10:14:22', symbol: 'EMAAR', side: 'buy', type: 'Limit', qty: 50_000, filled: 50_000, price: 8.33, avgFill: 8.328, status: 'Filled', validity: 'Day', client: '4447', broker: 'broker08' },
  { id: 'ORD-100483', time: '10:15:01', symbol: 'EMIRATESNBD', side: 'buy', type: 'Limit', qty: 20_000, filled: 8_000, price: 20.1, avgFill: 20.09, status: 'Partially Filled', validity: 'Day', client: '4447', broker: 'broker08' },
  { id: 'ORD-100484', time: '10:16:47', symbol: 'DIB', side: 'sell', type: 'Limit', qty: 30_000, filled: 0, price: 7.0, avgFill: 0, status: 'Working', validity: 'GTC', client: '5521', broker: 'broker03' },
  { id: 'ORD-100485', time: '10:18:09', symbol: 'AMANAT', side: 'buy', type: 'Market', qty: 100_000, filled: 100_000, price: 0, avgFill: 1.821, status: 'Filled', validity: 'IOC', client: '6610', broker: 'broker02' },
  { id: 'ORD-100486', time: '10:19:55', symbol: 'GFH', side: 'buy', type: 'Limit', qty: 75_000, filled: 0, price: 3.38, avgFill: 0, status: 'Working', validity: 'Day', client: '4447', broker: 'broker08' },
  { id: 'ORD-100487', time: '10:21:30', symbol: 'SALIK', side: 'sell', type: 'Limit', qty: 40_000, filled: 0, price: 4.55, avgFill: 0, status: 'Cancelled', validity: 'Day', client: '7782', broker: 'broker05' },
  { id: 'ORD-100488', time: '10:23:12', symbol: 'DAMAC', side: 'buy', type: 'Limit', qty: 60_000, filled: 0, price: 1.49, avgFill: 0, status: 'Rejected', validity: 'Day', client: '5521', broker: 'broker03' },
  { id: 'ORD-100489', time: '10:24:48', symbol: 'PARKIN', side: 'buy', type: 'Limit', qty: 25_000, filled: 12_000, price: 6.2, avgFill: 6.19, status: 'Partially Filled', validity: 'Day', client: '4447', broker: 'broker08' },
  { id: 'ORD-100490', time: '10:26:03', symbol: 'TABREED', side: 'sell', type: 'Limit', qty: 35_000, filled: 35_000, price: 3.66, avgFill: 3.662, status: 'Filled', validity: 'Day', client: '6610', broker: 'broker02' },
  { id: 'ORD-100491', time: '10:27:41', symbol: 'AGLTY', side: 'buy', type: 'Limit', qty: 15_000, filled: 0, price: 16.0, avgFill: 0, status: 'Suspended', validity: 'GTC', client: '7782', broker: 'broker05' },
  { id: 'ORD-100492', time: '10:29:18', symbol: 'DIB', side: 'buy', type: 'Limit', qty: 45_000, filled: 0, price: 6.96, avgFill: 0, status: 'Working', validity: 'Day', client: '4447', broker: 'broker08' },
  { id: 'ORD-100493', time: '10:31:55', symbol: 'EMAARDEV', side: 'sell', type: 'Limit', qty: 18_000, filled: 0, price: 12.1, avgFill: 0, status: 'Working', validity: 'Day', client: '5521', broker: 'broker03' },
  { id: 'ORD-100494', time: '10:33:22', symbol: 'CBD', side: 'buy', type: 'Market', qty: 22_000, filled: 22_000, price: 0, avgFill: 6.421, status: 'Filled', validity: 'IOC', client: '6610', broker: 'broker02' },
  { id: 'ORD-100495', time: '10:35:40', symbol: 'GFH', side: 'sell', type: 'Limit', qty: 90_000, filled: 0, price: 3.45, avgFill: 0, status: 'Suspended', validity: 'GTC', client: '7782', broker: 'broker05' },
]

// ─── Time & Sales (for Market Depth detail) ──────────────────────────────
export interface Trade {
  time: string
  price: number
  size: number
  side: 'buy' | 'sell'
}

export const TIME_SALES: Trade[] = Array.from({ length: 22 }, (_, i) => {
  const base = 8.33
  const drift = Math.sin(i / 2.1) * 0.02 - (i % 5 === 0 ? 0.01 : 0)
  const price = +(base + drift).toFixed(3)
  return {
    time: `10:${(36 - Math.floor(i / 3)).toString().padStart(2, '0')}:${((60 - i * 7 + 60) % 60).toString().padStart(2, '0')}`,
    price,
    size: ((i * 137) % 9 + 1) * 1000,
    side: drift >= 0 ? 'buy' : 'sell',
  }
})

// ─── Deep order book (10 levels) for Market Depth detail ──────────────────
export const MARKET_DEPTH_FULL: DepthLevel[] = Array.from({ length: 10 }, (_, i) => ({
  bidAccounts: ((i * 7) % 14) + 3,
  bidSize: Math.round((60_000 - i * 4200) * (1 + ((i * 13) % 5) / 10)),
  bidPrice: +(8.33 - i * 0.01).toFixed(2),
  offerPrice: +(8.34 + i * 0.01).toFixed(2),
  offerSize: Math.round((52_000 - i * 3800) * (1 + ((i * 11) % 5) / 10)),
  offerAccounts: ((i * 5) % 12) + 2,
}))

// ─── OHLC candles for the Charts screen (deterministic walk) ─────────────
export interface Candle {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

function buildCandles(symbol: string, start: number, count: number): Candle[] {
  // Deterministic pseudo-random walk seeded from the symbol — stable across renders.
  let seed = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0)
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const out: Candle[] = []
  let prevClose = start
  for (let i = 0; i < count; i++) {
    const drift = (rand() - 0.48) * start * 0.03
    const o = +prevClose.toFixed(3)
    const c = +Math.max(start * 0.5, o + drift).toFixed(3)
    const h = +(Math.max(o, c) + rand() * start * 0.012).toFixed(3)
    const l = +(Math.min(o, c) - rand() * start * 0.012).toFixed(3)
    const day = i + 1
    out.push({ t: `D${day}`, o, h, l, c, v: Math.round((rand() * 6 + 1) * 1_000_000) })
    prevClose = c
  }
  return out
}

export const CHART_SYMBOLS = ['EMAAR', 'EMIRATESNBD', 'DIB', 'AMANAT', 'GFH', 'SALIK']
export const CANDLES: Record<string, Candle[]> = Object.fromEntries(
  CHART_SYMBOLS.map((s) => {
    const sym = FULL_MARKET.find((r) => r.symbolShortName === s)
    return [s, buildCandles(s, sym?.lastPrice ?? 5, 90)]
  }),
)

/** Candles for any symbol — pre-built for CHART_SYMBOLS, generated deterministically otherwise. */
export function getCandles(short: string): Candle[] {
  if (CANDLES[short]) return CANDLES[short]
  const sym = FULL_MARKET.find((r) => r.symbolShortName === short)
  return buildCandles(short, sym?.lastPrice ?? 5, 90)
}

// ─── Cash movements (for Portfolio / Cash Position) ──────────────────────
export interface CashMovement {
  date: string
  type: 'Deposit' | 'Withdrawal' | 'Settlement' | 'Dividend' | 'Fee'
  reference: string
  amount: number
  currency: string
  status: 'Posted' | 'Pending'
}

export const CASH_MOVEMENTS: CashMovement[] = [
  { date: '14 Feb 2025', type: 'Settlement', reference: 'STL-77421', amount: -412_500, currency: 'AED', status: 'Posted' },
  { date: '13 Feb 2025', type: 'Deposit', reference: 'DEP-10233', amount: 1_000_000, currency: 'AED', status: 'Posted' },
  { date: '12 Feb 2025', type: 'Dividend', reference: 'DIV-55198', amount: 36_000, currency: 'AED', status: 'Posted' },
  { date: '11 Feb 2025', type: 'Settlement', reference: 'STL-77380', amount: 248_000, currency: 'AED', status: 'Posted' },
  { date: '10 Feb 2025', type: 'Withdrawal', reference: 'WDR-30021', amount: -150_000, currency: 'AED', status: 'Pending' },
  { date: '09 Feb 2025', type: 'Fee', reference: 'FEE-90112', amount: -1_240, currency: 'AED', status: 'Posted' },
]

/** High-liquidity blue-chip names that should appear first in Buy suggestions. */
export const BLUE_CHIPS = ['EMAAR', 'EMIRATESNBD', 'DIB', 'DEWA', 'SALIK', 'DAMAC', 'DU', 'TABREED', 'ALDAR', 'FAB', 'ADCB', 'IHC']

/** Sort a stock list so blue-chip names come first, niche names last. */
export function bluechipFirst(stocks: string[]): string[] {
  const inBoth = stocks.filter((s) => BLUE_CHIPS.includes(s))
  const blueOnly = BLUE_CHIPS.filter((s) => !stocks.includes(s))
  const niche = stocks.filter((s) => !BLUE_CHIPS.includes(s))
  return [...inBoth, ...blueOnly, ...niche]
}

