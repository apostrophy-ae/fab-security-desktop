// Self-update check for the LC PeakPerf desktop app.
//
// On startup (Tauri only) we ask GitHub Releases whether a newer signed build
// exists. If so, we show a native "Update available — install now?" prompt.
// If the user accepts, we download + install the update and relaunch the app.
//
// In a normal browser (dev in Vite, or the web build) this is a no-op.
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { ask, message } from '@tauri-apps/plugin-dialog'

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function checkForUpdates(options: { silent?: boolean } = {}) {
  if (!isTauri) return

  try {
    const update = await check()

    if (!update) {
      // Only surface "you're up to date" when the user asked manually.
      if (!options.silent) {
        await message('You are running the latest version.', {
          title: 'FAB x Trade',
          kind: 'info',
        })
      }
      return
    }

    const install = await ask(
      `Version ${update.version} is available (you have ${update.currentVersion}).\n\n` +
        `${update.body ?? ''}\n\nInstall it now? The app will restart.`,
      { title: 'Update available', kind: 'info', okLabel: 'Install', cancelLabel: 'Later' },
    )

    if (!install) return

    await update.downloadAndInstall()
    await relaunch()
  } catch (err) {
    console.error('[updater] check failed:', err)
    if (!options.silent) {
      await message(`Could not check for updates.\n\n${String(err)}`, {
        title: 'Update check failed',
        kind: 'error',
      })
    }
  }
}
