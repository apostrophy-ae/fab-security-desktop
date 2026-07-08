import { useEffect, useState } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'

/**
 * In-app "Check for updates" dialog — a branded replacement for the native OS
 * prompts. Shows the current version and walks the flow: check → up to date /
 * update available (with notes) → download & install (with progress) → relaunch.
 */
type Phase = 'idle' | 'checking' | 'available' | 'downloading' | 'uptodate' | 'error'
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export default function UpdaterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [version, setVersion] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [update, setUpdate] = useState<Update | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0) // 0..1

  // Load version + reset state each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setPhase('idle'); setUpdate(null); setError(''); setProgress(0)
    if (inTauri) getVersion().then(setVersion).catch(() => {})
  }, [open])

  const doCheck = async () => {
    if (!inTauri) { setError('Updates are only available in the desktop app.'); setPhase('error'); return }
    setPhase('checking'); setError('')
    try {
      const u = await check()
      if (u) { setUpdate(u); setPhase('available') } else setPhase('uptodate')
    } catch (e) {
      setError(String(e)); setPhase('error')
    }
  }

  const doInstall = async () => {
    if (!update) return
    setPhase('downloading'); setProgress(0)
    try {
      let total = 0
      let got = 0
      await update.downloadAndInstall((ev) => {
        if (ev.event === 'Started') total = ev.data.contentLength ?? 0
        else if (ev.event === 'Progress') { got += ev.data.chunkLength; if (total) setProgress(got / total) }
        else if (ev.event === 'Finished') setProgress(1)
      })
      await relaunch()
    } catch (e) {
      setError(String(e)); setPhase('error')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[440px] max-w-[92%] rounded-2xl border border-border-dark bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Brand + version */}
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#0b1b4d] text-[14px] font-bold text-white">FT</div>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold text-content">FAB <span className="text-[#5b9bff]">Trade</span></div>
            <div className="text-[12px] tabular-nums text-content-muted">Version {version || '—'}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto rounded p-1 text-content-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Status */}
        <div className="mt-5 min-h-[64px]">
          {phase === 'idle' && (
            <p className="text-[13px] leading-relaxed text-content-muted">You're all set up. Check whether a newer version of FAB x Trade is available.</p>
          )}
          {phase === 'checking' && (
            <div className="flex items-center gap-2.5 text-[13px] text-content-muted">
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/20 border-t-[#5b9bff]" />
              Checking for updates…
            </div>
          )}
          {phase === 'uptodate' && (
            <div className="flex items-center gap-2.5 rounded-lg border border-[rgba(47,208,122,0.35)] bg-[rgba(36,161,72,0.08)] px-3 py-3 text-[13px] text-up">
              <span className="grid size-5 place-items-center rounded-full bg-up text-[11px] text-[#0b0c0d]">✓</span>
              You're on the latest version.
            </div>
          )}
          {phase === 'available' && update && (
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[rgba(0,98,255,0.16)] px-2 py-0.5 text-[11px] font-semibold text-[#9cc0ff]">Update available</span>
                <span className="text-[13px] font-semibold text-content">Version {update.version}</span>
                <span className="text-[12px] text-content-muted">(you have {update.currentVersion})</span>
              </div>
              {update.body && (
                <div className="mt-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border-dark bg-[#15171a] p-3 text-[12px] leading-relaxed text-content-muted">
                  {update.body}
                </div>
              )}
            </div>
          )}
          {phase === 'downloading' && (
            <div>
              <div className="mb-2 flex items-center justify-between text-[12px] text-content-muted">
                <span>Downloading &amp; installing…</span>
                <span className="tabular-nums">{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#15171a]">
                <div className="h-full rounded-full bg-action transition-[width] duration-150" style={{ width: `${Math.max(4, progress * 100)}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-content-subtle">The app will restart automatically when it's done.</p>
            </div>
          )}
          {phase === 'error' && (
            <div className="rounded-lg border border-[rgba(255,107,114,0.4)] bg-offer-surface px-3 py-3 text-[12px] leading-relaxed text-down">
              Couldn't complete the update.<br />{error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end gap-2">
          {(phase === 'idle' || phase === 'uptodate' || phase === 'error') && (
            <button onClick={doCheck} className="inline-flex items-center gap-1.5 rounded-md bg-action px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d72ff]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
              Check for updates
            </button>
          )}
          {phase === 'checking' && (
            <button disabled className="rounded-md bg-action px-4 py-2 text-[13px] font-semibold text-white opacity-60">Checking…</button>
          )}
          {phase === 'available' && (
            <>
              <button onClick={onClose} className="rounded-md px-3 py-2 text-[13px] font-medium text-content-muted hover:text-content">Later</button>
              <button onClick={doInstall} className="rounded-md bg-action px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d72ff]">Download &amp; install</button>
            </>
          )}
          {phase === 'downloading' && (
            <button disabled className="rounded-md bg-action px-4 py-2 text-[13px] font-semibold text-white opacity-60">Installing…</button>
          )}
        </div>
      </div>
    </div>
  )
}
