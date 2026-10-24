import { readFileSync, writeFileSync, existsSync } from 'fs';

/**
 * Load ledger data from JSON file
 * Returns { rows: [] } if file doesn't exist
 */
export function load(path) {
  if (!existsSync(path)) {
    return { rows: [] };
  }
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content);
}

/**
 * Save ledger data to JSON file atomically
 */
export function save(path, data) {
  const content = JSON.stringify(data);
  writeFileSync(path, content, 'utf8');
}
