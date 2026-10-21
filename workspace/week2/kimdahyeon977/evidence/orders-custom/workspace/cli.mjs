#!/usr/bin/env node

import { parseCommand } from './lib/command.mjs';
import { loadStore, saveStore } from './lib/storage.mjs';
import { buildState } from './lib/state.mjs';
import {
  handleProductAdd,
  handleProductList,
  handleOrderCreate,
  handleOrderGet,
  handleOrderList,
  handleOrderPay,
  handleOrderCancel,
  handleAudit
} from './lib/handlers.mjs';

const ORDER_FILE = process.env.ORDER_FILE;
const ORDER_FAILPOINT = process.env.ORDER_FAILPOINT;

try {
  const args = process.argv.slice(2);
  const command = parseCommand(args);
  
  // Load store and build state
  let store = loadStore(ORDER_FILE);
  const state = buildState(store.events);
  
  let result;
  let newEvent = null;
  
  // Execute command
  switch (command.type) {
    case 'product.add':
      ({ result, event: newEvent } = handleProductAdd(command, state));
      break;
    case 'product.list':
      result = handleProductList(state);
      break;
    case 'order.create':
      ({ result, event: newEvent } = handleOrderCreate(command, state));
      break;
    case 'order.get':
      result = handleOrderGet(command, state);
      break;
    case 'order.list':
      result = handleOrderList(state);
      break;
    case 'order.pay':
      ({ result, event: newEvent } = handleOrderPay(command, state));
      break;
    case 'order.cancel':
      ({ result, event: newEvent } = handleOrderCancel(command, state));
      break;
    case 'audit':
      result = handleAudit(state);
      break;
    default:
      throw new Error(`Unknown command type: ${command.type}`);
  }
  
  // Save if there's a new event
  if (newEvent) {
    if (ORDER_FAILPOINT === 'before_commit') {
      throw new Error('Failpoint before_commit triggered');
    }
    store.events.push(newEvent);
    saveStore(ORDER_FILE, store);
  }
  
  // Output result
  console.log(JSON.stringify(result));
  process.exit(0);
  
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
