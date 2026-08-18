import { useState } from 'react';
import { Sidebar, Page } from '@/components/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import { Inventory } from '@/pages/Inventory';
import { Orders } from '@/pages/Orders';
import { Allocation } from '@/pages/Allocation';
import { Exceptions } from '@/pages/Exceptions';
import { Analytics } from '@/pages/Analytics';

const pageTitles: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Operations Dashboard', subtitle: 'Real-time warehouse overview and alerts' },
  inventory: { title: 'Inventory Management', subtitle: 'Stock levels, locations, and reorder management' },
  orders: { title: 'Order Management', subtitle: 'Track and fulfill orders through the lifecycle' },
  allocation: { title: 'Smart Allocation', subtitle: 'AI-driven inventory allocation decision engine' },
  exceptions: { title: 'Exception Handling', subtitle: 'Manage damaged, missing, and short-stock issues' },
  analytics: { title: 'Operational Analytics', subtitle: 'Performance metrics and bottleneck identification' },
};

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const meta = pageTitles[page];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar current={page} onNavigate={setPage} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-slate-900">{meta.title}</h1>
          <p className="text-sm text-slate-500">{meta.subtitle}</p>
        </header>
        <main className="flex-1 p-8 overflow-x-hidden">
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'inventory' && <Inventory />}
          {page === 'orders' && <Orders />}
          {page === 'allocation' && <Allocation />}
          {page === 'exceptions' && <Exceptions />}
          {page === 'analytics' && <Analytics />}
        </main>
      </div>
    </div>
  );
}

export default App;
