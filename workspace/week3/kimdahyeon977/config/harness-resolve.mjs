// Resolve @deepseek-ai/* from the local harness checkout so the plugins and
// presets in this folder import packages by name, as a published plugin would.
// Use: node --import ./config/harness-resolve.mjs ...  (DSH_HARNESS overrides the checkout path)
import { register } from 'node:module'
import { isMainThread } from 'node:worker_threads'
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const harness = resolve(process.env.DSH_HARNESS ?? join(dirname(fileURLToPath(import.meta.url)), '../../../../deepseek-harness'))

if (isMainThread) register(import.meta.url, import.meta.url)

let dirs
function packageDir(name) {
  if (!dirs) {
    dirs = new Map()
    const roots = [join(harness, 'vendor'), ...readdirSync(join(harness, 'packages'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => join(harness, 'packages', d.name))]
    for (const root of roots) for (const d of readdirSync(root)) {
      const manifest = join(root, d, 'package.json')
      if (existsSync(manifest)) dirs.set(JSON.parse(readFileSync(manifest, 'utf8')).name, join(root, d))
    }
  }
  return dirs.get(name)
}

export async function resolve_(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context) }
  catch (error) {
    const name = specifier.match(/^@deepseek-ai\/[^/]+/)?.[0]
    const dir = name && packageDir(name)
    if (!dir) throw error
    // Self-reference: resolve the package name from inside its own directory.
    return nextResolve(specifier, { ...context, parentURL: pathToFileURL(join(dir, 'package.json')).href })
  }
}
export { resolve_ as resolve }
