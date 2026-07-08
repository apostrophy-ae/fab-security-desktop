import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Sign-in screen for the LC…PeakPerf / TRADENET X desktop terminal.
 *
 * Prototype only: there is no backend. Any non-empty Broker ID + password
 * signs in and opens the trading desk. Nothing is sent anywhere or stored
 * beyond a session flag used to skip the screen until sign-out.
 */
export default function Login() {
  const navigate = useNavigate()
  const [brokerId, setBrokerId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [touched, setTouched] = useState(false)

  const canSubmit = brokerId.trim() !== '' && password.trim() !== ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!canSubmit) return
    sessionStorage.setItem('lc-auth', '1')
    // Open the desk maximised (fills the screen) on sign-in.
    if ('__TAURI_INTERNALS__' in window) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().maximize()
      } catch { /* not fatal */ }
    }
    navigate('/trading?tab=dfm', { replace: true })
  }

  return (
    <div className="flex min-h-screen w-full bg-page text-content">
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <aside className="relative hidden w-[46%] max-w-[620px] flex-col justify-between overflow-hidden bg-[#0b1b4d] p-10 lg:flex">
        {/* Decorative grid + rising line */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]" aria-hidden>
          <defs>
            <pattern id="loginGrid" width="34" height="34" patternUnits="userSpaceOnUse">
              <path d="M34 0H0V34" fill="none" stroke="#5b9bff" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginGrid)" />
        </svg>
        <svg className="pointer-events-none absolute bottom-0 left-0 right-0" height="220" viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="loginArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5b9bff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5b9bff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 180 L80 160 L150 168 L220 120 L300 132 L380 78 L460 96 L540 44 L600 60 L600 220 L0 220 Z" fill="url(#loginArea)" />
          <path d="M0 180 L80 160 L150 168 L220 120 L300 132 L380 78 L460 96 L540 44 L600 60" fill="none" stroke="#5b9bff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>

        <div className="relative">
          <div className="text-[26px] font-bold tracking-tight text-white">
            FAB <span className="text-[#5b9bff] font-light">x</span> Trade
          </div>
        </div>

        <div className="relative">
          <h2 className="max-w-[24ch] text-[26px] font-semibold leading-tight text-white">
            The broker's desk for DFM &amp; ADX — pricing, orders and clients in one place.
          </h2>
          <div className="mt-6 flex gap-6">
            {[
              ['Live', 'DFM pricing'],
              ['Multi-client', 'order desk'],
              ['One-click', 'workspace boards'],
            ].map(([a, b]) => (
              <div key={a}>
                <div className="text-[15px] font-semibold text-[#9cc0ff]">{a}</div>
                <div className="text-[11px] text-white/50">{b}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-white/40">
          <span className="inline-block size-1.5 rounded-full bg-up shadow-[0_0_6px_rgba(47,208,122,0.8)]" />
          Secured session · BANKFAB
        </div>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-[380px]">
          <div className="mb-8 lg:hidden">
            <div className="text-[22px] font-bold tracking-tight">
              FAB <span className="text-[#5b9bff] font-light">x</span> Trade
            </div>
          </div>

          <h1 className="text-[20px] font-semibold text-content">Sign in</h1>
          <p className="mt-1 text-[13px] text-content-muted">Access your trading desk</p>

          <div className="mt-7 flex flex-col gap-4">
            {/* Broker ID */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-content-muted">Broker ID</span>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
                <input
                  autoFocus
                  value={brokerId}
                  onChange={(e) => setBrokerId(e.target.value)}
                  placeholder="e.g. broker08"
                  autoComplete="username"
                  className="h-11 w-full rounded-lg border border-border-dark bg-[#15171a] pl-9 pr-3 text-[14px] text-content outline-none transition-colors placeholder:text-content-subtle focus:border-action"
                />
              </div>
            </label>

            {/* Password */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-content-muted">Password</span>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-11 w-full rounded-lg border border-border-dark bg-[#15171a] pl-9 pr-10 text-[14px] text-content outline-none transition-colors placeholder:text-content-subtle focus:border-action"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  title={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-content-subtle hover:text-content"
                >
                  {showPw ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-content-muted">
                <input type="checkbox" className="size-3.5 accent-[#0062ff]" defaultChecked />
                Keep me signed in
              </label>
              <button type="button" className="text-[12px] text-[#5b9bff] hover:underline" onClick={(e) => e.preventDefault()}>
                Forgot password?
              </button>
            </div>

            {touched && !canSubmit && (
              <div className="rounded-md border border-[rgba(255,107,114,0.4)] bg-offer-surface px-3 py-2 text-[12px] text-down">
                Enter your Broker ID and password to continue.
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-1 h-11 rounded-lg bg-action text-[14px] font-semibold text-white transition-colors hover:bg-[#1d72ff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sign in
            </button>
          </div>

          <p className="mt-6 text-center text-[11px] text-content-subtle">
            Prototype build — use any Broker ID &amp; password to continue.
          </p>
        </form>
      </div>
    </div>
  )
}
