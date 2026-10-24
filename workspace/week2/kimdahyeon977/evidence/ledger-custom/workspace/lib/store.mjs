import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export function loadStore(filePath) {
  if (!existsSync(filePath)) {
    return { rows: [] };
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    return data;
  } catch (err) {
    throw new Error(`Failed to load store: ${err.message}`);
  }
}

export function saveStore(filePath, store) {
  try {
    const content = JSON.stringify(store);
    writeFileSync(filePath, content, 'utf8');
  } catch (err) {
    throw new Error(`Failed to save store: ${err.message}`);
  }
}
