#!/usr/bin/env node
/**
 * Run Capacitor CLI against customer (default) or DP config.
 * Capacitor 6 only loads capacitor.config.ts — we temporarily swap for DP.
 *
 * Usage: node scripts/run-cap.mjs <user|dp> <cap-args...>
 * Example: node scripts/run-cap.mjs dp sync android
 */
import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const target = process.argv[2]
const capArgs = process.argv.slice(3)

if (!target || !['user', 'dp'].includes(target) || capArgs.length === 0) {
  console.error('Usage: node scripts/run-cap.mjs <user|dp> <cap args...>')
  process.exit(1)
}

const mainConfig = resolve(root, 'capacitor.config.ts')
const dpConfig = resolve(root, 'capacitor.dp.config.ts')
const bak = resolve(root, '.capacitor.config.ts.bak')

let swapped = false

function restore() {
  if (!swapped) return
  try {
    if (existsSync(bak)) {
      copyFileSync(bak, mainConfig)
      unlinkSync(bak)
    }
  } catch (e) {
    console.error('Failed to restore capacitor.config.ts:', e)
  }
  swapped = false
}

process.on('exit', restore)
process.on('SIGINT', () => {
  restore()
  process.exit(130)
})
process.on('SIGTERM', () => {
  restore()
  process.exit(143)
})

if (target === 'dp') {
  copyFileSync(mainConfig, bak)
  copyFileSync(dpConfig, mainConfig)
  swapped = true
}

const result = spawnSync('npx', ['cap', ...capArgs], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
})

restore()
process.exit(result.status ?? 1)
