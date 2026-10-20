import { readFile } from 'node:fs/promises';

/** Return the exact Creator function body, including the complete custom loop. */
export async function buildCreatorSource(mode) {
  if (mode === 'official') return readFile(new URL('./creator-official.host.js', import.meta.url), 'utf8');
  if (mode !== 'custom') throw new Error('Unknown controller mode');
  const core = (await readFile(new URL('../plugin/core.mjs', import.meta.url), 'utf8'))
    .replace('export async function runRalph', 'async function runRalph');
  const template = await readFile(new URL('./creator.host.js', import.meta.url), 'utf8');
  if (!template.includes('/*__RALPH_CORE__*/')) throw new Error('Creator loop insertion marker missing');
  return template.replace('/*__RALPH_CORE__*/', core);
}
