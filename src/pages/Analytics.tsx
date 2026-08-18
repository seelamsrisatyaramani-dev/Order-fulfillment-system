import { useEffect, useState } from 'react';
import { supabase, Order, Product, Exception } from '@/lib/supabase';
import { formatCurrency } from '@/components/Badges';
import { TrendingUp, AlertTriangle, Clock, Package, BarChart3, Activity } from 'lucide-react';

export function Analytics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: ords }, { data: prods }, { data: excs }] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('products').select('*'),
        supabase.from('exceptions').select('*'),
      ]);
      setOrders(ords || []);
      setProducts(prods || []);
      setExceptions(excs || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-slate-500">Loading analytics...</div>;

  // Stage distribution
  const stageCounts: Record<string, number> = {};
  orders.forEach((o) => { stageCounts[o.status] = (stageCounts[o.status] || 0) + 1; });

  // Priority distribution
  const priorityCounts: Record<string, number> = {};
  orders.forEach((o) => { priorityCounts[o.priority] = (priorityCounts[o.priority] || 0) + 1; });

  // Category breakdown
  const categoryStats: Record<string, { count: number; value: number }> = {};
  products.forEach((p) => {
    if (!categoryStats[p.category]) categoryStats[p.category] = { count: 0, value: 0 };
    categoryStats[p.category].count += p.on_hand;
    categoryStats[p.category].value += p.on_hand * p.unit_cost;
  });

  // Bottleneck analysis
  const bottlenecks = [
    {
      stage: 'Pending Allocation',
      count: stageCounts['pending_allocation'] || 0,
      severity: 'high',
      desc: 'Orders stuck waiting for stock assignment',
    },
    {
      stage: 'On Hold',
      count: stageCounts['on_hold'] || 0,
      severity: 'critical',
      desc: 'Orders blocked by stock unavailability',
    },
    {
      stage: 'Picking',
      count: stageCounts['picking'] || 0,
      severity: 'medium',
      desc: 'Orders in active picking process',
    },
    {
      stage: 'Packing',
      count: stageCounts['packing'] || 0,
      severity: 'medium',
      desc: 'Orders in active packing process',
    },
  ].filter((b) => b.count > 0);

  const totalValue = products.reduce((s, p) => s + p.on_hand * p.unit_cost, 0);
  const allocatedValue = products.reduce((s, p) => s + p.allocated * p.unit_cost, 0);
  const fulfillmentRate = orders.length > 0 ? ((stageCounts['dispatched'] || 0) / orders.length) * 100 : 0;

  const maxStageCount = Math.max(...Object.values(stageCounts), 1);
  const maxCatValue = Math.max(...Object.values(categoryStats).map(c => c.value), 1);

  const severityColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-400',
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-slate-500 text-xs">Fulfillment Rate</p><p className="text-2xl font-bold text-slate-900">{fulfillmentRate.toFixed(0)}%</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center"><Package className="w-5 h-5 text-sky-600" /></div>
            <div><p className="text-slate-500 text-xs">Inventory Value</p><p className="text-2xl font-bold text-slate-900">{formatCurrency(totalValue)}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-slate-500 text-xs">Allocated Value</p><p className="text-2xl font-bold text-slate-900">{formatCurrency(allocatedValue)}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-slate-500 text-xs">Total Exceptions</p><p className="text-2xl font-bold text-slate-900">{exceptions.length}</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order status distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4.5 h-4.5 text-slate-600" style={{ width: 18, height: 18 }} />
            <h3 className="font-bold text-slate-900">Order Status Distribution</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(stageCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 capitalize">{status.replace(/_/g, ' ')}</span>
                  <span className="font-bold text-slate-900">{count}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div className="bg-sky-600 h-2.5 rounded-full transition-all" style={{ width: `${(count / maxStageCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4.5 h-4.5 text-slate-600" style={{ width: 18, height: 18 }} />
            <h3 className="font-bold text-slate-900">Order Priority Breakdown</h3>
          </div>
          <div className="flex items-end justify-around h-40 gap-4 pt-4">
            {[
              { label: 'Critical', count: priorityCounts['critical'] || 0, color: 'bg-red-500' },
              { label: 'High', count: priorityCounts['high'] || 0, color: 'bg-orange-500' },
              { label: 'Standard', count: priorityCounts['standard'] || 0, color: 'bg-blue-500' },
              { label: 'Low', count: priorityCounts['low'] || 0, color: 'bg-slate-400' },
            ].map((p) => {
              const maxP = Math.max(...Object.values(priorityCounts), 1);
              return (
                <div key={p.label} className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-lg font-bold text-slate-900">{p.count}</span>
                  <div className="w-full bg-slate-100 rounded-t-lg relative" style={{ height: '100px' }}>
                    <div className={`absolute bottom-0 left-0 right-0 ${p.color} rounded-t-lg transition-all`} style={{ height: `${(p.count / maxP) * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottleneck analysis */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4.5 h-4.5 text-amber-600" style={{ width: 18, height: 18 }} />
          <h3 className="font-bold text-slate-900">Bottleneck Analysis</h3>
        </div>
        <div className="space-y-3">
          {bottlenecks.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              No bottlenecks detected. Operations running smoothly.
            </div>
          ) : (
            bottlenecks.map((b) => (
              <div key={b.stage} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <div className={`w-2.5 h-2.5 rounded-full ${severityColors[b.severity]}`} />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{b.stage}</p>
                  <p className="text-xs text-slate-500">{b.desc}</p>
                </div>
                <span className="text-2xl font-bold text-slate-900">{b.count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-4">Inventory Value by Category</h3>
        <div className="space-y-3">
          {Object.entries(categoryStats).sort((a, b) => b[1].value - a[1].value).map(([cat, stats]) => (
            <div key={cat}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600 font-medium">{cat}</span>
                <span className="font-bold text-slate-900">{formatCurrency(stats.value)} <span className="text-slate-400 font-normal">· {stats.count} units</span></span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-sky-500 to-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${(stats.value / maxCatValue) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
