const SKU_PATTERN = /^[A-Z][A-Z0-9-]*$/;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function validateSku(sku) {
  if (!SKU_PATTERN.test(sku)) {
    throw new Error(`Invalid SKU: ${sku}`);
  }
}

function validateQuantity(qtyStr) {
  // Must be positive integer with no leading zeros or exponent notation
  if (!/^[1-9][0-9]*$/.test(qtyStr)) {
    throw new Error(`Invalid quantity: ${qtyStr}`);
  }
  const qty = Number(qtyStr);
  if (!Number.isSafeInteger(qty) || qty > MAX_SAFE) {
    throw new Error(`Quantity out of range: ${qtyStr}`);
  }
  return qty;
}

function validateName(name) {
  if (!name || !/\S/.test(name)) {
    throw new Error('Name must contain non-whitespace text');
  }
}

function findItem(items, sku) {
  return items.find(item => item.sku === sku);
}

export function addItem(state, sku, name) {
  validateSku(sku);
  validateName(name);
  
  if (findItem(state.items, sku)) {
    throw new Error(`SKU already exists: ${sku}`);
  }
  
  const item = { sku, name, onHand: 0, reserved: 0 };
  state.items.push(item);
  return item;
}

export function listItems(state) {
  return state.items;
}

export function receiveStock(state, sku, qtyStr) {
  const qty = validateQuantity(qtyStr);
  const item = findItem(state.items, sku);
  
  if (!item) {
    throw new Error(`Unknown SKU: ${sku}`);
  }
  
  const newOnHand = item.onHand + qty;
  if (!Number.isSafeInteger(newOnHand) || newOnHand > MAX_SAFE) {
    throw new Error('Stock overflow');
  }
  
  item.onHand = newOnHand;
  return { ...item };
}

export function reserveStock(state, sku, qtyStr) {
  const qty = validateQuantity(qtyStr);
  const item = findItem(state.items, sku);
  
  if (!item) {
    throw new Error(`Unknown SKU: ${sku}`);
  }
  
  const available = item.onHand - item.reserved;
  if (qty > available) {
    throw new Error('Insufficient available stock');
  }
  
  item.reserved += qty;
  return { ...item };
}

export function releaseStock(state, sku, qtyStr) {
  const qty = validateQuantity(qtyStr);
  const item = findItem(state.items, sku);
  
  if (!item) {
    throw new Error(`Unknown SKU: ${sku}`);
  }
  
  if (qty > item.reserved) {
    throw new Error('Insufficient reserved stock');
  }
  
  item.reserved -= qty;
  return { ...item };
}

export function shipStock(state, sku, qtyStr) {
  const qty = validateQuantity(qtyStr);
  const item = findItem(state.items, sku);
  
  if (!item) {
    throw new Error(`Unknown SKU: ${sku}`);
  }
  
  if (qty > item.reserved) {
    throw new Error('Insufficient reserved stock');
  }
  
  item.onHand -= qty;
  item.reserved -= qty;
  return { ...item };
}

export function generateReport(state) {
  const items = [...state.items];
  let totalOnHand = 0;
  let totalReserved = 0;
  
  for (const item of items) {
    totalOnHand += item.onHand;
    totalReserved += item.reserved;
  }
  
  const totalAvailable = totalOnHand - totalReserved;
  
  return {
    items,
    totalOnHand,
    totalReserved,
    totalAvailable
  };
}
