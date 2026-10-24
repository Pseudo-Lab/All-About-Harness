export function handleProductAdd(command, state) {
  const { sku, stock, price } = command;
  
  if (state.products.has(sku)) {
    throw new Error(`Product ${sku} already exists`);
  }
  
  const product = { sku, stock, reserved: 0, price };
  
  const event = {
    seq: state.nextSeq,
    type: 'product.add',
    id: sku,
    stock,
    price
  };
  
  return { result: product, event };
}

export function handleProductList(state) {
  return state.productOrder.map(sku => {
    const p = state.products.get(sku);
    return { sku: p.sku, stock: p.stock, reserved: p.reserved, price: p.price };
  });
}

export function handleOrderCreate(command, state) {
  const { id, sku, qty } = command;
  
  if (state.orders.has(id)) {
    throw new Error(`Order ${id} already exists`);
  }
  
  const product = state.products.get(sku);
  if (!product) {
    throw new Error(`Product ${sku} not found`);
  }
  
  const available = product.stock - product.reserved;
  if (available < qty) {
    throw new Error(`Insufficient stock for ${sku}`);
  }
  
  const total = qty * product.price;
  if (!Number.isSafeInteger(total)) {
    throw new Error('Total is not a safe integer');
  }
  
  const order = { id, sku, qty, total, status: 'reserved', payment: null };
  
  const event = {
    seq: state.nextSeq,
    type: 'order.create',
    id,
    sku,
    qty,
    total
  };
  
  return { result: order, event };
}

export function handleOrderGet(command, state) {
  const { id } = command;
  
  const order = state.orders.get(id);
  if (!order) {
    throw new Error(`Order ${id} not found`);
  }
  
  return { ...order };
}

export function handleOrderList(state) {
  return state.orderOrder.map(id => {
    const o = state.orders.get(id);
    return { ...o };
  });
}

export function handleOrderPay(command, state) {
  const { id, key, status } = command;
  
  // Check if payment key already used
  if (state.paymentKeys.has(key)) {
    const existing = state.paymentKeys.get(key);
    if (existing.orderId !== id || existing.status !== status) {
      throw new Error(`Payment key ${key} already used`);
    }
    // Idempotent: return stored response
    return { result: existing.response, event: null };
  }
  
  const order = state.orders.get(id);
  if (!order) {
    throw new Error(`Order ${id} not found`);
  }
  
  // Cannot pay cancelled or refunded orders
  if (order.status === 'cancelled' || order.status === 'refunded') {
    throw new Error(`Cannot pay ${order.status} order`);
  }
  
  // Cannot pay already-paid order with new key
  if (order.status === 'paid') {
    throw new Error(`Order ${id} is already paid`);
  }
  
  let event;
  let result;
  
  if (status === 'declined') {
    result = {
      ...order,
      payment: { key, status: 'declined' }
    };
    event = {
      seq: state.nextSeq,
      type: 'payment.declined',
      id,
      key
    };
  } else { // approved
    const product = state.products.get(order.sku);
    result = {
      ...order,
      status: 'paid',
      payment: { key, status: 'approved' }
    };
    event = {
      seq: state.nextSeq,
      type: 'payment.approved',
      id,
      key
    };
  }
  
  return { result, event };
}

export function handleOrderCancel(command, state) {
  const { id } = command;
  
  const order = state.orders.get(id);
  if (!order) {
    throw new Error(`Order ${id} not found`);
  }
  
  // Idempotent cancellation
  if (order.status === 'cancelled') {
    return { result: { ...order }, event: null };
  }
  
  if (order.status === 'refunded') {
    return { result: { ...order }, event: null };
  }
  
  let event;
  let result;
  
  if (order.status === 'reserved') {
    result = {
      ...order,
      status: 'cancelled'
    };
    event = {
      seq: state.nextSeq,
      type: 'order.cancelled',
      id
    };
  } else if (order.status === 'paid') {
    result = {
      ...order,
      status: 'refunded'
    };
    event = {
      seq: state.nextSeq,
      type: 'payment.refunded',
      id
    };
  } else {
    throw new Error(`Cannot cancel order in status ${order.status}`);
  }
  
  return { result, event };
}

export function handleAudit(state) {
  // Audit needs access to the raw events from the store
  // We'll pass them through state
  return state.auditEvents || [];
}
