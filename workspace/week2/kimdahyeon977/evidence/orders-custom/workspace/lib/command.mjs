export function parseCommand(args) {
  if (args.length === 0) {
    throw new Error('No command provided');
  }
  
  const [entity, action, ...rest] = args;
  
  if (entity === 'audit') {
    if (action !== undefined || rest.length !== 0) {
      throw new Error('audit takes no arguments');
    }
    return { type: 'audit' };
  } else if (entity === 'product') {
    if (!action) {
      throw new Error('product requires an action: add or list');
    }
    if (action === 'add') {
      if (rest.length !== 3) {
        throw new Error('product add requires exactly 3 arguments: SKU STOCK PRICE');
      }
      const [sku, stock, price] = rest;
      validateIdentifier(sku);
      validateStock(stock);
      validatePrice(price);
      return { type: 'product.add', sku, stock: parseInt(stock, 10), price: parseInt(price, 10) };
    } else if (action === 'list') {
      if (rest.length !== 0) {
        throw new Error('product list takes no arguments');
      }
      return { type: 'product.list' };
    } else {
      throw new Error(`Unknown product action: ${action}`);
    }
  } else if (entity === 'order') {
    if (!action) {
      throw new Error('order requires an action');
    }
    if (action === 'create') {
      if (rest.length !== 3) {
        throw new Error('order create requires exactly 3 arguments: ID SKU QTY');
      }
      const [id, sku, qty] = rest;
      validateIdentifier(id);
      validateIdentifier(sku);
      validateQty(qty);
      return { type: 'order.create', id, sku, qty: parseInt(qty, 10) };
    } else if (action === 'get') {
      if (rest.length !== 1) {
        throw new Error('order get requires exactly 1 argument: ID');
      }
      const [id] = rest;
      validateIdentifier(id);
      return { type: 'order.get', id };
    } else if (action === 'list') {
      if (rest.length !== 0) {
        throw new Error('order list takes no arguments');
      }
      return { type: 'order.list' };
    } else if (action === 'pay') {
      if (rest.length !== 3) {
        throw new Error('order pay requires exactly 3 arguments: ID KEY STATUS');
      }
      const [id, key, status] = rest;
      validateIdentifier(id);
      validateIdentifier(key);
      if (status !== 'approved' && status !== 'declined') {
        throw new Error('Payment status must be "approved" or "declined"');
      }
      return { type: 'order.pay', id, key, status };
    } else if (action === 'cancel') {
      if (rest.length !== 1) {
        throw new Error('order cancel requires exactly 1 argument: ID');
      }
      const [id] = rest;
      validateIdentifier(id);
      return { type: 'order.cancel', id };
    } else {
      throw new Error(`Unknown order action: ${action}`);
    }
  } else {
    throw new Error(`Unknown command: ${entity}`);
  }
}

function validateIdentifier(id) {
  if (!/^[A-Z][A-Z0-9-]{0,15}$/.test(id)) {
    throw new Error(`Invalid identifier: ${id}`);
  }
}

function validateStock(stock) {
  if (!/^(0|[1-9][0-9]*)$/.test(stock)) {
    throw new Error(`Invalid stock: ${stock}`);
  }
  const n = parseInt(stock, 10);
  if (n < 0 || n > 1000000) {
    throw new Error(`Stock out of range: ${stock}`);
  }
}

function validatePrice(price) {
  if (!/^[1-9][0-9]*$/.test(price)) {
    throw new Error(`Invalid price: ${price}`);
  }
  const n = parseInt(price, 10);
  if (n < 1 || n > 1000000000) {
    throw new Error(`Price out of range: ${price}`);
  }
}

function validateQty(qty) {
  if (!/^[1-9][0-9]*$/.test(qty)) {
    throw new Error(`Invalid quantity: ${qty}`);
  }
}
