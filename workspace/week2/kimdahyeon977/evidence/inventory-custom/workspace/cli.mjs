#!/usr/bin/env node

import { readStore, writeStore } from './lib/store.mjs';
import { 
  addItem, 
  listItems, 
  receiveStock, 
  reserveStock, 
  releaseStock, 
  shipStock, 
  generateReport 
} from './lib/inventory.mjs';

const INVENTORY_FILE = process.env.INVENTORY_FILE;

if (!INVENTORY_FILE) {
  console.error('INVENTORY_FILE environment variable is required');
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  
  try {
    const [command, subcommand, ...params] = args;
    
    // Load current state
    const state = await readStore(INVENTORY_FILE);
    
    let result;
    let needsWrite = false;
    
    if (command === 'item' && subcommand === 'add') {
      if (params.length !== 2) {
        throw new Error('item add requires SKU and NAME');
      }
      const [sku, name] = params;
      result = addItem(state, sku, name);
      needsWrite = true;
    } else if (command === 'item' && subcommand === 'list') {
      if (params.length !== 0) {
        throw new Error('item list takes no arguments');
      }
      result = listItems(state);
    } else if (command === 'stock' && subcommand === 'receive') {
      if (params.length !== 2) {
        throw new Error('stock receive requires SKU and QTY');
      }
      const [sku, qty] = params;
      result = receiveStock(state, sku, qty);
      needsWrite = true;
    } else if (command === 'stock' && subcommand === 'reserve') {
      if (params.length !== 2) {
        throw new Error('stock reserve requires SKU and QTY');
      }
      const [sku, qty] = params;
      result = reserveStock(state, sku, qty);
      needsWrite = true;
    } else if (command === 'stock' && subcommand === 'release') {
      if (params.length !== 2) {
        throw new Error('stock release requires SKU and QTY');
      }
      const [sku, qty] = params;
      result = releaseStock(state, sku, qty);
      needsWrite = true;
    } else if (command === 'stock' && subcommand === 'ship') {
      if (params.length !== 2) {
        throw new Error('stock ship requires SKU and QTY');
      }
      const [sku, qty] = params;
      result = shipStock(state, sku, qty);
      needsWrite = true;
    } else if (command === 'stock' && subcommand === 'report') {
      if (params.length !== 0) {
        throw new Error('stock report takes no arguments');
      }
      result = generateReport(state);
    } else {
      throw new Error('Unknown command');
    }
    
    // Write state if needed (before printing result to ensure atomicity)
    if (needsWrite) {
      await writeStore(INVENTORY_FILE, state);
    }
    
    // Print result
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
