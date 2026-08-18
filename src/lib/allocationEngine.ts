import { supabase, Product, Order, OrderItem, PRIORITY_RANK } from './supabase';

export type AllocationDecision = {
  order_id: string;
  order_number: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  requested_qty: number;
  available_qty: number;
  allocated_qty: number;
  action: 'full' | 'partial' | 'deferred' | 'steal';
  reason: string;
  steal_from?: {
    order_number: string;
    order_id: string;
    qty_stolen: number;
  }[];
};

export type AllocationResult = {
  decisions: AllocationDecision[];
  summary: {
    total_items: number;
    fully_allocated: number;
    partially_allocated: number;
    deferred: number;
    stolen: number;
  };
};

/**
 * The allocation engine evaluates all pending orders in priority order.
 * For each order item, it tries to allocate from available stock.
 * If insufficient and the order is high priority, it considers stealing
 * allocated units from lower-priority orders that haven't started picking yet.
 */
export async function runAllocationEngine(): Promise<AllocationResult> {
  // Fetch all pending_allocation orders sorted by priority
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'pending_allocation')
    .order('created_at', { ascending: true });

  if (!pendingOrders || pendingOrders.length === 0) {
    return { decisions: [], summary: { total_items: 0, fully_allocated: 0, partially_allocated: 0, deferred: 0, stolen: 0 } };
  }

  // Sort by priority rank, then by created_at
  const sortedOrders = (pendingOrders as Order[]).sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 99;
    const pb = PRIORITY_RANK[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Fetch all products (we'll track available stock in memory)
  const { data: products } = await supabase
    .from('products')
    .select('*');

  const productMap = new Map<string, Product>();
  (products || []).forEach((p: Product) => productMap.set(p.id, p));

  // Fetch all allocated orders that could be stolen from (not yet picking)
  const { data: stealableOrders } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['allocated', 'pending_allocation'])
    .order('created_at', { ascending: true });

  const stealableMap = new Map<string, Order>();
  (stealableOrders || []).forEach((o: Order) => stealableMap.set(o.id, o));

  // Fetch all order items for stealable orders (to know what's allocated)
  const stealableIds = Array.from(stealableMap.keys());
  const { data: stealableItems } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', stealableIds.length > 0 ? stealableIds : ['00000000-0000-0000-0000-000000000000']);

  // Build a map: product_id -> [{order, item}] for stealable allocated items, sorted by priority (lowest first = steal from lowest priority)
  const stealableByProduct = new Map<string, { order: Order; item: OrderItem }[]>();
  (stealableItems || []).forEach((item: OrderItem) => {
    if (item.allocated_qty > 0 && item.picked_qty === 0) {
      const order = stealableMap.get(item.order_id);
      if (order) {
        const arr = stealableByProduct.get(item.product_id) || [];
        arr.push({ order, item });
        stealableByProduct.set(item.product_id, arr);
      }
    }
  });

  // Sort stealable items so lowest priority is first (steal from low priority first)
  stealableByProduct.forEach((arr) => {
    arr.sort((a, b) => {
      const pa = PRIORITY_RANK[a.order.priority] ?? 99;
      const pb = PRIORITY_RANK[b.order.priority] ?? 99;
      return pb - pa; // highest number = lowest priority = steal first
    });
  });

  const decisions: AllocationDecision[] = [];
  let fullyAllocated = 0;
  let partiallyAllocated = 0;
  let deferred = 0;
  let stolen = 0;

  for (const order of sortedOrders) {
    const { data: items } = await supabase
      .from('order_items')
      .select('*, product:products(*)')
      .eq('order_id', order.id);

    if (!items) continue;

    for (const item of items as OrderItem[]) {
      const product = productMap.get(item.product_id);
      if (!product) continue;

      const requested = item.quantity;
      const available = product.available;
      const decision: AllocationDecision = {
        order_id: order.id,
        order_number: order.order_number,
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        requested_qty: requested,
        available_qty: available,
        allocated_qty: 0,
        action: 'deferred',
        reason: '',
      };

      if (available >= requested) {
        // Full allocation
        decision.allocated_qty = requested;
        decision.action = 'full';
        decision.reason = 'Sufficient available stock';
        product.allocated += requested;
        fullyAllocated++;
      } else if (available > 0) {
        // Partial allocation — check if we can steal from lower-priority orders
        const shortfall = requested - available;
        const orderPriority = PRIORITY_RANK[order.priority] ?? 99;
        const stealCandidates = stealableByProduct.get(product.id) || [];
        const stealableFromOthers = stealCandidates.filter(
          (sc) => sc.order.id !== order.id && PRIORITY_RANK[sc.order.priority] > orderPriority
        );

        if (stealableFromOthers.length > 0 && (order.priority === 'critical' || order.priority === 'high')) {
          // Steal from lower-priority orders
          let stolenQty = 0;
          const stealLog: AllocationDecision['steal_from'] = [];

          for (const sc of stealableFromOthers) {
            if (stolenQty >= shortfall) break;
            const canSteal = Math.min(sc.item.allocated_qty, shortfall - stolenQty);
            if (canSteal > 0) {
              stolenQty += canSteal;
              stealLog.push({
                order_number: sc.order.order_number,
                order_id: sc.order.id,
                qty_stolen: canSteal,
              });
              sc.item.allocated_qty -= canSteal;
              product.allocated -= canSteal;
              stolen++;
            }
          }

          if (stolenQty >= shortfall) {
            decision.allocated_qty = requested;
            decision.action = 'steal';
            decision.reason = `Partial stock (${available}) + stole ${stolenQty} from lower-priority orders`;
            decision.steal_from = stealLog;
            product.allocated += requested;
            fullyAllocated++;
          } else {
            // Couldn't steal enough — partial only
            decision.allocated_qty = available;
            decision.action = 'partial';
            decision.reason = `Only ${available} available — ${stolenQty} stolen but ${shortfall - stolenQty} still short`;
            decision.steal_from = stealLog;
            product.allocated += available;
            partiallyAllocated++;
          }
        } else {
          // Partial without stealing
          decision.allocated_qty = available;
          decision.action = 'partial';
          decision.reason = `Only ${available} of ${requested} available — order deferred for remainder`;
          product.allocated += available;
          partiallyAllocated++;
        }
      } else {
        // No stock available
        const orderPriority = PRIORITY_RANK[order.priority] ?? 99;
        const stealCandidates = (stealableByProduct.get(product.id) || []).filter(
          (sc) => sc.order.id !== order.id && PRIORITY_RANK[sc.order.priority] > orderPriority
        );

        if (stealCandidates.length > 0 && (order.priority === 'critical' || order.priority === 'high')) {
          let stolenQty = 0;
          const stealLog: AllocationDecision['steal_from'] = [];
          for (const sc of stealCandidates) {
            if (stolenQty >= requested) break;
            const canSteal = Math.min(sc.item.allocated_qty, requested - stolenQty);
            if (canSteal > 0) {
              stolenQty += canSteal;
              stealLog.push({ order_number: sc.order.order_number, order_id: sc.order.id, qty_stolen: canSteal });
              sc.item.allocated_qty -= canSteal;
              product.allocated -= canSteal;
              stolen++;
            }
          }
          if (stolenQty > 0) {
            decision.allocated_qty = stolenQty;
            decision.action = stolenQty >= requested ? 'steal' : 'partial';
            decision.reason = `No free stock — stole ${stolenQty} from lower-priority orders`;
            decision.steal_from = stealLog;
            product.allocated += stolenQty;
            if (stolenQty >= requested) fullyAllocated++;
            else partiallyAllocated++;
          } else {
            decision.action = 'deferred';
            decision.reason = 'No stock available — order deferred until replenishment';
            deferred++;
          }
        } else {
          decision.action = 'deferred';
          decision.reason = 'No stock available — order deferred until replenishment';
          deferred++;
        }
      }

      decisions.push(decision);
    }
  }

  return {
    decisions,
    summary: {
      total_items: decisions.length,
      fully_allocated: fullyAllocated,
      partially_allocated: partiallyAllocated,
      deferred,
      stolen,
    },
  };
}

/**
 * Apply allocation decisions to the database — updates product allocated counts,
 * order_items allocated_qty, order status, and writes allocation_log + activity_log.
 */
export async function applyAllocationDecisions(decisions: AllocationDecision[]): Promise<void> {
  for (const d of decisions) {
    if (d.allocated_qty === 0 && d.action === 'deferred') {
      // Just log it
      await supabase.from('allocation_log').insert({
        order_id: d.order_id,
        product_id: d.product_id,
        requested_qty: d.requested_qty,
        allocated_qty: 0,
        action: 'deferred',
        reason: d.reason,
      });
      continue;
    }

    // Update order_item allocated_qty
    const { data: item } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', d.order_id)
      .eq('product_id', d.product_id)
      .maybeSingle();

    if (item) {
      const newStatus = d.allocated_qty >= d.requested_qty ? 'allocated' : 'pending';
      await supabase
        .from('order_items')
        .update({ allocated_qty: d.allocated_qty, status: newStatus })
        .eq('id', item.id);
    }

    // Update product allocated count
    const { data: prod } = await supabase
      .from('products')
      .select('allocated')
      .eq('id', d.product_id)
      .maybeSingle();

    if (prod) {
      // We need to recalculate from the decisions for this product
    }

    // Handle steal updates
    if (d.steal_from) {
      for (const steal of d.steal_from) {
        const { data: stolenItem } = await supabase
          .from('order_items')
          .select('id, allocated_qty')
          .eq('order_id', steal.order_id)
          .eq('product_id', d.product_id)
          .maybeSingle();

        if (stolenItem) {
          const newAllocated = Math.max(0, stolenItem.allocated_qty - steal.qty_stolen);
          const newStatus = newAllocated === 0 ? 'pending' : 'allocated';
          await supabase
            .from('order_items')
            .update({ allocated_qty: newAllocated, status: newStatus })
            .eq('id', stolenItem.id);

          await supabase.from('activity_log').insert({
            order_id: steal.order_id,
            event: 'Stock reallocated',
            detail: `${steal.qty_stolen} units stolen by higher-priority ${d.order_number}`,
          });
        }
      }
    }

    // Write allocation log
    await supabase.from('allocation_log').insert({
      order_id: d.order_id,
      product_id: d.product_id,
      requested_qty: d.requested_qty,
      allocated_qty: d.allocated_qty,
      action: d.action,
      reason: d.reason,
    });

    await supabase.from('activity_log').insert({
      order_id: d.order_id,
      event: 'Stock allocated',
      detail: `${d.allocated_qty}/${d.requested_qty} units of ${d.product_sku} — ${d.action}`,
    });
  }

  // Recalculate product allocated totals from order_items
  const { data: allItems } = await supabase.from('order_items').select('product_id, allocated_qty');
  if (allItems) {
    const allocTotals = new Map<string, number>();
    allItems.forEach((item: { product_id: string; allocated_qty: number }) => {
      allocTotals.set(item.product_id, (allocTotals.get(item.product_id) || 0) + item.allocated_qty);
    });

    const { data: allProducts } = await supabase.from('products').select('id, on_hand, allocated, reorder_point');
    if (allProducts) {
      for (const p of allProducts as Product[]) {
        const newAllocated = allocTotals.get(p.id) || 0;
        let newStatus = 'in_stock';
        const available = p.on_hand - newAllocated;
        if (available <= 0) newStatus = 'out_of_stock';
        else if (available <= p.reorder_point) newStatus = 'low_stock';

        await supabase
          .from('products')
          .update({ allocated: newAllocated, status: newStatus })
          .eq('id', p.id);
      }
    }
  }

  // Update order statuses — if all items fully allocated, move to 'allocated'
  const orderIds = Array.from(new Set(decisions.map((d) => d.order_id)));
  for (const orderId of orderIds) {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('quantity, allocated_qty')
      .eq('order_id', orderId);

    if (orderItems && orderItems.length > 0) {
      const allAllocated = orderItems.every(
        (item: { quantity: number; allocated_qty: number }) => item.allocated_qty >= item.quantity
      );
      if (allAllocated) {
        await supabase.from('orders').update({ status: 'allocated' }).eq('id', orderId);
        await supabase.from('activity_log').insert({
          order_id: orderId,
          event: 'Fully allocated',
          detail: 'All items allocated — order ready for picking',
        });
      }
    }
  }
}
