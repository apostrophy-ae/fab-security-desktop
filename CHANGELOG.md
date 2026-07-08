# Changelog

## v3.4.1

- **App icon — FAB logo** — the desktop/dock/taskbar icon is now the real First Abu Dhabi Bank logo (navy blue FAB wordmark with red chevron on white), replacing the generic placeholder. All platform sizes regenerated (macOS ICNS, Windows ICO, Windows Store tiles, PNG variants).
- **Top nav — removed market dropdown** — the DFM / ADX market selector that was in the top bar has been removed. Markets are opened via the tab bar's "+" button instead, which is the correct entry point.

## v3.4.0

- **Branding — FAB x Trade** — the product is now consistently named "FAB x Trade" (with a blue `x` accent) across the title bar, login screen, app window, updater dialog, and HTML page title. The old "LC · PeakPerf desk" subtitle is removed.
- **Order Placement AI — Wishlist** — brokers can now add any stock to a per-client wishlist with a target price and quantity. When the live price reaches the target, the AI transcript fires an alert automatically. A "Confirm & place" button on each triggered item lets the broker execute immediately. Wishlist items persist for the session and can be removed individually.
- **Order Placement AI — Wishlist demo call** — a new gold bell-icon demo call ("Wishlist call") is available alongside the existing demo calls. It scripted a client asking to wishlist a stock at the current live price, demonstrating the full alert-to-execution flow in one run.
- **Order Placement AI — Blue-chip suggestions** — the "Add line" quick-picks and the initial buy line now prioritise blue-chip stocks (EMAAR, DIB, EMIRATESNBD, DEWA, SALIK, DAMAC, DU, TABREED, ALDAR, FAB, ADCB, IHC) so high-value names always appear first and lower-tier names like TALABAT are not mixed in.
- **Order Placement (Manual) — Blue-chip suggestions** — the same blue-chip ordering applies to the manual Order Placement buy panel: the default buy line and the symbol quick-add strip both lead with the most important names.
- **Order Placement — Buy button colour** — the Buy button is now blue (matching the action accent colour) instead of green, for visual consistency with the rest of the FAB design language.
- **ADX / DFM windows — no main navigation** — opening the Abu Dhabi Securities or Dubai Financial Market workspace as a separate window now renders a clean standalone workspace with no main app navigation (no logo, tab bar, or sidebar). The window shows just the workspace content.
- **ADX / DFM windows — Detailed ⇄ Graph toggle** — the standalone workspace windows now include the Detailed / Graph mode switcher bar at the top. Graph mode shows the full FabTerminal chart view; Detailed mode shows the Market Watch overview (indices + full market table + watchlist panel). The F11 shortcut and an F-key bar (F2 Buy, F3 Sell, F11 Switch) are wired in the Detailed view.

## v3.3.7

- **Order Placement (Manual) — Sparkline gradient fill** — the area beneath the MarketWatch sparkline chart now fills with a semi-transparent gradient (green for up, red for down) that fades to transparent at the bottom, giving the chart depth and direction at a glance.
- **Order Placement (Manual) — Live tick flash** — market table price cells flash green or red for 650 ms whenever the simulated price updates, making live price movement immediately visible without scanning the whole table.
- **Order Placement (Manual) — Change % badge on Buy lines** — each Buy order line card now shows a small colored chip (e.g. +1.23%) next to the live price, so the broker can see today's move for every stock in the basket without switching to the market table.
- **Order Placement AI — Execution timestamp** — the post-trade confirmation card footer now shows the exact time the orders were placed (e.g. 03:45:22 PM), right-aligned next to the CRM log note.
- **Order Placement AI — Live direction dot on holdings** — each symbol in the Top Holdings list now has a glowing green or red dot to its left, updated every price tick, showing at a glance which positions are up or down on the day.
- **Order Placement AI — VIP toggle** — the ★ VIP button in the verified-client header now toggles correctly: click to promote a client to VIP (gold star, gold badge), click again to remove VIP status. Changes reflect immediately in the client picker and the VIP quick-open strip. Matches the behaviour of the manual Order Placement desk.

## v3.3.6

- **Order Placement AI — post-trade card lifecycle** — "Orders executed" now shows immediately after placement, hides while the broker edits the basket for a second batch, and reappears with updated numbers after the second placement. Each submission re-animates the card with a fresh pop-in.
- **Order Placement AI — re-submit flow** — after placing, modifying any order qty, side, or adding a new line re-enables the AI review card and Place button so the broker can submit a second batch without resetting the session.
- **Order Placement AI — Buy/Sell basket headers** — the basket section headers now use the same diagonal gradient as the main Order Placement panels (blue for buys, red for sells) with larger, bolder text.
- **Order Placement AI — "Stronger alternative" tag** — the tag chip is now inline with the headline text so it always sits on one line regardless of column width.
- **Order Placement AI — What to pitch improvements** — advisory is now risk-aware: Conservative clients get a wider take-profit window and only see low-volatility momentum ideas; Aggressive/Institutional clients get more sensitive signals. New "Buy the dip" idea fires when a stock the client regularly trades pulls back on the day. "Stronger alternative" now scans all usual stocks (not just the first) and avoids duplicate targets.

## v3.3.5

- **Order Placement AI — post-trade card fix** — the "Orders executed" confirmation card is now always fully visible at any window size. Root cause was the review card filling the column height and squishing the confirmation card to just its top border (a green line). Fix: the review card is now hidden once orders are placed, the post-trade card takes its place, and `shrink-0` prevents WebKit from compressing it regardless of window height.

## v3.3.4

- **Order Placement — stat chip strip** — the Risk / KYC / Day P&L / Positions / Since row is now a row of colored badge chips: Risk in blue, KYC in green/amber, Day P&L in green/red, positions and tenure in neutral glass chips. Instantly scannable at a glance.
- **Order Placement — last-trade tags** — the portfolio footer now shows the last Buy and Sell as colored arrow-tagged pills (green ↑ Buy / red ↓ Sell) instead of plain text.
- **Order Placement — Market Watch price** — the selected stock price bumps up to 22px bold black with the change displayed as a colored chip badge instead of bare text.
- **Order Placement — Place Buy / Sell buttons** — both CTA buttons are now taller, full-width gradient. The Buy button breathes a continuous blue glow pulse; the Sell button pulses red the moment a sell quantity is entered.
- **Order Placement — portfolio row alternation** — every other holdings row gets a hairline tint for faster scanning.
- **Order Placement AI — Field cards** — the client snapshot fields (CIF, Risk, KYC, Day P&L, Available cash, Portfolio MV) each get a subtle frosted card background with a blue ring outline and a 1 px upward lift on hover.
- **Order Placement AI — Advisory pitch cards** — each "What to pitch" idea now has a colored vertical left border (green for buy, red for sell, blue for switch) and a Sparkle-prefixed "Use this pitch" button.
- **Order Placement AI — Top holdings mini-bars** — the client's top 4 holdings each show a proportional gradient bar beneath the symbol/quantity row.
- **Order Placement AI — Post-trade confirmation** — the execution block has a dark green ambient glow, a gradient header with a circle-check icon, and a three-column stat grid (Buys / Sells / Net cash) with 19 px bold numbers. The card springs in with a pop animation on placement and auto-scrolls into view so the full card is always visible at any window size.
- **Order Placement AI — Voice match bars** — the voice-analysis bars are taller, sit on a frosted blue background, and glow blue during the analysis phase; the match percentage appears as a large 22 px green number in a highlighted card.
- **Order Placement AI — Place orders button** — pulses a blue glow when the basket is clear to place.

## v3.3.3

- **Order Placement — stat chip strip** — the Risk / KYC / Day P&L / Positions / Since row is now a row of colored badge chips: Risk in blue, KYC in green/amber, Day P&L in green/red, positions and tenure in neutral glass chips. Instantly scannable at a glance.
- **Order Placement — last-trade tags** — the portfolio footer now shows the last Buy and Sell as colored arrow-tagged pills (green ↑ Buy / red ↓ Sell) instead of plain text.
- **Order Placement — Market Watch price** — the selected stock price bumps up to 22px bold black with the change displayed as a colored chip badge instead of bare text.
- **Order Placement — Place Buy / Sell buttons** — both CTA buttons are now taller, full-width gradient. The Buy button breathes a continuous blue glow pulse; the Sell button pulses red the moment a sell quantity is entered.
- **Order Placement — portfolio row alternation** — every other holdings row gets a hairline tint for faster scanning.
- **Order Placement AI — Field cards** — the client snapshot fields (CIF, Risk, KYC, Day P&L, Available cash, Portfolio MV) each get a subtle frosted card background with a blue ring outline and a 1 px upward lift on hover.
- **Order Placement AI — Advisory pitch cards** — each "What to pitch" idea now has a colored vertical left border (green for buy, red for sell, blue for switch) and a Sparkle-prefixed "Use this pitch" button.
- **Order Placement AI — Top holdings mini-bars** — the client's top 4 holdings each show a proportional gradient bar beneath the symbol/quantity row.
- **Order Placement AI — Post-trade confirmation** — the execution block has a dark green ambient glow, a gradient header with a circle-check icon, and a three-column stat grid (Buys / Sells / Net cash) with 19 px bold numbers. The card springs in with a pop animation on placement and auto-scrolls into view so the full card is always visible at any window size.
- **Order Placement AI — Voice match bars** — the voice-analysis bars are taller, sit on a frosted blue background, and glow blue during the analysis phase; the match percentage appears as a large 22 px green number in a highlighted card.
- **Order Placement AI — Place orders button** — pulses a blue glow when the basket is clear to place.

## v3.3.1

- **Deeper visual polish on Order Placement** — client cards gain a circular initials avatar with a blue glow, gradient dark header, larger bold name, and a ringed SIF badge. Available balance becomes a two-stat bar (balance + CASA side-by-side in large type). Buy/Sell panel headers are taller with gradient fills and bold tracked uppercase labels. Portfolio section has a gradient header strip. Market Watch stock quote card uses a blue-tinted border with a soft glow. Active client tabs get a subtle blue inner-top highlight.
- **Deeper visual polish on Order Placement AI** — all section cards gain a layered shadow and inset top glow. AI transcript messages are bordered blue-tinted pills; Broker bubbles use a blue gradient ring; Client bubbles use a subtle white ring on dark. The Place order button pulses blue when ready. Verified client header gets a green gradient wash. Connecting state shows an animated pulse dot.
- **Fixed CI: macOS runner pinned to macos-15** — `macos-latest` migrated to macOS 26 on June 15 2026, breaking the Tauri build. Runner is now pinned to `macos-15`; step conditions updated to `contains(matrix.platform, 'macos')` so they survive future runner label changes.

## v3.3.0

- **Order Placement — distinct "Precision Trading Terminal" identity** — a branded `ORDER PLACEMENT` label with a blue vertical accent bar appears in the toolbar; the toolbar itself uses a deeper, dedicated background. Market Watch panel gains a blue top stripe and a live data indicator dot. Each client section gets a solid blue left-edge accent bar. The available balance area has a subtle blue tint, reinforcing the precision-desk feel.
- **Order Placement AI — distinct "AI Command Center" identity** — the page uses a cooler, deeper dark background (`#07090e`) that sets it apart from every other screen. The toolbar has a blue-gradient look with an animated "AI Active" pulse badge. All section cards switch from generic gray borders to AI-blue–tinted borders with a darker card background. Section labels ("Verify & open client", "Client request") gain a glowing blue left accent bar and are rendered in AI blue. The live call transcript is now a distinct dark panel with a stronger blue frame, a tinted header, and a "REC" recording indicator.

## v3.2.9

- **Live transcript streams letter-by-letter** — every new message from Broker, Client or AI in the Order Placement AI call transcript now appears character-by-character (like ChatGPT streaming), with a blinking cursor while it types. Messages already loaded from a saved session show instantly.
- **Watchlist aligned with Most Active** — Watchlist is now the same height as Most Active (both 6 rows), removing the 1-row gap between them in the default Graph layout. Layout key bumped to v8 so the corrected default applies.

## v3.2.8

- **Caller verification animation in Order Placement AI** — selecting a caller now plays a 2.5-second verification sequence before the profile appears: a caller-ID sweep bar fills instantly to confirm the number match, then a 9-bar voice waveform animates like a Siri/Claude voice visualiser while the voiceprint is analysed (bars pulse up and down at staggered speeds), and finally the bars collapse green with the match percentage before the full profile loads.

## v3.2.7

- **Fixed blank scroll space — actual root cause found** — the resize handles on each panel (n/s/e/w edges) were being rotated 45°–135° by the default react-resizable CSS. A 14px-tall handle that's 1200px wide, rotated 45°, has an 850px bounding box that sticks far below the grid. This inflated the grid's scroll height from ~1944px to ~2515px — the ~570px difference was the blank space. Fixed by forcing `transform: none` and correct positioning with `!important` (needed because the library CSS loads after our styles in Vite's bundle).

## v3.2.6

- **Fixed blank scroll space below Time & Sales (root cause)** — the saved layout was loaded as-is, without compacting. If panels had been dragged so that Time & Sales sat a few rows below the panels above it, those empty rows were real grid height (invisible but scrollable), and making Time & Sales taller only extended below the gap rather than filling it. Now the layout is compacted on every load — all gaps are closed before the grid renders. Any unknown panel IDs in a saved layout (which inflate grid height with no visible content) are also stripped on load.

## v3.2.5

- **Order Basket buy/sell colors stronger** — the Buy and Sell sections in Order Placement AI now use the same bold visual treatment as classic Order Placement: 2px solid blue/red border, solid color header bar, white text on the header. The weaker translucent style is replaced with unmistakable colour.

## v3.2.4

- **Fixed vertical blank scroll at the bottom** — macOS WKWebView's rubber-band momentum scroll was letting the view bounce past the last panel. `overscroll-behavior: none` disables the bounce, so scroll stops exactly at Time & Sales.
- **Fixed horizontal scroll when dragging a panel to the right edge** — with the grid unbounded, dragging a panel past the right column temporarily placed it outside the grid, triggering scroll. Panels are now bounded to the grid so they can't escape the right (or left) edge.

## v3.2.3

- **Fixed vertical blank space when scrolling** — three-part fix: document scroll locked to viewport so the body can never grow; `y: Infinity` panel placement replaced with a calculated bottom row so the grid never temporarily inflates to a huge height; saved layouts with invalid `y` values (from prior sessions) are auto-discarded and reset to default.
- **Fixed horizontal scroll / blank space on the right** — grid measures its container width correctly; horizontal overflow is clipped.
- **Order Basket redesigned** — Buy and Sell orders now appear in separate coloured sections (blue for Buy, red for Sell), each with a live sub-total in the header. Separate ＋ Buy and ＋ Sell buttons; a ↓ / ↑ arrow moves a line between sections instantly.

## v3.2.2

## v3.2.1

- **News panel back beside the chart** — News is restored to the top-right of the Graph terminal, alongside the price chart, at the same height.
- **All 8 resize handles** — every panel can now be resized from any edge or corner, not just the bottom-right. Corners show a clean 2-line diagonal grip that turns blue on hover.
- **Mac shortcuts show fn keys** — the shortcut bar and help overlay now show "fn F1", "fn F5", etc. on macOS (where F-keys require the fn modifier by default).
- **Fixed blank scroll space** — a corrupted saved layout could cause a large blank area below the last panel. Now caught and replaced with the default layout automatically.

## v3.2.0

- **Free 2D panel layout** — graph panels now use a proper grid engine (react-grid-layout). Drag any panel to any position, resize from any edge. Nothing moves unless you move it — no automatic reshuffling.
- **New default layout** — Indices is now 3 rows tall with Sector Performance stacked directly below it, eliminating the blank space in the left column.
- **Apple Silicon + Intel Mac support** — both ARM (M1/M2/M3) and Intel Mac builds ship in every release. The updater now reliably detects which build your Mac needs and installs the correct version.
- **Fixed update race condition** — in-app updates no longer show "platform not found" errors on Intel Macs.

## v3.1.7

- **Stable panel layout when resizing** — resizing a panel's height no longer causes other panels to jump or reorganise. Panels stay in their defined order; only the resized panel changes size.

## v3.1.6

- **Vertical panel resize** — drag the bottom edge of any graph panel to shrink or grow its height. Reclaim blank space in panels like Indices or Market Breadth and fill it with panels below. Heights are saved and restored across sessions.

## v3.1.5

- **Fixed text selection during panel drag** — dragging a panel header no longer highlights text across the screen. Clicking to select or copy text in panels still works normally.

## v3.1.4

- **Fixed macOS drag opening board window** — dragging a panel to reorder it on Mac was incorrectly triggering "tear out to board" due to a coordinate system difference in macOS WebView. Panels now reposition correctly on Mac, matching Windows behaviour.

## v3.1.3

- **Client tabs reorder reliably on macOS** — the Order Placement client tabs now drag-reorder with pointer events (matching the graph panels), instead of HTML5 drag-and-drop which is unreliable in the Mac WebView. This removes the last drag interaction that could misbehave on Mac.

## v3.1.2

- **Opens full-screen on sign-in** — after you log in, the desk window maximises to fill the screen.
- Detached market-tab windows now get the same permissions as the main window (live data + updates).

## v3.1.1

- **News "Related" now shows only the selected symbol.** Pick Emaar → Related shows Emaar stories only; **All** still shows every headline. (Previously Related also appended "More headlines".)
- **macOS: reliable panel dragging.** The Graph terminal's drag-to-reorder is rewritten to use pointer events instead of HTML5 drag-and-drop, which is unreliable in macOS's WebView — so dragging panels (and dragging one off to the board) works on Mac.
- **Pop-out windows stay on top.** The Workspace board and the Order Placement / Order Placement · AI / panel windows now float above the main window, so they no longer disappear behind it when you click back into the main program.

## v3.1.0

- **"FAB Trade" everywhere** — the app is now named FAB Trade at the OS level too (window title, taskbar/dock, and installer), completing the rebrand. **This is the build to install** for demos.
- Includes the in-app updater from v3.0.1, so every later version installs with one click from inside the app.

## v3.0.1

- **In-app updater** — a branded "Check for updates" dialog (user menu) that shows the current version, checks GitHub, displays the new version + notes, and **downloads, installs and relaunches inside the app** with a progress bar — replacing the native OS prompts.
- Releases now **publish automatically**, so a pushed update is immediately available to installed apps.

## v3.0.0

### Rebrand & sign-in
- **FAB Trade** — the terminal is rebranded from "TRADENET X" across the app.
- **Sign-in screen** — a branded login (Broker ID + password) on launch, with **Sign out** in the user menu. Prototype: any credentials continue.

### Order Placement · AI (new)
An AI-assisted sibling of Order Placement (nav **Trading › Process**, hotkey **⇧F5**, or its own window). The broker always confirms and executes; AI removes the busywork.
- **Caller verification** — matches the inbound number to the CIF and checks a voiceprint, shown live.
- **Live call transcript** — a natural broker/client conversation that plays out turn-by-turn; the order basket and review appear in step with it.
- **Multi-order baskets** — parse "buy 100k Emaar, 50k DIB and sell 30k SALIK" into editable buy/sell lines; add/remove lines by hand.
- **AI review & checks** — market context, an order-type recommendation, portfolio impact, risk alerts, compliance, and **buying power across the whole basket** (net of sells). Blocking issues disable placement.
- **CASA top-up** — when short on cash, the broker asks the client and moves the shortfall from CASA to clear it.
- **What to pitch** — live advisory: take-profit / momentum from the client's holdings, plus a stronger alternative once there's a request.
- **Two demo calls** — a fully-funded rebalance (buys + sells) and a short-funds call that needs CASA.
- **Responsive** — a 3-column window layout that switches to a stacked design when docked narrow (and back when widened).

### Order Placement (classic)
- Opens **blank**; a **CIF autocomplete** over an expanded book of **12 demo clients**.
- **Browser-style client tabs** — drag to reorder, middle-click to close, and **pin** clients to keep them.
- **VIP toggle** per client, a **Market Watch** show/hide, and clearer wording ("Add line", "Enter CIF…").

### Graph terminal
- **Hide any panel** (e.g. Indices, Market Breadth) and bring hidden ones back from **"Add panel"** in the header.
- **Drag panels by the title bar** to reorder — reliable, with panel controls shown as buttons.
- Interactive, responsive price chart with an OHLC crosshair; gap-free default layout.

### Markets & app
- **DFM (real-time) / ADX (simulated)** market selector and **market-bound tabs**; the **Detailed view now follows the active tab's market** too.
- **Clean custom scrollbars**, wider Order Placement windows, docked-board resize, and an in-app **"Check for updates"**.

## v2.5.0

### Graph view (Securities Terminal)
- **News prioritised** into the top row next to the chart (no longer buried at the bottom).
- **Contextual news** — selecting a symbol surfaces a "Related to <symbol>" section; searching a company (e.g. Emaar, Talabat) shows its stories first.
- **Clickable news** — opens a right-side detail overlay with source, time, sentiment, summary, full story and related symbols.
- **News All / Related toggle**, plus a cleaner news layout (sentiment dots, source + category tags, symbol chips).
- **Interactive, responsive chart** — the price chart fills the panel width, reflows on resize, and has a hover crosshair with an O/H/L/C tooltip (no more stretched candles/numbers).
- **Gap-free default layout** and panels can now be resized down to 2/12 columns.

### Markets & tabs
- **Market selector** next to the live pill: **DFM** (real-time) or **ADX** (simulated); the terminal's data and badges follow it.
- **Market-bound tabs** — DFM and ADX open by default; the **+** button opens a market picker for a new tab.

### Workspace board
- Panels sent to the board arrive **full-size** instead of tiny.
- **Single-frame** panels (no more "box inside a box") with hover drag/close controls.
- **Resizable docked board** — drag its inner edge to shrink/grow.
- Docking a second board **asks** to replace or add alongside (de-duplicated).
- **"Open in window"** now opens a real native window; **Order Placement** can dock back to main.

### Order Placement (formerly "Broker Flow")
- Renamed to **Order Placement**; opens **blank** (no client pre-loaded).
- **CIF autocomplete** over an expanded book of 12 demo clients — type a number/name to select; "Add all" when several match.
- **Browser-style client tabs** — drag to reorder, middle-click to close, smart close-focus, and **pinning** to keep key clients anchored.
- **VIP toggle** per client (manual flag) — the Quick row lists VIP clients only.
- **Market Watch show/hide** toggle; when docked it stacks on top with the CIF area below.
- Clearer wording (removed redundant "customer CIF").

### App
- **Clean custom scrollbars** app-wide (slim, rounded, theme-matched).
- **"Check for updates…"** in the user menu — checks GitHub, prompts to download, and restarts.
