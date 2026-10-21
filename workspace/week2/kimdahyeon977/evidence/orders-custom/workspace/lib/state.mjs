export function buildState(events) {
  const state = {
    products: new Map(),
    orders: new Map(),
    paymentKeys: new Map(),
    nextSeq: events.length + 1,
    productOrder: [],
    orderOrder: [],
    auditEvents: events.map(e => ({ seq: e.seq, type: e.type, id: e.id }))
  };
  
  for (const event of events) {
    applyEvent(state, event);
  }
  
  return state;
}

function applyEvent(state, event) {
  switch (event.type) {
    case 'product.add':
      state.products.set(event.id, {
        sku: event.id,
        stock: event.stock,
        reserved: 0,
        price: event.price
      });
      state.productOrder.push(event.id);
      break;
      
    case 'order.create':
      state.orders.set(event.id, {
        id: event.id,
        sku: event.sku,
        qty: event.qty,
        total: event.total,
        status: 'reserved',
        payment: null
      });
      state.orderOrder.push(event.id);
      // Reserve stock
      const product = state.products.get(event.sku);
      if (product) {
        product.reserved += event.qty;
      }
      break;
      
    case 'payment.declined':
      const declinedOrder = state.orders.get(event.id);
      if (declinedOrder) {
        declinedOrder.payment = { key: event.key, status: 'declined' };
        state.paymentKeys.set(event.key, {
          orderId: event.id,
          status: 'declined',
          response: {
            id: declinedOrder.id,
            sku: declinedOrder.sku,
            qty: declinedOrder.qty,
            total: declinedOrder.total,
            status: declinedOrder.status,
            payment: { key: event.key, status: 'declined' }
          }
        });
      }
      break;
      
    case 'payment.approved':
      const approvedOrder = state.orders.get(event.id);
      if (approvedOrder) {
        approvedOrder.status = 'paid';
        approvedOrder.payment = { key: event.key, status: 'approved' };
        // Reduce stock and reserved
        const prod = state.products.get(approvedOrder.sku);
        if (prod) {
          prod.stock -= approvedOrder.qty;
          prod.reserved -= approvedOrder.qty;
        }
        state.paymentKeys.set(event.key, {
          orderId: event.id,
          status: 'approved',
          response: {
            id: approvedOrder.id,
            sku: approvedOrder.sku,
            qty: approvedOrder.qty,
            total: approvedOrder.total,
            status: 'paid',
            payment: { key: event.key, status: 'approved' }
          }
        });
      }
      break;
      
    case 'order.cancelled':
      const cancelledOrder = state.orders.get(event.id);
      if (cancelledOrder && cancelledOrder.status === 'reserved') {
        cancelledOrder.status = 'cancelled';
        // Release reservation
        const prod = state.products.get(cancelledOrder.sku);
        if (prod) {
          prod.reserved -= cancelledOrder.qty;
        }
      }
      break;
      
    case 'payment.refunded':
      const refundedOrder = state.orders.get(event.id);
      if (refundedOrder && refundedOrder.status === 'paid') {
        refundedOrder.status = 'refunded';
        // Restore stock
        const prod = state.products.get(refundedOrder.sku);
        if (prod) {
          prod.stock += refundedOrder.qty;
        }
      }
      break;
  }
}
