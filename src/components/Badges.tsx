import { PRIORITY_LABELS, ORDER_STATUS_LABELS } from '@/lib/supabase';

export function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    standard: 'bg-blue-100 text-blue-700 border-blue-200',
    low: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const dots: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    standard: 'bg-blue-500',
    low: 'bg-gray-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[priority] || styles.standard}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[priority] || dots.standard}`} />
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    created: 'bg-gray-100 text-gray-700 border-gray-200',
    pending_allocation: 'bg-amber-100 text-amber-700 border-amber-200',
    allocated: 'bg-sky-100 text-sky-700 border-sky-200',
    picking: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    packing: 'bg-violet-100 text-violet-700 border-violet-200',
    quality_check: 'bg-teal-100 text-teal-700 border-teal-200',
    dispatched: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
    on_hold: 'bg-orange-100 text-orange-700 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.created}`}>
      {ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}

export function StockBadge({ status, available }: { status: string; available: number }) {
  const styles: Record<string, string> = {
    in_stock: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    low_stock: 'bg-amber-100 text-amber-700 border-amber-200',
    out_of_stock: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.in_stock}`}>
      {available} avail
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[severity] || styles.warning}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

export function ExceptionTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    damaged: 'Damaged',
    missing: 'Missing',
    short_stock: 'Short Stock',
    quality_fail: 'Quality Fail',
    overstock: 'Overstock',
  };
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 text-slate-700 border-slate-200">
      {labels[type] || type}
    </span>
  );
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
