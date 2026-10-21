#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ORDER_FILE = process.env.ORDER_FILE;
const ORDER_FAILPOINT = process.env.ORDER_FAILPOINT;

// Validation patterns
const ID_PATTERN = /^[A-Z][A-Z0-9-]{0,15}$/;
const CANONICAL_NUMBER = /^(0|[1-9][0-9]*)$/;

function validateId(value) {
  if (!ID_PATTERN.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return value;
}

function validateStock(value) {
  if (!CANONICAL_NUMBER.test(value)) {
    throw new Error(`Invalid stock: ${value}`);
  }
  const num = parseInt(value, 10);
  if (num < 0 || num > 1000000) {
    throw new Error(`Stock out of range: ${value}`);
  }
  return num;
}

function validatePrice(value) {
  if (!CANONICAL_NUMBER.test(value)) {
    throw new Error(`Invalid price: ${value}`);
  }
  const num = parseInt(value, 10);
  if (num < 1 || num > 1000000000) {
    throw new Error(`Price out of range: ${value}`);
  }
  return num;
}

function validateQty(value) {
  if (!CANONICAL_NUMBER.test(value) || value === '0') {
    throw new Error(`Invalid quantity: ${value}`);
  }
  const num = parseInt(value, 10);
  if (num <= 0) {
    throw new Error(`Quantity must be positive: ${value}`);
  }
  return num;
}

// Load store from disk
function loadStore() {
  if (!existsSync(ORDER_FILE)) {
    return { version: 1, events: [] };
  }
  
  const content = readFileSync(ORDER_FILE, 'utf8');
  const store = JSON.parse(content);
  
  if (store.version !== 1 || !Array.isArray(store.events)) {
    throw new Error('Invalid store format');
  }
  
  return store;
}

// Rebuild state from events
function rebuildState(events) {
  const products = new Map();
  const orders = new Map();
  const paymentKeys = new Map(); // key -> { orderId, outcome, response }
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    // Validate sequence
    if (event.seq !== i + 1) {
      throw new Error(`Event sequence mismatch: expected ${i + 1}, got ${event.seq}`);
    }
    
    switch (event.type) {
      case 'product.add':
        products.set(event.id, {
          sku: event.id,
          stock: event.stock,
          reserved: 0,
          price: event.price
        });
        break;
        
      case 'order.create':
        orders.set(event.id, {
          id: event.id,
          sku: event.sku,
          qty: event.qty,
          total: event.total,
          status: 'reserved',
          payment: null
        });
        // Reserve units
        const product = products.get(event.sku);
        if (product) {
          product.reserved += event.qty;
        }
        break;
        
      case 'payment.declined':
        {
          const order = orders.get(event.id);
          if (order) {
            order.payment = { key: event.key, status: 'declined' };
          }
          paymentKeys.set(event.key, {
            orderId: event.id,
            outcome: 'declined',
            response: JSON.parse(JSON.stringify(order))
          });
        }
        break;
        
      case 'payment.approved':
        {
          const order = orders.get(event.id);
          if (order) {
            order.status = 'paid';
            order.payment = { key: event.key, status: 'approved' };
            // Consume stock
            const product = products.get(order.sku);
            if (product) {
              product.stock -= order.qty;
              product.reserved -= order.qty;
            }
          }
          paymentKeys.set(event.key, {
            orderId: event.id,
            outcome: 'approved',
            response: JSON.parse(JSON.stringify(order))
          });
        }
        break;
        
      case 'order.cancelled':
        {
          const order = orders.get(event.id);
          if (order) {
            if (order.status === 'reserved') {
              // Release reservation
              const product = products.get(order.sku);
              if (product) {
                product.reserved -= order.qty;
              }
            }
            order.status = 'cancelled';
          }
        }
        break;
        
      case 'payment.refunded':
        {
          const order = orders.get(event.id);
          if (order) {
            // Restore stock
            const product = products.get(order.sku);
            if (product) {
              product.stock += order.qty;
            }
            order.status = 'refunded';
          }
        }
        break;
        
      default:
        throw new Error(`Unknown event type: ${event.type}`);
    }
  }
  
  return { products, orders, paymentKeys, nextSeq: events.length + 1 };
}

// Save store to disk atomically
function saveStore(store, newEvent, stateChanging) {
  if (ORDER_FAILPOINT === 'before_commit' && stateChanging) {
    throw new Error('Failpoint: before_commit');
  }
  
  const updatedStore = {
    version: store.version,
    events: [...store.events, newEvent]
  };
  
  // Write to temporary file then rename atomically
  const tmpFile = join(tmpdir(), `order-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(tmpFile, JSON.stringify(updatedStore), 'utf8');
  renameSync(tmpFile, ORDER_FILE);
}

// Commands
function productAdd(args) {
  if (args.length !== 3) {
    throw new Error('Usage: product add SKU STOCK PRICE');
  }
  
  const [sku, stockStr, priceStr] = args;
  const stock = validateStock(stockStr);
  const price = validatePrice(priceStr);
  validateId(sku);
  
  const store = loadStore();
  const state = rebuildState(store.events);
  
  if (state.products.has(sku)) {
    throw new Error(`Product already exists: ${sku}`);
  }
  
  const event = {
    seq: state.nextSeq,
    type: 'product.add',
    id: sku,
    stock,
    price
  };
  
  saveStore(store, event, true);
  
  return { sku, stock, reserved: 0, price };
}

function productList(args) {
  if (args.length !== 0) {
    throw new Error('Usage: product list');
  }
  
  if (!existsSync(ORDER_FILE)) {
    return [];
  }
  
  const store = loadStore();
  const state = rebuildState(store.events);
  
  return Array.from(state.products.values());
}

function orderCreate(args) {
  if (args.length !== 3) {
    throw new Error('Usage: order create ID SKU QTY');
  }
  
  const [id, sku, qtyStr] = args;
  validateId(id);
  validateId(sku);
  const qty = validateQty(qtyStr);
  
  const store = loadStore();
  const state = rebuildState(store.events);
  
  if (state.orders.has(id)) {
    throw new Error(`Order already exists: ${id}`);
  }
  
  const product = state.products.get(sku);
  if (!product) {
    throw new Error(`Product not found: ${sku}`);
  }
  
  const available = product.stock - product.reserved;
  if (qty > available) {
    throw new Error(`Insufficient stock for ${sku}: need ${qty}, available ${available}`);
  }
  
  const total = qty * product.price;
  if (!Number.isSafeInteger(total)) {
    throw new Error(`Total exceeds safe integer: ${total}`);
  }
  
  const event = {
    seq: state.nextSeq,
    type: 'order.create',
    id,
    sku,
    qty,
    total
  };
  
  saveStore(store, event, true);
  
  return { id, sku, qty, total, status: 'reserved', payment: null };
}

function orderGet(args) {
  if (args.length !== 1) {
    throw new Error('Usage: order get ID');
  }
  
  const [id] = args;
  validateId(id);
  
  const store = loadStore();
  const state = rebuildState(store.events);
  
  const order = state.orders.get(id);
  if (!order) {
    throw new Error(`Order not found: ${id}`);
  }
  
  return order;
}

function orderList(args) {
  if (args.length !== 0) {
    throw new Error('Usage: order list');
  }
  
  if (!existsSync(ORDER_FILE)) {
    return [];
  }
  
  const store = loadStore();
  const state = rebuildState(store.events);
  
  return Array.from(state.orders.values());
}

function orderPay(args) {
  if (args.length !== 3) {
    throw new Error('Usage: order pay ID KEY OUTCOME');
  }
  
  const [id, key, outcome] = args;
  validateId(id);
  validateId(key);
  
  if (outcome !== 'approved' && outcome !== 'declined') {
    throw new Error(`Invalid outcome: ${outcome}`);
  }
  
  const store = loadStore();
  const state = rebuildState(store.events);
  
  // Check for payment key reuse (idempotency)
  const existingPayment = state.paymentKeys.get(key);
  if (existingPayment) {
    // Return original response if this is the exact same request
    if (existingPayment.orderId === id && existingPayment.outcome === outcome) {
      // Idempotent: return stored response without new event
      return existingPayment.response;
    } else {
      // Key reused with different order or outcome
      throw new Error(`Payment key already used: ${key}`);
    }
  }
  
  const order = state.orders.get(id);
  if (!order) {
    throw new Error(`Order not found: ${id}`);
  }
  
  // Cannot pay non-reserved orders
  if (order.status !== 'reserved') {
    throw new Error(`Order cannot be paid: ${id} (status: ${order.status})`);
  }
  
  let event;
  let response;
  
  if (outcome === 'declined') {
    event = {
      seq: state.nextSeq,
      type: 'payment.declined',
      id,
      key
    };
    response = {
      ...order,
      payment: { key, status: 'declined' }
    };
  } else {
    event = {
      seq: state.nextSeq,
      type: 'payment.approved',
      id,
      key
    };
    response = {
      ...order,
      status: 'paid',
      payment: { key, status: 'approved' }
    };
  }
  
  saveStore(store, event, true);
  
  return response;
}

function orderCancel(args) {
  if (args.length !== 1) {
    throw new Error('Usage: order cancel ID');
  }
  
  const [id] = args;
  validateId(id);
  
  const store = loadStore();
  const state = rebuildState(store.events);
  
  const order = state.orders.get(id);
  if (!order) {
    throw new Error(`Order not found: ${id}`);
  }
  
  // Idempotent for cancelled/refunded orders
  if (order.status === 'cancelled' || order.status === 'refunded') {
    // No-op: return current state without new event
    return order;
  }
  
  let event;
  
  if (order.status === 'reserved') {
    event = {
      seq: state.nextSeq,
      type: 'order.cancelled',
      id
    };
    saveStore(store, event, true);
    return {
      ...order,
      status: 'cancelled'
    };
  } else if (order.status === 'paid') {
    event = {
      seq: state.nextSeq,
      type: 'payment.refunded',
      id
    };
    saveStore(store, event, true);
    return {
      ...order,
      status: 'refunded'
    };
  } else {
    throw new Error(`Cannot cancel order in status: ${order.status}`);
  }
}

function audit(args) {
  if (args.length !== 0) {
    throw new Error('Usage: audit');
  }
  
  if (!existsSync(ORDER_FILE)) {
    return [];
  }
  
  const store = loadStore();
  // Rebuild state to validate consistency
  rebuildState(store.events);
  
  return store.events.map(e => ({
    seq: e.seq,
    type: e.type,
    id: e.id
  }));
}

// Main
try {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    throw new Error('Usage: cli.mjs <command> [args...]');
  }
  
  const [command, subcommand, ...rest] = args;
  let result;
  
  if (command === 'product') {
    if (subcommand === 'add') {
      result = productAdd(rest);
    } else if (subcommand === 'list') {
      result = productList(rest);
    } else {
      throw new Error(`Unknown product command: ${subcommand}`);
    }
  } else if (command === 'order') {
    if (subcommand === 'create') {
      result = orderCreate(rest);
    } else if (subcommand === 'get') {
      result = orderGet(rest);
    } else if (subcommand === 'list') {
      result = orderList(rest);
    } else if (subcommand === 'pay') {
      result = orderPay(rest);
    } else if (subcommand === 'cancel') {
      result = orderCancel(rest);
    } else {
      throw new Error(`Unknown order command: ${subcommand}`);
    }
  } else if (command === 'audit') {
    result = audit([subcommand, ...rest].filter(x => x !== undefined));
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
  
  console.log(JSON.stringify(result));
  process.exit(0);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
