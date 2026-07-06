# Changelog

## v3.1.8

- **Free 2D panel layout** — graph panels now use a proper grid engine (react-grid-layout). Drag any panel to any position, resize from any edge. Nothing moves unless you move it — no automatic reshuffling.
- **New default layout** — Indices is now 3 rows tall with Sector Performance stacked directly below it, eliminating the blank space in the left column.

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
