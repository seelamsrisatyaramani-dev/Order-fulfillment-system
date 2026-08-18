import { useEffect, useState } from 'react';
import { supabase, Product } from '@/lib/supabase';
import { StockBadge, formatCurrency } from '@/components/Badges';
import { Search, Package, TrendingDown, AlertCircle, RefreshCw, MapPin } from 'lucide-react';

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [reordering, setReordering] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function reorder(p: Product) {
    setReordering(p.id);
    const newOnHand = p.on_hand + p.reorder_qty;
    let newStatus = 'in_stock';
    const available = newOnHand - p.allocated;
    if (available <= 0) newStatus = 'out_of_stock';
    else if (available <= p.reorder_point) newStatus = 'low_stock';

    await supabase.from('products').update({ on_hand: newOnHand, status: newStatus }).eq('id', p.id);
    await supabase.from('exceptions').insert({
      product_id: p.id,
      type: 'overstock',
      severity: 'info',
      status: 'resolved',
      description: `Reorder placed for ${p.name}: +${p.reorder_qty} units (was ${p.on_hand}, now ${newOnHand})`,
      resolution: 'Reorder completed',
      resolved_at: new Date().toISOString(),
    });
    setReordering(null);
    load();
  }

  const filtered = products.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="p-8 text-slate-500">Loading inventory...</div>;

  const totalValue = products.reduce((s, p) => s + p.on_hand * p.unit_cost, 0);
  const lowCount = products.filter((p) => p.status === 'low_stock').length;
  const outCount = products.filter((p) => p.status === 'out_of_stock').length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center"><Package className="w-5 h-5 text-sky-600" /></div>
            <div><p className="text-slate-500 text-xs">Total SKUs</p><p className="text-2xl font-bold text-slate-900">{products.length}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><span className="text-emerald-600 font-bold">$</span></div>
            <div><p className="text-slate-500 text-xs">Stock Value</p><p className="text-2xl font-bold text-slate-900">{formatCurrency(totalValue)}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-slate-500 text-xs">Low Stock</p><p className="text-2xl font-bold text-slate-900">{lowCount}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-slate-500 text-xs">Out of Stock</p><p className="text-2xl font-bold text-slate-900">{outCount}</p></div>
          </div>
        </div>
      </div>

      {/* Filters + table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-bold text-slate-900">Product Inventory</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU or name..."
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 w-56"
              />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'in_stock' ? 'In Stock' : f === 'low_stock' ? 'Low' : 'Out'}
                </button>
              ))}
            </div>
            <button onClick={load} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold">Category</th>
                <th className="px-3 py-3 font-semibold text-center">On Hand</th>
                <th className="px-3 py-3 font-semibold text-center">Allocated</th>
                <th className="px-3 py-3 font-semibold text-center">Available</th>
                <th className="px-3 py-3 font-semibold text-center">Reorder Pt</th>
                <th className="px-3 py-3 font-semibold">Location</th>
                <th className="px-3 py-3 font-semibold text-right">Unit Cost</th>
                <th className="px-3 py-3 font-semibold text-center">Status</th>
                <th className="px-5 py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.sku}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{p.category}</td>
                  <td className="px-3 py-3 text-center font-semibold text-slate-900">{p.on_hand}</td>
                  <td className="px-3 py-3 text-center text-amber-600 font-medium">{p.allocated}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-bold ${p.available <= 0 ? 'text-red-600' : p.available <= p.reorder_point ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {p.available}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-500">{p.reorder_point}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 text-slate-500 text-xs"><MapPin className="w-3 h-3" />{p.location}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(p.unit_cost)}</td>
                  <td className="px-3 py-3 text-center"><StockBadge status={p.status} available={p.available} /></td>
                  <td className="px-5 py-3 text-center">
                    {(p.status === 'low_stock' || p.status === 'out_of_stock') && (
                      <button
                        onClick={() => reorder(p)}
                        disabled={reordering === p.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
                      >
                        {reordering === p.id ? 'Ordering...' : `Reorder +${p.reorder_qty}`}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="px-5 py-10 text-center text-slate-400">No products found.</div>}
      </div>
    </div>
  );
}
