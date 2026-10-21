/**
 * Validate SKU format: must match ^[A-Z][A-Z0-9-]*$
 * @param {string} sku
 */
function validateSKU(sku) {
  if (typeof sku !== 'string' || !/^[A-Z][A-Z0-9-]*$/.test(sku)) {
    throw new Error(`Invalid SKU: ${sku}`);
  }
}

/**
 * Validate NAME: must contain non-whitespace text
 * @param {string} name
 */
function validateName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Invalid NAME: must contain non-whitespace text');
  }
}

/**
 * Validate quantity: must be a canonical positive decimal integer string
 * No leading zeroes (except "0" itself), no exponent, at most MAX_SAFE_INTEGER
 * @param {string} qty
 * @returns {number} The parsed quantity
 */
function validateQuantity(qty) {
  if (typeof qty !== 'string') {
    throw new Error('Quantity must be a string');
  }
  
  // Must be a positive integer with no leading zeros
  if (!/^[1-9][0-9]*$/.test(qty)) {
    throw new Error(`Invalid quantity: ${qty}`);
  }
  
  const num = Number(qty);
  
  // Must be safe integer and at most MAX_SAFE_INTEGER
  if (!Number.isSafeInteger(num) || num > Number.MAX_SAFE_INTEGER || num <= 0) {
    throw new Error(`Invalid quantity: ${qty}`);
  }
  
  return num;
}

/**
 * Find an item by SKU
 * @param {object} state
 * @param {string} sku
 * @returns {object|undefined}
 */
function findItem(state, sku) {
  return state.items.find(item => item.sku === sku);
}

/**
 * Add a new item to the inventory
 * @param {object} state
 * @param {string} sku
 * @param {string} name
 * @returns {object} The newly created item
 */
export function addItem(state, sku, name) {
  validateSKU(sku);
  validateName(name);
  
  // Check for duplicate SKU
  if (findItem(state, sku)) {
    throw new Error(`Duplicate SKU: ${sku}`);
  }
  
  const item = {
    sku,
    name,
    onHand: 0,
    reserved: 0
  };
  
  state.items.push(item);
  return item;
}

/**
 * List all items in insertion order
 * @param {object} state
 * @returns {Array} Array of items
 */
export function listItems(state) {
  return state.items;
}

/**
 * Receive stock for an item (add to onHand)
 * @param {object} state
 * @param {string} sku
 * @param {string} qty
 * @returns {object} The updated item
 */
export function receiveStock(state, sku, qty) {
  validateSKU(sku);
  const amount = validateQuantity(qty);
  
  const item = findItem(state, sku);
  if (!item) {
    throw new Error(`Unknown SKU: ${sku}`);
  }
  
  const newOnHand = item.onHand + amount;
  
  // Check for overflow
  if (!Number.isSafeInteger(newOnHand) || newOnHand > Number.MAX_SAFE_INTEGER) {
    throw new Error('Quantity overflow');
  }
  
  item.onHand = newOnHand;
  return item;
}

/**
 * Reserve stock for an item (move from available to reserved)
 * @param {object} state
 * @param {string} sku
 * @param {string} qty
 * @returns {object} The updated item
 */
export function reserveStock(state, sku, qty) {
  validateSKU(sku);
  const amount = validateQuantity(qty);
  
  const item = findItem(state, sku);
  if (!item) {
    throw new Error(`Unknown SKU: ${sku}`);
  }
  
  const available = item.onHand - item.reserved;
  if (amount > available) {
    throw new Error('Insufficient available stock');
  }
  
  const newReserved = item.reserved + amount;
  
  // Check for overflow
  if (!Number.isSafeInteger(newReserved) || newReserved > Number.MAX_SAFE_INTEGER) {
    throw new Error('Quantity overflow');
  }
  
  item.reserved = newReserved;
  return item;
}

/**
 * Release reserved stock (move from reserved back to available)
 * @param {object} state
 * @param {string} sku
 * @param {string} qty
 * @returns {object} The updated item
 */
export function releaseStock(state, sku, qty) {
  validateSKU(sku);
  const amount = validateQuantity(qty);
  
  const item = findItem(state, sku);
  if (!item) {
    throw new Error(`Unknown SKU: ${sku}`);
  }
  
  if (amount > item.reserved) {
    throw new Error('Insufficient reserved stock');
  }
  
  item.reserved = item.reserved - amount;
  return item;
}

/**
 * Ship stock (reduce both onHand and reserved)
 * @param {object} state
 * @param {string} sku
 * @param {string} qty
 * @returns {object} The updated item
 */
export function shipStock(state, sku, qty) {
  validateSKU(sku);
  const amount = validateQuantity(qty);
  
  const item = findItem(state, sku);
  if (!item) {
    throw new Error(`Unknown SKU: ${sku}`);
  }
  
  if (amount > item.reserved) {
    throw new Error('Cannot ship more than reserved stock');
  }
  
  item.onHand = item.onHand - amount;
  item.reserved = item.reserved - amount;
  return item;
}

/**
 * Generate aggregate report
 * @param {object} state
 * @returns {object} Report with items and totals
 */
export function generateReport(state) {
  let totalOnHand = 0;
  let totalReserved = 0;
  
  for (const item of state.items) {
    totalOnHand += item.onHand;
    totalReserved += item.reserved;
  }
  
  return {
    items: state.items,
    totalOnHand,
    totalReserved,
    totalAvailable: totalOnHand - totalReserved
  };
}
