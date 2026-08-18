import { useEffect, useState } from 'react';
import { supabase, Order, Product } from '@/lib/supabase';
import { runAllocationEngine, applyAllocationDecisions, AllocationDecision } from '@/lib/allocationEngine';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Brain, Zap, ArrowRight, Check, AlertTriangle, TrendingDown, Shield, Loader2, Sparkles } from 'lucide-react';

export function Allocation() {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [decisions, setDecisions] = useState<AllocationDecision[] | null>(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  async function load() {
    const [{ data: orders }, { data: prods }] = await Promise.all([
      supabase.from('orders').select('*').eq('status', 'pending_allocation').order('created_at'),
      supabase.from('products').select('*'),
    ]);
    setPendingOrders(orders || []);
    setProducts(prods || []);
  }

  useEffect(() => { load(); }, []);

  async function runEngine() {
    setRunning(true);
    const result = await runAllocationEngine();
    setDecisions(result.decisions);
    setApplied(false);
    setRunning(false);
  }

  async function applyDecisions() {
    if (!decisions) return;
    setApplying(true);
    await applyAllocationDecisions(decisions);
    setApplying(false);
    setApplied(true);
    setDecisions(null);
    load();
  }

  const actionStyles: Record<string, { bg: string; text: string; icon: typeof Check }> = {
    full: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Check },
    partial: { bg: 'bg-amber-100', text: 'text-amber-700', icon: TrendingDown },
    steal: { bg: 'bg-violet-100', text: 'text-violet-700', icon: Shield },
    deferred: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Smart Allocation Engine</h2>
            </div>
            <p className="text-slate-400 text-sm max-w-xl mt-2">
              Analyzes all pending orders in priority order, checks available stock, and intelligently reallocates
              inventory from lower-priority orders when higher-priority orders need it.
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-sm">Pending Orders</p>
            <p className="text-4xl font-bold">{pendingOrders.length}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={runEngine}
            disabled={running || pendingOrders.length === 0}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Zap className="w-4 h-4" /> Run Analysis</>}
          </button>
          {decisions && !applied && (
            <button
              onClick={applyDecisions}
              disabled={applying}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {applying ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</> : <><Check className="w-4 h-4" /> Apply Decisions</>}
            </button>
          )}
          {applied && (
            <div className="flex items-center gap-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 font-semibold px-4 py-2.5 rounded-lg">
              <Check className="w-4 h-4" /> Decisions applied successfully
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { step: 1, title: 'Priority Sort', desc: 'Orders ranked critical → low', icon: ArrowRight },
          { step: 2, title: 'Stock Check', desc: 'Available inventory verified per item', icon: TrendingDown },
          { step: 3, title: 'Decision Logic', desc: 'Full, partial, steal, or defer', icon: Brain },
          { step: 4, title: 'Apply & Log', desc: 'Updates stock, order status, audit trail', icon: Check },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.step} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-sm">{s.step}</div>
                <Icon className="w-4 h-4 text-slate-400" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">{s.title}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Pending orders preview */}
      {!decisions && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Orders Awaiting Allocation</h3>
            <p className="text-sm text-slate-500 mt-0.5">These will be evaluated when you run the engine</p>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingOrders.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                All orders have been allocated. Nothing pending.
              </div>
            ) : (
              pendingOrders.map((o) => (
                <div key={o.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{o.order_number}</p>
                    <p className="text-xs text-slate-500">{o.customer_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <PriorityBadge priority={o.priority} />
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Decision results */}
      {decisions && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Fully Allocated', value: decisions.filter(d => d.action === 'full').length, color: 'emerald' },
              { label: 'Partial', value: decisions.filter(d => d.action === 'partial').length, color: 'amber' },
              { label: 'Stolen / Reallocated', value: decisions.filter(d => d.action === 'steal').length, color: 'violet' },
              { label: 'Deferred', value: decisions.filter(d => d.action === 'deferred').length, color: 'red' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-slate-500 text-xs">{s.label}</p>
                <p className={`text-3xl font-bold text-${s.color}-600`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Decision cards */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Allocation Decisions</h3>
              <p className="text-sm text-slate-500 mt-0.5">Review each decision before applying</p>
            </div>
            <div className="divide-y divide-slate-100">
              {decisions.map((d, i) => {
                const style = actionStyles[d.action];
                const Icon = style.icon;
                return (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4.5 h-4.5 ${style.text}`} style={{ width: 18, height: 18 }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{d.order_number}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
                            {d.action.toUpperCase()}
                          </span>
                          <span className="text-sm text-slate-600">{d.product_name}</span>
                          <span className="text-xs text-slate-400">({d.product_sku})</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{d.reason}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-slate-500">Requested: <strong className="text-slate-700">{d.requested_qty}</strong></span>
                          <span className="text-slate-500">Available: <strong className="text-slate-700">{d.available_qty}</strong></span>
                          <span className="text-slate-500">Allocated: <strong className="text-sky-600">{d.allocated_qty}</strong></span>
                        </div>
                        {d.steal_from && d.steal_from.length > 0 && (
                          <div className="mt-2 bg-violet-50 border border-violet-200 rounded-lg p-2.5">
                            <p className="text-xs font-semibold text-violet-700 mb-1">Reallocating from lower-priority orders:</p>
                            {d.steal_from.map((s, j) => (
                              <div key={j} className="text-xs text-violet-600 flex items-center gap-1.5">
                                <ArrowRight className="w-3 h-3" />
                                {s.order_number}: {s.qty_stolen} units taken
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
