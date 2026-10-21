#!/usr/bin/env node

import { load, save } from './lib/store.mjs';
import * as inventory from './lib/inventory.mjs';

const storePath = process.env.INVENTORY_FILE;
if (!storePath) {
  console.error('INVENTORY_FILE environment variable is required');
  process.exit(1);
}

const args = process.argv.slice(2);

function main() {
  try {
    const [command, subcommand, ...params] = args;
    
    if (!command) {
      throw new Error('Command required');
    }
    
    let result;
    let needsSave = false;
    
    if (command === 'item') {
      if (subcommand === 'add') {
        if (params.length !== 2) {
          throw new Error('item add requires SKU and NAME');
        }
        const state = load(storePath);
        result = inventory.addItem(state, params[0], params[1]);
        save(storePath, state);
      } else if (subcommand === 'list') {
        if (params.length !== 0) {
          throw new Error('item list takes no arguments');
        }
        const state = load(storePath);
        result = inventory.listItems(state);
      } else {
        throw new Error(`Unknown item subcommand: ${subcommand}`);
      }
    } else if (command === 'stock') {
      if (subcommand === 'receive') {
        if (params.length !== 2) {
          throw new Error('stock receive requires SKU and QTY');
        }
        const state = load(storePath);
        result = inventory.receiveStock(state, params[0], params[1]);
        save(storePath, state);
      } else if (subcommand === 'reserve') {
        if (params.length !== 2) {
          throw new Error('stock reserve requires SKU and QTY');
        }
        const state = load(storePath);
        result = inventory.reserveStock(state, params[0], params[1]);
        save(storePath, state);
      } else if (subcommand === 'release') {
        if (params.length !== 2) {
          throw new Error('stock release requires SKU and QTY');
        }
        const state = load(storePath);
        result = inventory.releaseStock(state, params[0], params[1]);
        save(storePath, state);
      } else if (subcommand === 'ship') {
        if (params.length !== 2) {
          throw new Error('stock ship requires SKU and QTY');
        }
        const state = load(storePath);
        result = inventory.shipStock(state, params[0], params[1]);
        save(storePath, state);
      } else if (subcommand === 'report') {
        if (params.length !== 0) {
          throw new Error('stock report takes no arguments');
        }
        const state = load(storePath);
        result = inventory.generateReport(state);
      } else {
        throw new Error(`Unknown stock subcommand: ${subcommand}`);
      }
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
    
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
