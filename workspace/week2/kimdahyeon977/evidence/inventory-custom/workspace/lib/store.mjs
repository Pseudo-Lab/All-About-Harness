import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Read the inventory store from a JSON file.
 * Returns an empty state if the file doesn't exist.
 * @param {string} filePath - Path to the JSON store
 * @returns {Promise<{items: Array}>} The inventory state
 */
export async function readStore(filePath) {
  if (!existsSync(filePath)) {
    return { items: [] };
  }
  
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read store: ${error.message}`);
  }
}

/**
 * Write the inventory store to a JSON file.
 * @param {string} filePath - Path to the JSON store
 * @param {object} state - The inventory state to write
 * @returns {Promise<void>}
 */
export async function writeStore(filePath, state) {
  try {
    const content = JSON.stringify(state);
    await writeFile(filePath, content, 'utf8');
  } catch (error) {
    throw new Error(`Failed to write store: ${error.message}`);
  }
}
