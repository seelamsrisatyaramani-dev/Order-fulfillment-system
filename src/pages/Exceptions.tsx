import { useEffect, useState } from 'react';
import { supabase, Exception } from '@/lib/supabase';
import { SeverityBadge, ExceptionTypeBadge, formatDateTime } from '@/components/Badges';
import { AlertTriangle, Check, X, Package, Search } from 'lucide-react';

export function Exceptions() {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'escalated' | 'resolved'>('all');
  const [search, setSearch] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('exceptions')
      .select('*, order:orders(*), product:products(*)')
      .order('created_at', { ascending: false });
    setExceptions(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function resolve(id: string) {
    setResolving(id);
    await supabase.from('exceptions').update({
      status: 'resolved',
      resolution: 'Issue resolved by warehouse team',
      resolved_at: new Date().toISOString(),
    }).eq('id', id);
    setResolving(null);
    load();
  }

  async function escalate(id: string) {
    await supabase.from('exceptions').update({ status: 'escalated' }).eq('id', id);
    load();
  }

  const filtered = exceptions.filter((e) => {
    if (filter !== 'all' && e.status !== filter) return false;
    if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="p-8 text-slate-500">Loading exceptions...</div>;

  const openCount = exceptions.filter(e => e.status === 'open').length;
  const escalatedCount = exceptions.filter(e => e.status === 'escalated').length;
  const resolvedCount = exceptions.filter(e => e.status === 'resolved').length;
  const criticalCount = exceptions.filter(e => e.severity === 'critical' && e.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-slate-500 text-xs">Open</p><p className="text-2xl font-bold text-slate-900">{openCount}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><X className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-slate-500 text-xs">Escalated</p><p className="text-2xl font-bold text-slate-900">{escalatedCount}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><Check className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-slate-500 text-xs">Resolved</p><p className="text-2xl font-bold text-slate-900">{resolvedCount}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-slate-500 text-xs">Critical Active</p><p className="text-2xl font-bold text-slate-900">{criticalCount}</p></div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-bold text-slate-900">Exception Handling</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exceptions..."
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 w-56"
              />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'open', 'escalated', 'resolved'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors capitalize ${
                    filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((e) => (
            <div key={e.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  e.severity === 'critical' ? 'bg-red-100' : e.severity === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${
                    e.severity === 'critical' ? 'text-red-600' : e.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <ExceptionTypeBadge type={e.type} />
                    <SeverityBadge severity={e.severity} />
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      e.status === 'open' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      e.status === 'escalated' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800">{e.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    {e.order && (
                      <span className="inline-flex items-center gap-1">
                        <Package className="w-3 h-3" /> {e.order.order_number}
                      </span>
                    )}
                    {e.product && <span>{e.product.name} ({e.product.sku})</span>}
                    <span>{formatDateTime(e.created_at)}</span>
                    {e.resolution && <span className="text-emerald-600">Resolved: {e.resolution}</span>}
                  </div>
                </div>
                {e.status !== 'resolved' && (
                  <div className="flex items-center gap-2 shrink-0">
                    {e.status !== 'escalated' && (
                      <button
                        onClick={() => escalate(e.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Escalate
                      </button>
                    )}
                    <button
                      onClick={() => resolve(e.id)}
                      disabled={resolving === e.id}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {resolving === e.id ? 'Resolving...' : 'Resolve'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <div className="px-5 py-10 text-center text-slate-400">No exceptions found.</div>}
      </div>
    </div>
  );
}
