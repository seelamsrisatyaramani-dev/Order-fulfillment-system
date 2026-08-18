import { useEffect, useState } from 'react';
import { supabase, Order, OrderItem, ActivityLog, FULFILLMENT_STAGES, ORDER_STATUS_LABELS } from '@/lib/supabase';
import { PriorityBadge, StatusBadge, formatCurrency, formatDate, formatDateTime } from '@/components/Badges';
import { Search, X, Package, Truck, CheckCircle2, Clock, ArrowRight, AlertTriangle } from 'lucide-react';

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase()) && !o.customer_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedOrder = orders.find((o) => o.id === selectedId);

  if (loading) return <div className="p-8 text-slate-500">Loading orders...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-bold text-slate-900">All Orders</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order or customer..."
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 w-56"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3 font-semibold">Order</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Priority</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Ship Date</th>
                <th className="px-5 py-3 font-semibold text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((o) => (
                <tr key={o.id} onClick={() => setSelectedId(o.id)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-5 py-3"><p className="font-semibold text-slate-900">{o.order_number}</p></td>
                  <td className="px-3 py-3 text-slate-600">{o.customer_name}</td>
                  <td className="px-3 py-3"><PriorityBadge priority={o.priority} /></td>
                  <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-3 text-slate-600">{formatDate(o.requested_ship_date)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(o.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="px-5 py-10 text-center text-slate-400">No orders found.</div>}
      </div>

      {selectedOrder && <OrderDetail order={selectedOrder} onClose={() => setSelectedId(null)} onUpdate={load} />}
    </div>
  );
}

function OrderDetail({ order, onClose, onUpdate }: { order: Order; onClose: () => void; onUpdate: () => void }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: its }, { data: acts }] = await Promise.all([
        supabase.from('order_items').select('*, product:products(*)').eq('order_id', order.id),
        supabase.from('activity_log').select('*').eq('order_id', order.id).order('created_at', { ascending: true }),
      ]);
      setItems(its || []);
      setActivity(acts || []);
    }
    load();
  }, [order.id]);

  const currentStageIndex = FULFILLMENT_STAGES.indexOf(order.status);
  const canAdvance = currentStageIndex >= 0 && currentStageIndex < FULFILLMENT_STAGES.length - 1;
  const nextStage = canAdvance ? FULFILLMENT_STAGES[currentStageIndex + 1] : null;

  async function advanceStage() {
    if (!nextStage) return;
    setAdvancing(true);

    if (nextStage === 'picking') {
      // Mark all allocated items as picked
      for (const item of items) {
        if (item.allocated_qty > 0 && item.picked_qty === 0) {
          await supabase.from('order_items').update({ picked_qty: item.allocated_qty, status: 'picked' }).eq('id', item.id);
        }
      }
    }
    if (nextStage === 'packing') {
      for (const item of items) {
        if (item.picked_qty > 0 && item.packed_qty === 0) {
          await supabase.from('order_items').update({ packed_qty: item.picked_qty, status: 'packed' }).eq('id', item.id);
        }
      }
    }
    if (nextStage === 'dispatched') {
      // Reduce product on_hand by packed quantities
      for (const item of items) {
        if (item.packed_qty > 0 && item.product) {
          const newOnHand = item.product.on_hand - item.packed_qty;
          const newAllocated = Math.max(0, item.product.allocated - item.packed_qty);
          let newStatus = 'in_stock';
          const avail = newOnHand - newAllocated;
          if (avail <= 0) newStatus = 'out_of_stock';
          else if (avail <= item.product.reorder_point) newStatus = 'low_stock';
          await supabase.from('products').update({ on_hand: newOnHand, allocated: newAllocated, status: newStatus }).eq('id', item.product_id);
        }
      }
    }

    await supabase.from('orders').update({ status: nextStage }).eq('id', order.id);
    await supabase.from('activity_log').insert({
      order_id: order.id,
      event: `Stage: ${nextStage}`,
      detail: `Order advanced to ${ORDER_STATUS_LABELS[nextStage]}`,
    });
    setAdvancing(false);
    onUpdate();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-sky-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900">{order.order_number}</h2>
              <p className="text-sm text-slate-500">{order.customer_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Lifecycle progress */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              {FULFILLMENT_STAGES.map((stage, i) => {
                const isActive = i <= currentStageIndex;
                const isCurrent = i === currentStageIndex;
                return (
                  <div key={stage} className="flex items-center flex-1">
                    <div className={`flex flex-col items-center ${i === 0 ? '' : 'flex-1'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'
                      } ${isCurrent ? 'ring-4 ring-sky-100' : ''}`}>
                        {isActive ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className={`text-[10px] mt-1 text-center ${isActive ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                        {ORDER_STATUS_LABELS[stage]}
                      </span>
                    </div>
                    {i < FULFILLMENT_STAGES.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < currentStageIndex ? 'bg-sky-600' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Priority</p>
              <div className="mt-1"><PriorityBadge priority={order.priority} /></div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Requested Ship Date</p>
              <p className="font-semibold text-slate-900 mt-1">{formatDate(order.requested_ship_date)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Total Value</p>
              <p className="font-bold text-slate-900 mt-1">{formatCurrency(order.total_value)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Created</p>
              <p className="font-semibold text-slate-900 mt-1">{formatDateTime(order.created_at)}</p>
            </div>
          </div>

          {order.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">{order.notes}</p>
            </div>
          )}

          {/* Line items */}
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Line Items</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold text-center">Requested</th>
                    <th className="px-3 py-2 font-semibold text-center">Allocated</th>
                    <th className="px-3 py-2 font-semibold text-center">Picked</th>
                    <th className="px-3 py-2 font-semibold text-center">Packed</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900">{item.product?.name}</p>
                        <p className="text-xs text-slate-400">{item.product?.sku}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-center text-sky-600 font-medium">{item.allocated_qty}</td>
                      <td className="px-3 py-2.5 text-center text-indigo-600 font-medium">{item.picked_qty}</td>
                      <td className="px-3 py-2.5 text-center text-violet-600 font-medium">{item.packed_qty}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-semibold text-slate-600 capitalize">{item.status.replace(/_/g, ' ')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity timeline */}
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Activity Timeline</h4>
            <div className="space-y-2.5">
              {activity.map((act) => (
                <div key={act.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{act.event}</p>
                    <p className="text-xs text-slate-500">{act.detail} · {formatDateTime(act.created_at)}</p>
                  </div>
                </div>
              ))}
              {activity.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
            </div>
          </div>

          {/* Advance button */}
          {canAdvance && (
            <button
              onClick={advanceStage}
              disabled={advancing}
              className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {advancing ? 'Processing...' : <>Advance to {ORDER_STATUS_LABELS[nextStage!]} <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
          {order.status === 'dispatched' && (
            <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg py-3">
              <Truck className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-emerald-700">Order dispatched successfully</span>
            </div>
          )}
          {order.status === 'on_hold' && (
            <div className="flex items-center justify-center gap-2 bg-orange-50 border border-orange-200 rounded-lg py-3">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="font-semibold text-orange-700">Order on hold — awaiting stock</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
