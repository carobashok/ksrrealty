// src/pages/Payments.jsx
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function Payments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

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

  // All JV bookings (ksr_owes_landowner > 0)
  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['outgoing-jv-bookings'],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select('id, status, ksr_owes_landowner, project_id, plot_id, customer_id, booking_date')
        .gt('ksr_owes_landowner', 0)
        .order('booking_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const bookingIds = bookings.map(b => b.id);

  // Fetch related data
  const { data: bookingDetails = [] } = useQuery({
    queryKey: ['outgoing-booking-details', bookingIds.join(',')],
    staleTime: 1000 * 60,
    enabled: bookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select('id, projects(id, name), plots(plot_number, block), customers(name, mobile)')
        .in('id', bookingIds);
      if (error) throw error;
      return data;
    },
  });

  // Landowner payments already made
  const { data: landownerPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['outgoing-landowner-paid', bookingIds.join(',')],
    staleTime: 1000 * 60,
    enabled: bookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('payments')
        .select('id, booking_id, amount, payment_date, mode, reference_no, notes')
        .eq('payment_type', 'landowner_share')
        .in('booking_id', bookingIds);
      if (error) throw error;
      return data;
    },
  });

  // Refunds
  const { data: refunds = [], isLoading: loadingRefunds } = useQuery({
    queryKey: ['outgoing-refunds'],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('cancellation_refunds')
        .select('id, booking_id, refund_date, amount, refund_type, reference_no')
        .order('refund_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refundBookingIds = [...new Set(refunds.map(r => r.booking_id))];
  const { data: refundBookingDetails = [] } = useQuery({
    queryKey: ['outgoing-refund-booking-details', refundBookingIds.join(',')],
    staleTime: 1000 * 60,
    enabled: refundBookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select('id, projects(id, name), plots(plot_number, block), customers(name, mobile)')
        .in('id', refundBookingIds);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingBookings || loadingPayments || loadingRefunds;

  // Build settlement history per booking
  const settlementsByBooking = landownerPayments.reduce((acc, p) => {
    if (!acc[p.booking_id]) acc[p.booking_id] = [];
    acc[p.booking_id].push(p);
    return acc;
  }, {});

  // Build lookup maps
  const detailMap = Object.fromEntries(bookingDetails.map(b => [b.id, b]));
  const refundDetailMap = Object.fromEntries(refundBookingDetails.map(b => [b.id, b]));

  // Paid per booking
  const paidPerBooking = landownerPayments.reduce((acc, p) => {
    acc[p.booking_id] = (acc[p.booking_id] || 0) + Number(p.amount);
    return acc;
  }, {});

  // Build landowner rows
  const landownerRows = bookings.map(b => {
    const detail = detailMap[b.id] || {};
    const paid = paidPerBooking[b.id] || 0;
    const outstanding = Number(b.ksr_owes_landowner) - paid;
    return {
      id: b.id,
      _type: 'landowner',
      date: b.booking_date,
      customerName: detail.customers?.name || '—',
      customerMobile: detail.customers?.mobile || '',
      projectId: detail.projects?.id,
      projectName: detail.projects?.name || '—',
      plotNumber: detail.plots?.plot_number,
      plotBlock: detail.plots?.block,
      status: b.status,
      owesTotal: Number(b.ksr_owes_landowner),
      paid,
      outstanding,
      navigateTo: `/bookings/${b.id}`,
    };
  });

  // Build refund rows
  const refundRows = refunds.map(r => {
    const detail = refundDetailMap[r.booking_id] || {};
    return {
      id: r.id,
      _type: 'refund',
      date: r.refund_date,
      customerName: detail.customers?.name || '—',
      customerMobile: detail.customers?.mobile || '',
      projectId: detail.projects?.id,
      projectName: detail.projects?.name || '—',
      plotNumber: detail.plots?.plot_number,
      plotBlock: detail.plots?.block,
      status: null,
      owesTotal: Number(r.amount),
      paid: Number(r.amount),
      outstanding: 0,
      label: r.refund_type === 'cash_refund' ? 'Customer Refund' : 'Adjusted to Booking',
      navigateTo: `/cancellations`,
    };
  });

  // Filter
  const filterRows = (rows) => rows.filter(r => {
    const matchesProject = projectFilter === 'All' || r.projectId === projectFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      r.customerName?.toLowerCase().includes(q) ||
      r.customerMobile?.toLowerCase().includes(q) ||
      r.plotNumber?.toLowerCase().includes(q) ||
      r.projectName?.toLowerCase().includes(q);
    return matchesProject && matchesSearch;
  });

  const filteredLandowner = filterRows(landownerRows);
  const filteredRefunds = filterRows(refundRows);

  // Totals
  const totalOwed = filteredLandowner.reduce((s, r) => s + r.owesTotal, 0);
  const totalPaid = filteredLandowner.reduce((s, r) => s + r.paid, 0);
  const totalOutstanding = filteredLandowner.reduce((s, r) => s + r.outstanding, 0);
  const totalRefunds = filteredRefunds.reduce((s, r) => s + r.owesTotal, 0);

  const statusBadge = (status) => {
    const styles = {
      booked: 'bg-blue-50 text-blue-700 border-blue-200',
      agreement_signed: 'bg-purple-50 text-purple-700 border-purple-200',
      registered: 'bg-green-50 text-green-700 border-green-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200',
    };
    const labels = { booked: 'Booked', agreement_signed: 'Agmt Signed', registered: 'Registered', cancelled: 'Cancelled' };
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${styles[status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Payments</h1>
        <p className="text-sm text-slate-500">Outgoing — landowner settlements and customer refunds</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Owed to Landowners" value={inr(totalOwed)} />
        <SummaryCard label="Settled" value={inr(totalPaid)} color="text-green-700" />
        <SummaryCard label="Outstanding" value={inr(totalOutstanding)} color="text-amber-700" />
        <SummaryCard label="Customer Refunds" value={inr(totalRefunds)} color="text-blue-700" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, plot, project..."
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
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Landowner Settlements */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Landowner Settlements</h2>
        <button
          onClick={() => setShowSettleModal(true)}
          disabled={filteredLandowner.filter(r => r.outstanding > 0).length === 0}
          className="flex items-center gap-2 bg-[#0a1f44] text-white px-3 py-2 rounded-lg text-sm hover:bg-[#122a5c] disabled:opacity-50"
        >
          + Record Settlement
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : filteredLandowner.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No JV bookings found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Project / Plot</th>
                <th className="text-center px-4 py-3">Booking Status</th>
                <th className="text-right px-4 py-3">KSR Owes</th>
                <th className="text-right px-4 py-3">Settled</th>
                <th className="text-right px-4 py-3">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {filteredLandowner.map((r) => {
                const isExpanded = expandedRow === r.id;
                const settlements = settlementsByBooking[r.id] || [];
                return (
                  <>
                    <tr
                      key={r.id}
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                          <div>
                            <div className="font-medium text-slate-800">{r.customerName}</div>
                            <div className="text-xs text-slate-500">{r.customerMobile}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.projectName}
                        {r.plotNumber && (
                          <span className="text-slate-400"> · Plot {r.plotNumber}{r.plotBlock ? ` (${r.plotBlock})` : ''}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{inr(r.owesTotal)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{inr(r.paid)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${r.outstanding > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                        {inr(r.outstanding)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.id}-detail`} className="bg-slate-50">
                        <td colSpan={6} className="px-6 py-3">
                          {settlements.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No settlements recorded yet</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-slate-500 uppercase">
                                  <th className="text-left py-1 pr-4">Date</th>
                                  <th className="text-left py-1 pr-4">Mode</th>
                                  <th className="text-left py-1 pr-4">Reference</th>
                                  <th className="text-left py-1 pr-4">Notes</th>
                                  <th className="text-right py-1">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {settlements.map(s => (
                                  <tr key={s.id} className="border-t border-slate-200">
                                    <td className="py-1.5 pr-4 text-slate-600">
                                      {new Date(s.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="py-1.5 pr-4 text-slate-600 uppercase text-xs">{s.mode || '—'}</td>
                                    <td className="py-1.5 pr-4 text-slate-600">{s.reference_no || '—'}</td>
                                    <td className="py-1.5 pr-4 text-slate-500 text-xs">{s.notes || '—'}</td>
                                    <td className="py-1.5 text-right font-medium text-green-700">{inr(s.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-sm">
                <td className="px-4 py-3 text-slate-700" colSpan={3}>Total</td>
                <td className="px-4 py-3 text-right text-slate-800">{inr(totalOwed)}</td>
                <td className="px-4 py-3 text-right text-green-700">{inr(totalPaid)}</td>
                <td className={`px-4 py-3 text-right ${totalOutstanding > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{inr(totalOutstanding)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Customer Refunds */}
      <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Customer Refunds</h2>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filteredRefunds.length === 0 ? (
          <div className="p-6 text-center text-slate-400">No refunds recorded</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Project / Plot</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredRefunds.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(r.navigateTo)}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{r.customerName}</div>
                    <div className="text-xs text-slate-500">{r.customerMobile}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.projectName}
                    {r.plotNumber && (
                      <span className="text-slate-400"> · Plot {r.plotNumber}{r.plotBlock ? ` (${r.plotBlock})` : ''}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.label}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{inr(r.owesTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showSettleModal && (
        <SettleModal
          rows={filteredLandowner}
          onClose={() => setShowSettleModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['outgoing-landowner-paid'] });
            queryClient.invalidateQueries({ queryKey: ['outgoing-jv-bookings'] });
            setShowSettleModal(false);
            toast.success('Settlement recorded');
          }}
        />
      )}
    </div>
  );
}

function SettleModal({ rows, onClose, onSuccess }) {
  const [form, setForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    amount: '',
    mode: 'neft',
    reference_no: '',
    notes: '',
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const outstandingRows = rows.filter(r => r.outstanding > 0);

  const toggleRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedIds(prev =>
      prev.length === outstandingRows.length ? [] : outstandingRows.map(r => r.id)
    );
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) { toast.error('Select at least one plot'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!form.reference_no.trim()) { toast.error('Enter reference number'); return; }
    setSaving(true);
    try {
      const payments = selectedIds.map(bookingId => ({
        booking_id: bookingId,
        payment_type: 'landowner_share',
        payment_date: form.payment_date,
        amount: Number(form.amount),
        mode: form.mode,
        reference_no: form.reference_no.trim(),
        notes: form.notes || null,
      }));
      const { error } = await supabase
        .schema('ksr')
        .from('payments')
        .insert(payments);
      if (error) throw error;
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to record settlement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Record Landowner Settlement</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Payment details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Payment Date</label>
              <input type="date" value={form.payment_date}
                onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Amount per Plot (₹)</label>
              <input type="number" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="Enter amount"
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Mode</label>
              <select value={form.mode}
                onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30">
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="imps">IMPS</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="dd">DD</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Reference No. *</label>
              <input type="text" value={form.reference_no}
                onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))}
                placeholder="UTR / Cheque no."
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <input type="text" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
          </div>

          {/* Plot selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Select Plots to Settle</label>
              <button onClick={toggleAll} className="text-xs text-[#0a1f44] hover:underline">
                {selectedIds.length === outstandingRows.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="text-left px-3 py-2">Customer</th>
                    <th className="text-left px-3 py-2">Project / Plot</th>
                    <th className="text-right px-3 py-2">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingRows.map(r => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleRow(r.id)}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedIds.includes(r.id)}
                          onChange={() => toggleRow(r.id)}
                          className="rounded border-slate-300" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{r.customerName}</div>
                        <div className="text-xs text-slate-500">{r.customerMobile}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.projectName}
                        {r.plotNumber && <span className="text-slate-400"> · Plot {r.plotNumber}</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-700 font-medium">{inr(r.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedIds.length > 0 && form.amount && (
              <p className="text-xs text-slate-500 mt-2">
                {selectedIds.length} plot{selectedIds.length > 1 ? 's' : ''} × {inr(Number(form.amount))} = <span className="font-semibold text-slate-700">{inr(selectedIds.length * Number(form.amount))}</span> total outgoing
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || selectedIds.length === 0}
            className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg text-sm hover:bg-[#122a5c] disabled:opacity-50">
            {saving ? 'Saving...' : `Record for ${selectedIds.length} Plot${selectedIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color = 'text-slate-800' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
