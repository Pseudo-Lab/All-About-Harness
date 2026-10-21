import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

/**
 * JSON persistence with input-safe writes.
 * Maintains isolation per PLAN_FILE.
 */
export class Store {
  constructor(path) {
    this.path = path;
  }

  /**
   * Load data from storage, returns undefined if file doesn't exist.
   */
  load() {
    if (!existsSync(this.path)) {
      return undefined;
    }
    const content = readFileSync(this.path, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Save data to storage with atomic-like write.
   * Creates parent directories if needed.
   */
  save(data) {
    const dir = dirname(this.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    // Write valid JSON
    const json = JSON.stringify(data, null, 2);
    writeFileSync(this.path, json, 'utf8');
  }
}
