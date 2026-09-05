// src/pages/Bookings.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, Plus } from 'lucide-react';

// Must exactly match the DB check constraint "bookings_status_check"
const STATUS_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'booked', label: 'Booked' },
  { value: 'agreement_signed', label: 'Agreement Signed' },
  { value: 'registered', label: 'Registered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLES = {
  booked: 'bg-blue-50 text-blue-700 border-blue-200',
  agreement_signed: 'bg-purple-50 text-purple-700 border-purple-200',
  registered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const statusLabel = (value) =>
  STATUS_OPTIONS.find((s) => s.value === value)?.label || value;


export default function Bookings() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCancelled, setShowCancelled] = useState(false);
  const [sortCol, setSortCol] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select(
          `
          id,
          booking_date,
          created_at,
          total_consideration,
          status,
          customers ( name, mobile ),
          projects ( name ),
          plots ( plot_number, block )
        `
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Live total paid per booking — includes both direct payments and split payments
  const { data: paidTotals = {} } = useQuery({
    queryKey: ['payments-totals-by-booking'],
    queryFn: async () => {
      // 1. Direct payments (booking_id set directly on payment)
      const { data: direct, error: e1 } = await supabase
        .schema('ksr')
        .from('payments')
        .select('booking_id, amount, paid_by')
        .neq('paid_by', 'ksr')
        .not('booking_id', 'is', null)
      if (e1) throw e1

      // 2. Split payments (booking_id stored in booking_payment_splits)
      const { data: splits, error: e2 } = await supabase
        .schema('ksr')
        .from('booking_payment_splits')
        .select('booking_id, amount')
      if (e2) throw e2

      // Merge both into totals per booking
      const totals = {}
      direct.forEach(p => {
        totals[p.booking_id] = (totals[p.booking_id] || 0) + Number(p.amount)
      })
      splits.forEach(s => {
        totals[s.booking_id] = (totals[s.booking_id] || 0) + Number(s.amount)
      })
      return totals
    },
  });

  const inr = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n || 0);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{color:'#cbd5e1',marginLeft:'4px'}}>↕</span>
    return <span style={{color:'#1B2A4A',marginLeft:'4px'}}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filtered = bookings.filter((b) => {
    if (b.status === 'cancelled' && !showCancelled) return false;
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      b.customers?.name?.toLowerCase().includes(q) ||
      b.customers?.mobile?.toLowerCase().includes(q) ||
      b.plots?.plot_number?.toLowerCase().includes(q) ||
      b.projects?.name?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortCol) {
      case 'customer':
        return dir * (a.customers?.name || '').localeCompare(b.customers?.name || '')
      case 'project':
        return dir * ((a.projects?.name || '') + (a.plots?.plot_number || '')).localeCompare(
          (b.projects?.name || '') + (b.plots?.plot_number || ''))
      case 'total_consideration':
        return dir * ((a.total_consideration || 0) - (b.total_consideration || 0))
      case 'total_paid':
        return dir * ((paidTotals[a.id] || 0) - (paidTotals[b.id] || 0))
      case 'status':
        const sOrder = { registered:0, agreement_signed:1, booked:2, cancelled:3 }
        return dir * ((sOrder[a.status] ?? 9) - (sOrder[b.status] ?? 9))
      case 'booking_date':
        return dir * (new Date(a.booking_date || 0) - new Date(b.booking_date || 0))
      case 'created_at':
      default:
        return dir * (new Date(a.created_at || 0) - new Date(b.created_at || 0))
    }
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Bookings</h1>
          <p className="text-sm text-slate-500">{bookings.length} total</p>
        </div>
        <button
          onClick={() => navigate('/bookings/new')}
          className="flex items-center gap-2 bg-[#0a1f44] text-white px-4 py-2 rounded-lg hover:bg-[#122a5c] transition"
        >
          <Plus size={18} />
          New Booking
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer, mobile, plot, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show Cancelled
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading bookings...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {search || statusFilter !== 'All'
              ? 'No bookings match your filters'
              : 'No bookings yet — create one to get started'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                {[
                  { col:'customer',           label:'Customer',             align:'left'  },
                  { col:'project',            label:'Project / Plot',       align:'left'  },
                  { col:'total_consideration',label:'Total Consideration',  align:'right' },
                  { col:'total_paid',         label:'Total Paid',           align:'right' },
                  { col:'status',             label:'Status',               align:'left'  },
                  { col:'booking_date',       label:'Booking Date',         align:'left'  },
                  { col:'created_at',         label:'Created Date',         align:'left'  },
                ].map(({ col, label, align }) => (
                  <th key={col}
                    className={`text-${align} px-4 py-3 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap`}
                    onClick={() => handleSort(col)}
                  >
                    {label}<SortIcon col={col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => navigate(`/bookings/${b.id}`)}
                  className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${b.status === 'cancelled' ? 'opacity-60 bg-red-50/30' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{b.customers?.name || '—'}</div>
                    <div className="text-slate-500 text-xs">{b.customers?.mobile || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {b.projects?.name || '—'}
                    {b.plots?.plot_number ? (
                      <span className="text-slate-400">
                        {' '}
                        · Plot {b.plots.plot_number}
                        {b.plots.block ? ` (${b.plots.block})` : ''}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {inr(b.total_consideration)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{inr(paidTotals[b.id])}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs border ${
                        STATUS_STYLES[b.status] || 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {statusLabel(b.status) || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {b.booking_date
                      ? new Date(b.booking_date).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {b.created_at
                      ? new Date(b.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })
                      : '—'}
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
