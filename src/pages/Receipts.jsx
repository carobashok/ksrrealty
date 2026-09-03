// src/pages/Receipts.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, Plus } from 'lucide-react';
import MultiBookingReceiptModal from '../components/MultiBookingReceiptModal';

const MODE_LABELS = { cash:'Cash', cheque:'Cheque', neft:'NEFT', rtgs:'RTGS', upi:'UPI', dd:'DD', imps:'IMPS' };
const modeLabel = (v) => MODE_LABELS[v] || v;
const inr = (n) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);

export default function Receipts() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch]             = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [typeFilter, setTypeFilter]     = useState('All');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  // Multi-booking receipt modal state
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [multiCustomer, setMultiCustomer]   = useState(null); // { id, name }
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list-simple'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('ksr').from('projects').select('id,name').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Customers with multiple bookings (for the multi-receipt button)
  const { data: multiCustomers = [] } = useQuery({
    queryKey: ['customers-multi-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('ksr')
        .from('bookings')
        .select('customer_id, customers(id, name, mobile)')
        .in('status', ['booked','registered']);
      if (error) throw error;
      // Count per customer, keep those with > 1
      const counts = {};
      data.forEach(b => {
        const id = b.customer_id;
        if (!counts[id]) counts[id] = { ...b.customers, count: 0 };
        counts[id].count++;
      });
      return Object.values(counts).filter(c => c.count > 1);
    },
  });

  // All payments — including split ones
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['all-receipts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('payments')
        .select(`
          id, payment_type, payment_date, amount, mode,
          reference_no, notes, booking_id, landowner_id,
          is_split, receipt_no,
          bookings (
            id,
            customers ( name, mobile ),
            projects ( id, name ),
            plots ( plot_number, block )
          ),
          project_landowners ( landowner_name ),
          booking_payment_splits (
            id, amount, remarks,
            bookings (
              customers ( name, mobile ),
              projects ( name ),
              plots ( plot_number, block )
            )
          )
        `)
        .eq('paid_by', 'plot_purchaser')
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = payments.filter(p => {
    const matchesType    = typeFilter === 'All' || p.payment_type === typeFilter;
    const matchesFrom    = !dateFrom || p.payment_date >= dateFrom;
    const matchesTo      = !dateTo   || p.payment_date <= dateTo;
    const q = search.toLowerCase();

    // For split payments, search across all splits
    const splitNames = p.booking_payment_splits?.map(s =>
      `${s.bookings?.customers?.name||''} ${s.bookings?.customers?.mobile||''} ${s.bookings?.plots?.plot_number||''}`
    ).join(' ').toLowerCase() || '';

    const matchesSearch = !q ||
      p.bookings?.customers?.name?.toLowerCase().includes(q) ||
      p.bookings?.customers?.mobile?.toLowerCase().includes(q) ||
      p.bookings?.plots?.plot_number?.toLowerCase().includes(q) ||
      p.reference_no?.toLowerCase().includes(q) ||
      splitNames.includes(q);

    // Project filter
    const matchesProject = projectFilter === 'All' ||
      p.bookings?.projects?.id === projectFilter ||
      p.booking_payment_splits?.some(s => s.bookings?.projects?.id === projectFilter);

    return matchesProject && matchesType && matchesFrom && matchesTo && matchesSearch;
  });

  const totalCollected = filtered.reduce((s,p) => s + Number(p.amount), 0);

  const filteredCustomers = multiCustomers.filter(c =>
    !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Receipts</h1>
          <p className="text-sm text-slate-500">All receipts collected from plot purchasers</p>
        </div>
        {/* Multi-booking receipt button */}
        <div style={{position:'relative'}}>
          <button
            onClick={() => setShowCustomerPicker(v => !v)}
            style={{
              display:'flex',alignItems:'center',gap:'6px',
              padding:'8px 16px',background:'#1B2A4A',color:'white',
              border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'
            }}
          >
            <Plus size={15}/> Multi-plot Receipt
          </button>
          {showCustomerPicker && (
            <div style={{
              position:'absolute',right:0,top:'42px',zIndex:100,
              background:'white',border:'1px solid #e2e8f0',borderRadius:'10px',
              boxShadow:'0 8px 30px rgba(0,0,0,0.12)',width:'280px',padding:'12px'
            }}>
              <div style={{fontSize:'12px',fontWeight:600,color:'#1B2A4A',marginBottom:'8px'}}>
                Select customer (multiple bookings)
              </div>
              <input
                value={customerSearch}
                onChange={e=>setCustomerSearch(e.target.value)}
                placeholder="Search customer..."
                style={{width:'100%',padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'12px',boxSizing:'border-box',marginBottom:'8px'}}
              />
              {filteredCustomers.length === 0 ? (
                <div style={{fontSize:'12px',color:'#94a3b8',padding:'8px 0'}}>
                  No customers with multiple active bookings
                </div>
              ) : (
                <div style={{maxHeight:'200px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'4px'}}>
                  {filteredCustomers.map(c => (
                    <button key={c.id}
                      onClick={() => {
                        setMultiCustomer(c);
                        setShowMultiModal(true);
                        setShowCustomerPicker(false);
                        setCustomerSearch('');
                      }}
                      style={{
                        width:'100%',textAlign:'left',padding:'8px 10px',
                        background:'#f8fafc',border:'1px solid #e2e8f0',
                        borderRadius:'6px',cursor:'pointer',fontSize:'12px'
                      }}
                    >
                      <div style={{fontWeight:600,color:'#1B2A4A'}}>{c.name}</div>
                      <div style={{color:'#64748b',fontSize:'11px'}}>{c.mobile} · {c.count} bookings</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Total Collected" value={inr(totalCollected)} />
        <SummaryCard label="Single-plot Receipts" value={filtered.filter(p=>!p.is_split).length} isCount />
        <SummaryCard label="Multi-plot Receipts" value={filtered.filter(p=>p.is_split).length} isCount />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, mobile, plot, reference..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
          />
        </div>
        <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30">
          <option value="All">All Projects</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"/>
        <span className="text-slate-400 text-sm">to</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"/>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading receipts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No payments match your filters</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Project / Plot</th>
                <th className="text-left px-4 py-3">Mode</th>
                <th className="text-left px-4 py-3">Reference</th>
                <th className="text-right px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                if (p.is_split) {
                  // Multi-booking receipt — show one row per split
                  return (p.booking_payment_splits || []).map((sp, i) => (
                    <tr key={`${p.id}-${sp.id}`}
                      onClick={() => navigate(`/bookings/${sp.bookings?.id || p.booking_id}`)}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-slate-600">
                        {i === 0
                          ? new Date(p.payment_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
                          : <span className="text-slate-300">↳</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {sp.bookings?.customers?.name || '—'}
                        </div>
                        {i === 0 && (
                          <span style={{
                            fontSize:'10px',fontWeight:600,padding:'1px 6px',
                            borderRadius:'10px',background:'#dbeafe',color:'#1e40af'
                          }}>Multi-plot</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {sp.bookings?.projects?.name || '—'}
                        {sp.bookings?.plots?.plot_number && (
                          <span className="text-slate-400"> · Plot {sp.bookings.plots.plot_number}</span>
                        )}
                        {sp.remarks && (
                          <div className="text-xs text-slate-400 mt-0.5">{sp.remarks}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {i === 0 ? modeLabel(p.mode) : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {i === 0 ? (p.reference_no || '—') : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        {inr(sp.amount)}
                        {i === 0 && p.booking_payment_splits?.length > 1 && (
                          <div className="text-xs text-slate-400">of {inr(p.amount)}</div>
                        )}
                      </td>
                    </tr>
                  ))
                }

                // Regular single-booking receipt
                return (
                  <tr key={p.id}
                    onClick={() => navigate(`/bookings/${p.booking_id}`)}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(p.payment_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{p.bookings?.customers?.name || '—'}</div>
                      <div className="text-slate-500 text-xs">{p.bookings?.customers?.mobile || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.bookings?.projects?.name || '—'}
                      {p.bookings?.plots?.plot_number && (
                        <span className="text-slate-400"> · Plot {p.bookings.plots.plot_number}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{modeLabel(p.mode) || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.reference_no || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{inr(p.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Multi-booking receipt modal */}
      {showMultiModal && multiCustomer && (
        <MultiBookingReceiptModal
          customerId={multiCustomer.id}
          customerName={multiCustomer.name}
          onClose={() => { setShowMultiModal(false); setMultiCustomer(null) }}
          onSaved={() => qc.invalidateQueries(['all-receipts'])}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, isCount }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xl font-semibold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
