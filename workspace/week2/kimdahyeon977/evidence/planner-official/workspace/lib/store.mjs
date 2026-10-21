import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Safe JSON store with atomic writes
 */
export class Store {
  constructor(path) {
    this.path = path;
  }

  /**
   * Read data from store, returns empty structure if file doesn't exist
   */
  read() {
    if (!existsSync(this.path)) {
      return { projects: [], tasks: [], nextProjectId: 1, nextTaskId: 1 };
    }
    const content = readFileSync(this.path, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Write data to store atomically
   */
  write(data) {
    const json = JSON.stringify(data, null, 2);
    writeFileSync(this.path, json, 'utf8');
  }

  /**
   * Check if store exists
   */
  exists() {
    return existsSync(this.path);
  }
}
