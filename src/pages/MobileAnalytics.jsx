// src/pages/MobileAnalytics.jsx
// Mobile-first analytics dashboard for KSR Realty
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  LayoutGrid, IndianRupee, Clock, TrendingUp,
} from 'lucide-react';

const NAV = [
  { id: 'overview',    label: 'Overview',    icon: LayoutGrid },
  { id: 'collections', label: 'Collections', icon: IndianRupee },
  { id: 'pending',     label: 'Pending',     icon: Clock },
  { id: 'inventory',   label: 'Inventory',   icon: TrendingUp },
];

const inr = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const inrCrore = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return inr(v);
};

export default function MobileAnalytics() {
  const [tab, setTab] = useState('overview');

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top bar */}
      <div className="bg-[#0a1f44] text-white px-4 pt-5 pb-4">
        <div className="text-xs font-medium text-blue-200 uppercase tracking-widest mb-0.5">KSR Realty</div>
        <div className="text-xl font-bold">Analytics</div>
      </div>

      {/* Content */}
      <div className="px-4 pt-5">
        {tab === 'overview'    && <OverviewTab />}
        {tab === 'collections' && <CollectionsTab />}
        {tab === 'pending'     && <PendingTab />}
        {tab === 'inventory'   && <InventoryTab />}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              tab === id
                ? 'text-[#0a1f44]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon size={20} strokeWidth={tab === id ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ─────────────────────────────────────────────
   OVERVIEW
───────────────────────────────────────────── */
function OverviewTab() {
  const { data: bookings = [], isLoading: lb } = useQuery({
    queryKey: ['mob-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('ksr').from('bookings')
        .select('id, status, total_consideration, booking_date')
        .neq('status', 'cancelled');
      if (error) throw error;
      return data;
    },
  });

  const { data: plots = [], isLoading: lp } = useQuery({
    queryKey: ['mob-plots'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('ksr').from('plots')
        .select('status').eq('plot_type', 'plot');
      if (error) throw error;
      return data;
    },
  });

  const { data: paidTotals = {}, isLoading: lpt } = usePaidTotals();

  if (lb || lp || lpt) return <Loader />;

  const totalSaleValue  = bookings.reduce((s, b) => s + (Number(b.total_consideration) || 0), 0);
  const totalCollected  = Object.values(paidTotals).reduce((s, v) => s + v, 0);
  const totalPending    = bookings.reduce((s, b) => {
    const p = Math.round((b.total_consideration || 0) - (paidTotals[b.id] || 0));
    return s + (p > 0 ? p : 0);
  }, 0);

  const plotCounts = plots.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  // Month-on-month bookings (last 6 months)
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      count: 0,
    };
  });
  bookings.forEach(b => {
    if (!b.booking_date) return;
    const key = b.booking_date.slice(0, 7);
    const m = months.find(m => m.key === key);
    if (m) m.count++;
  });

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Total Sale Value"  value={inrCrore(totalSaleValue)}  sub={`${bookings.length} bookings`} color="blue" />
        <MetricCard label="Total Collected"   value={inrCrore(totalCollected)}  sub={`${Math.round(totalCollected / totalSaleValue * 100) || 0}% of total`} color="green" />
        <MetricCard label="Pending Amount"    value={inrCrore(totalPending)}    sub="to be collected" color="red" />
        <MetricCard label="Plots Available"   value={plotCounts.available || 0} sub={`of ${plots.length} total`} color="amber" />
      </div>

      {/* Plot status pills */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Plot Status</div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Available', count: plotCounts.available || 0, color: 'text-green-700 bg-green-50' },
            { label: 'Booked',    count: plotCounts.booked    || 0, color: 'text-blue-700 bg-blue-50' },
            { label: 'Registered',count: plotCounts.registered|| 0, color: 'text-slate-700 bg-slate-100' },
            { label: 'Blocked',   count: plotCounts.blocked   || 0, color: 'text-amber-700 bg-amber-50' },
          ].map(({ label, count, color }) => (
            <div key={label} className={`rounded-xl px-2 py-2.5 ${color}`}>
              <div className="text-xl font-bold">{count}</div>
              <div className="text-[10px] font-medium mt-0.5 leading-tight">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Booking trend */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Bookings — Last 6 Months</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={months} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow">
                    <div className="font-semibold text-slate-800">{label}</div>
                    <div className="text-blue-600">{payload[0].value} booking{payload[0].value !== 1 ? 's' : ''}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#4A7EB5" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   COLLECTIONS
───────────────────────────────────────────── */
function CollectionsTab() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['mob-payments-all'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('ksr').from('payments')
        .select('amount, payment_date, mode, payment_type, paid_by')
        .neq('paid_by', 'ksr')
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Loader />;

  // This month
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const thisMonthAmt  = payments.filter(p => p.payment_date?.startsWith(thisMonth)).reduce((s, p) => s + Number(p.amount), 0);
  const lastMonthAmt  = payments.filter(p => p.payment_date?.startsWith(lastMonth)).reduce((s, p) => s + Number(p.amount), 0);
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);

  // Mode-wise
  const byMode = payments.reduce((acc, p) => {
    const m = p.mode || 'other';
    acc[m] = (acc[m] || 0) + Number(p.amount);
    return acc;
  }, {});
  const modeData = Object.entries(byMode)
    .map(([mode, amount]) => ({ mode: mode.toUpperCase(), amount }))
    .sort((a, b) => b.amount - a.amount);

  // Last 6 months trend
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      amount: 0,
    };
  });
  payments.forEach(p => {
    if (!p.payment_date) return;
    const key = p.payment_date.slice(0, 7);
    const m = months.find(m => m.key === key);
    if (m) m.amount += Number(p.amount);
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="This Month"     value={inrCrore(thisMonthAmt)}  sub={now.toLocaleDateString('en-IN', { month: 'long' })} color="green" />
        <MetricCard label="Last Month"     value={inrCrore(lastMonthAmt)}  sub={lastMonthDate.toLocaleDateString('en-IN', { month: 'long' })} color="blue" />
        <MetricCard label="Total Collected" value={inrCrore(totalCollected)} sub="all time" color="blue" span={2} />
      </div>

      {/* Monthly trend */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Monthly Collections</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={months} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => v >= 1e7 ? `${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v/1e5).toFixed(0)}L` : v}
              tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow">
                    <div className="font-semibold text-slate-800">{label}</div>
                    <div className="text-green-600">{inrCrore(payload[0].value)}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {months.map((m) => (
                <Cell key={m.key} fill={m.key === thisMonth ? '#0a1f44' : '#4A7EB5'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mode breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Payment Mode Breakdown</div>
        <div className="space-y-2.5">
          {modeData.map(({ mode, amount }) => {
            const pct = totalCollected > 0 ? (amount / totalCollected) * 100 : 0;
            return (
              <div key={mode}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{mode}</span>
                  <span className="text-slate-500">{inrCrore(amount)} <span className="text-slate-400 text-xs">({pct.toFixed(0)}%)</span></span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#4A7EB5] rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PENDING
───────────────────────────────────────────── */
function PendingTab() {
  const [projectFilter, setProjectFilter] = useState('');

  const { data: bookings = [], isLoading: lb } = useQuery({
    queryKey: ['mob-pending-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('ksr').from('bookings')
        .select('id, total_consideration, status, customers(name, mobile), projects(id, name), plots(plot_number, block)')
        .neq('status', 'cancelled');
      if (error) throw error;
      return data;
    },
  });

  const { data: paidTotals = {}, isLoading: lpt } = usePaidTotals();

  if (lb || lpt) return <Loader />;

  const projects = [...new Map(bookings.map(b => [b.projects?.id, b.projects?.name])).entries()]
    .filter(([id]) => id)
    .sort((a, b) => a[1]?.localeCompare(b[1]));

  const rows = bookings
    .map(b => ({
      ...b,
      pending: Math.round((b.total_consideration || 0) - (paidTotals[b.id] || 0)),
    }))
    .filter(b => b.pending > 0)
    .filter(b => !projectFilter || b.projects?.id === projectFilter)
    .sort((a, b) => b.pending - a.pending);

  const totalPending = rows.reduce((s, r) => s + r.pending, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Total Pending" value={inrCrore(totalPending)} sub={`${rows.length} bookings`} color="red" span={2} />
      </div>

      {/* Project filter */}
      {projects.length > 1 && (
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        >
          <option value="">All Projects</option>
          {projects.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      )}

      {/* Pending list */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          No pending amounts 🎉
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(b => (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex justify-between items-start mb-1">
                <div className="font-semibold text-slate-800 text-sm">{b.customers?.name || '—'}</div>
                <div className="text-red-600 font-bold text-sm">{inr(b.pending)}</div>
              </div>
              <div className="text-xs text-slate-500">
                {b.projects?.name}{b.plots?.plot_number ? ` · Plot ${b.plots.plot_number}${b.plots.block ? ` (${b.plots.block})` : ''}` : ''}
              </div>
              {b.customers?.mobile && (
                <div className="text-xs text-slate-400 mt-0.5">{b.customers.mobile}</div>
              )}
              <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-full"
                  style={{ width: `${Math.min(100, (b.pending / (b.total_consideration || 1)) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Paid: {inr((b.total_consideration || 0) - b.pending)}</span>
                <span>Total: {inr(b.total_consideration)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   INVENTORY
───────────────────────────────────────────── */
function InventoryTab() {
  const { data: projects = [], isLoading: lp } = useQuery({
    queryKey: ['mob-inv-projects'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('ksr').from('projects')
        .select('id, name, location, region').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: plots = [], isLoading: lpl } = useQuery({
    queryKey: ['mob-inv-plots'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('ksr').from('plots')
        .select('project_id, status').eq('plot_type', 'plot');
      if (error) throw error;
      return data;
    },
  });

  if (lp || lpl) return <Loader />;

  const rows = projects.map(proj => {
    const pp = plots.filter(p => p.project_id === proj.id);
    const counts = { total: pp.length, available: 0, booked: 0, registered: 0, blocked: 0 };
    pp.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
    const soldPct = counts.total > 0
      ? Math.round(((counts.booked + counts.registered) / counts.total) * 100)
      : 0;
    return { ...proj, ...counts, soldPct };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      available: acc.available + r.available,
      booked: acc.booked + r.booked,
      registered: acc.registered + r.registered,
    }),
    { total: 0, available: 0, booked: 0, registered: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Overall summary */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Total',      count: totals.total,      color: 'text-slate-800 bg-white' },
          { label: 'Available',  count: totals.available,  color: 'text-green-700 bg-green-50' },
          { label: 'Booked',     count: totals.booked,     color: 'text-blue-700 bg-blue-50' },
          { label: 'Registered', count: totals.registered, color: 'text-slate-700 bg-slate-100' },
        ].map(({ label, count, color }) => (
          <div key={label} className={`rounded-xl px-2 py-3 border border-slate-200 ${color}`}>
            <div className="text-xl font-bold">{count}</div>
            <div className="text-[10px] font-medium mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Per-project cards */}
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-slate-800 text-sm">{r.name}</div>
                {r.location && <div className="text-xs text-slate-400">{r.location}</div>}
              </div>
              <div className="text-xs font-semibold text-[#0a1f44] bg-blue-50 px-2 py-0.5 rounded-full">
                {r.soldPct}% sold
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${r.soldPct}%`,
                  background: r.soldPct >= 80 ? '#16a34a' : r.soldPct >= 50 ? '#4A7EB5' : '#f59e0b',
                }}
              />
            </div>

            <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
              <div><span className="font-semibold text-slate-700">{r.total}</span><br /><span className="text-slate-400">Total</span></div>
              <div><span className="font-semibold text-green-700">{r.available}</span><br /><span className="text-slate-400">Free</span></div>
              <div><span className="font-semibold text-blue-700">{r.booked}</span><br /><span className="text-slate-400">Booked</span></div>
              <div><span className="font-semibold text-slate-700">{r.registered}</span><br /><span className="text-slate-400">Reg'd</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SHARED HOOK — paid totals
───────────────────────────────────────────── */
function usePaidTotals() {
  return useQuery({
    queryKey: ['mob-paid-totals'],
    queryFn: async () => {
      const [{ data: direct, error: e1 }, { data: splits, error: e2 }, { data: deposits, error: e3 }] =
        await Promise.all([
          supabase.schema('ksr').from('payments').select('booking_id, amount').neq('paid_by', 'ksr').not('booking_id', 'is', null),
          supabase.schema('ksr').from('booking_payment_splits').select('booking_id, amount'),
          supabase.schema('ksr').from('customer_deposits').select('applied_to_booking_id, amount').eq('status', 'applied').not('applied_to_booking_id', 'is', null),
        ]);
      if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;
      const totals = {};
      direct.forEach(p => { totals[p.booking_id] = (totals[p.booking_id] || 0) + Number(p.amount); });
      splits.forEach(s => { totals[s.booking_id] = (totals[s.booking_id] || 0) + Number(s.amount); });
      deposits.forEach(d => { totals[d.applied_to_booking_id] = (totals[d.applied_to_booking_id] || 0) + Number(d.amount); });
      return totals;
    },
  });
}

/* ─────────────────────────────────────────────
   SHARED COMPONENTS
───────────────────────────────────────────── */
function MetricCard({ label, value, sub, color = 'blue', span }) {
  const colors = {
    blue:  'text-[#0a1f44]',
    green: 'text-green-700',
    red:   'text-red-600',
    amber: 'text-amber-600',
  };
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-4 ${span === 2 ? 'col-span-2' : ''}`}>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#0a1f44] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
