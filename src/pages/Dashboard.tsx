import { useEffect, useState } from 'react';
import { supabase, Product, Order, Exception } from '@/lib/supabase';
import { PriorityBadge, StatusBadge, StockBadge, formatCurrency, formatDate, timeAgo } from '@/components/Badges';
import { Package, AlertTriangle, TrendingDown, Truck, Clock, ArrowRight, Boxes, Zap } from 'lucide-react';
import type { Page } from '@/components/Sidebar';

export function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: prods }, { data: ords }, { data: excs }] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('exceptions').select('*, order:orders(*), product:products(*)').eq('status', 'open').order('created_at', { ascending: false }),
      ]);
      setProducts(prods || []);
      setOrders(ords || []);
      setExceptions(excs || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-slate-500">Loading dashboard...</div>;

  const lowStock = products.filter((p) => p.status === 'low_stock');
  const outStock = products.filter((p) => p.status === 'out_of_stock');
  const pendingAllocation = orders.filter((o) => o.status === 'pending_allocation');
  const inFulfillment = orders.filter((o) => ['allocated', 'picking', 'packing', 'quality_check'].includes(o.status));
  const dispatched = orders.filter((o) => o.status === 'dispatched');
  const onHold = orders.filter((o) => o.status === 'on_hold');
  const criticalExceptions = exceptions.filter((e) => e.severity === 'critical');
  const totalInventoryValue = products.reduce((sum, p) => sum + p.on_hand * p.unit_cost, 0);
  const totalAllocatedValue = products.reduce((sum, p) => sum + p.allocated * p.unit_cost, 0);

  const kpis = [
    { label: 'Total Products', value: products.length, icon: Boxes, color: 'sky', sub: `${products.filter(p => p.status === 'in_stock').length} healthy` },
    { label: 'Pending Allocation', value: pendingAllocation.length, icon: Clock, color: 'amber', sub: `${pendingAllocation.filter(o => o.priority === 'critical').length} critical` },
    { label: 'In Fulfillment', value: inFulfillment.length, icon: Truck, color: 'indigo', sub: `${dispatched.length} dispatched` },
    { label: 'Open Exceptions', value: exceptions.length, icon: AlertTriangle, color: 'red', sub: `${criticalExceptions.length} critical` },
  ];

  const colorMap: Record<string, string> = {
    sky: 'from-sky-500 to-blue-600',
    amber: 'from-amber-500 to-orange-600',
    indigo: 'from-indigo-500 to-blue-600',
    red: 'from-red-500 to-rose-600',
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">{kpi.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{kpi.value}</p>
                  <p className="text-slate-400 text-xs mt-1">{kpi.sub}</p>
                </div>
                <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${colorMap[kpi.color]} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alerts Banner */}
      {(lowStock.length > 0 || outStock.length > 0 || criticalExceptions.length > 0) && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-red-900">Active Alerts</h3>
          </div>
          <div className="space-y-2">
            {outStock.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm text-red-800">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <strong>{p.name}</strong> is completely out of stock — {p.reorder_qty} units needed for reorder
              </div>
            ))}
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm text-amber-800">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <strong>{p.name}</strong> is low on stock ({p.available} available, reorder at {p.reorder_point})
              </div>
            ))}
            {criticalExceptions.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm text-red-800">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {e.description}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Recent Orders</h3>
            <button onClick={() => onNavigate('orders')} className="text-sky-600 text-sm font-medium flex items-center gap-1 hover:text-sky-700">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {orders.slice(0, 6).map((order) => (
              <div key={order.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Package className="w-4.5 h-4.5 text-slate-500" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{order.order_number}</p>
                    <p className="text-xs text-slate-500">{order.customer_name} · {timeAgo(order.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <PriorityBadge priority={order.priority} />
                  <StatusBadge status={order.status} />
                  <span className="text-sm font-semibold text-slate-700 w-20 text-right">{formatCurrency(order.total_value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Summary + Bottlenecks */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 mb-4">Inventory Value</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Total Stock Value</span>
                  <span className="font-bold text-slate-900">{formatCurrency(totalInventoryValue)}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Allocated to Orders</span>
                  <span className="font-bold text-amber-600">{formatCurrency(totalAllocatedValue)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${totalInventoryValue > 0 ? (totalAllocatedValue / totalInventoryValue) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Available (Free)</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(totalInventoryValue - totalAllocatedValue)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4.5 h-4.5 text-amber-600" style={{ width: 18, height: 18 }} />
              <h3 className="font-bold text-slate-900">Bottlenecks</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Orders awaiting allocation</span>
                <span className="font-bold text-amber-600">{pendingAllocation.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Orders on hold</span>
                <span className="font-bold text-orange-600">{onHold.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Low-stock SKUs</span>
                <span className="font-bold text-amber-600">{lowStock.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Out-of-stock SKUs</span>
                <span className="font-bold text-red-600">{outStock.length}</span>
              </div>
            </div>
            <button onClick={() => onNavigate('allocation')} className="mt-4 w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
              <Zap className="w-4 h-4" /> Run Allocation Engine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
