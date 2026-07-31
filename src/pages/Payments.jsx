// src/pages/Payments.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search } from 'lucide-react';

const MODE_LABELS = { cash: 'Cash', cheque: 'Cheque', neft: 'NEFT', rtgs: 'RTGS', upi: 'UPI', dd: 'DD', imps: 'IMPS' };
const modeLabel = (value) => MODE_LABELS[value] || value;

export default function Payments() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('projects')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['all-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('payments')
        .select(
          `
          id,
          payment_type,
          payment_date,
          amount,
          mode,
          reference_no,
          notes,
          booking_id,
          landowner_id,
          bookings (
            id,
            customers ( name, mobile ),
            projects ( id, name ),
            plots ( plot_number, block )
          ),
          project_landowners ( landowner_name )
        `
        )
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const inr = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n || 0);

  const filtered = payments.filter((p) => {
    const matchesProject = projectFilter === 'All' || p.bookings?.projects?.id === projectFilter;
    const matchesType = typeFilter === 'All' || p.payment_type === typeFilter;
    const matchesFrom = !dateFrom || p.payment_date >= dateFrom;
    const matchesTo = !dateTo || p.payment_date <= dateTo;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.bookings?.customers?.name?.toLowerCase().includes(q) ||
      p.bookings?.customers?.mobile?.toLowerCase().includes(q) ||
      p.bookings?.plots?.plot_number?.toLowerCase().includes(q) ||
      p.reference_no?.toLowerCase().includes(q);
    return matchesProject && matchesType && matchesFrom && matchesTo && matchesSearch;
  });

  const totalCollected = filtered.reduce((sum, p) => sum + Number(p.amount), 0);
  const companyTotal = filtered
    .filter((p) => p.payment_type === 'company_share')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const landownerTotal = filtered
    .filter((p) => p.payment_type === 'landowner_share')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Payments</h1>
        <p className="text-sm text-slate-500">All payments recorded across every booking</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Total Collected" value={inr(totalCollected)} />
        <SummaryCard label="Company (KSR) Share" value={inr(companyTotal)} />
        <SummaryCard label="Landowner Share" value={inr(landownerTotal)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, mobile, plot, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        >
          <option value="All">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        >
          <option value="All">All Types</option>
          <option value="company_share">Company (KSR) Share</option>
          <option value="landowner_share">Landowner Share</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        />
        <span className="text-slate-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading payments...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No payments match your filters</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Project / Plot</th>
                <th className="text-left px-4 py-3">Paid To</th>
                <th className="text-left px-4 py-3">Mode</th>
                <th className="text-left px-4 py-3">Reference</th>
                <th className="text-right px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/bookings/${p.booking_id}`)}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(p.payment_date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">
                      {p.bookings?.customers?.name || '—'}
                    </div>
                    <div className="text-slate-500 text-xs">{p.bookings?.customers?.mobile || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.bookings?.projects?.name || '—'}
                    {p.bookings?.plots?.plot_number ? (
                      <span className="text-slate-400">
                        {' '}
                        · Plot {p.bookings.plots.plot_number}
                        {p.bookings.plots.block ? ` (${p.bookings.plots.block})` : ''}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.payment_type === 'landowner_share'
                      ? `Landowner${p.project_landowners ? ` — ${p.project_landowners.landowner_name}` : ''}`
                      : 'Company (KSR)'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{modeLabel(p.mode) || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.reference_no || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {inr(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xl font-semibold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
