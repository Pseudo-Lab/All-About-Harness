import { readFileSync, writeFileSync, existsSync, unlinkSync, renameSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';

export function loadStore(filePath) {
  if (!filePath) {
    throw new Error('ORDER_FILE environment variable not set');
  }
  
  if (!existsSync(filePath)) {
    return { version: 1, events: [] };
  }
  
  const content = readFileSync(filePath, 'utf8');
  let store;
  
  try {
    store = JSON.parse(content);
  } catch (e) {
    throw new Error('Store is corrupted: invalid JSON');
  }
  
  if (!store || typeof store !== 'object' || store.version !== 1 || !Array.isArray(store.events)) {
    throw new Error('Store is corrupted: invalid structure');
  }
  
  // Validate event sequence
  for (let i = 0; i < store.events.length; i++) {
    if (!store.events[i] || store.events[i].seq !== i + 1) {
      throw new Error('Store is corrupted: invalid event sequence');
    }
  }
  
  return store;
}

export function saveStore(filePath, store) {
  const content = JSON.stringify(store);
  
  // Atomic write: write to temp file in same directory then rename
  const dir = dirname(filePath);
  const tmpFile = join(dir, `.orders-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  
  try {
    writeFileSync(tmpFile, content, 'utf8');
    renameSync(tmpFile, filePath);
  } catch (e) {
    // Clean up temp file if it exists
    try {
      if (existsSync(tmpFile)) {
        unlinkSync(tmpFile);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw e;
  }
}
