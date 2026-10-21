import { existsSync, readFileSync, writeFileSync } from 'fs';

export function load(filePath) {
  if (!existsSync(filePath)) {
    return { items: [] };
  }
  const content = readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

export function save(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data), 'utf8');
}
