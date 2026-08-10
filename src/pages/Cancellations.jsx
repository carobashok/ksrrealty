// src/pages/Cancellations.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Plus, X, Download } from 'lucide-react';

const inr = (n) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN');

const REFUND_TYPE_LABELS = {
  cash_refund: 'Cash Refund',
  adjusted_to_booking: 'Adjusted to New Booking',
};

export default function Cancellations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Fetch all cancelled bookings
  const { data: cancellations = [], isLoading } = useQuery({
    queryKey: ['cancellations-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select(`
          id, booking_date, cancellation_date, cancellation_reason,
          forfeiture_amount, refund_due, cancellation_notes, status,
          total_consideration, company_share_amt, customer_id,
          customers ( name, mobile ),
          projects ( name ),
          plots ( plot_number, block ),
          employees!cancelled_by ( name )
        `)
        .eq('status', 'cancelled')
        .order('cancellation_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch total paid per cancelled booking
  const { data: paidTotals = {} } = useQuery({
    queryKey: ['cancellations-paid-totals'],
    queryFn: async () => {
      const ids = cancellations.map(c => c.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .schema('ksr')
        .from('payments')
        .select('booking_id, amount')
        .in('booking_id', ids);
      if (error) throw error;
      return data.reduce((acc, p) => {
        acc[p.booking_id] = (acc[p.booking_id] || 0) + Number(p.amount);
        return acc;
      }, {});
    },
    enabled: cancellations.length > 0,
  });

  // Fetch refunds already made
  const { data: refunds = [] } = useQuery({
    queryKey: ['cancellations-refunds'],
    queryFn: async () => {
      const ids = cancellations.map(c => c.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .schema('ksr')
        .from('cancellation_refunds')
        .select('*')
        .in('booking_id', ids)
        .order('refund_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: cancellations.length > 0,
  });

  // Refunds by booking
  const refundsByBooking = refunds.reduce((acc, r) => {
    if (!acc[r.booking_id]) acc[r.booking_id] = [];
    acc[r.booking_id].push(r);
    return acc;
  }, {});

  const refundedTotals = refunds.reduce((acc, r) => {
    acc[r.booking_id] = (acc[r.booking_id] || 0) + Number(r.amount);
    return acc;
  }, {});

  const selectedCancellation = cancellations.find(c => c.id === selectedBookingId);

  // CSV export
  const handleExport = () => {
    const headers = [
      'Customer', 'Mobile', 'Project', 'Plot',
      'Cancellation Date', 'Reason', 'Total Paid',
      'Forfeiture', 'Refund Due', 'Refund Made', 'Refund Outstanding'
    ];
    const rows = cancellations.map(c => {
      const paid = paidTotals[c.id] || 0;
      const refunded = refundedTotals[c.id] || 0;
      const outstanding = (c.refund_due || 0) - refunded;
      return [
        c.customers?.name, c.customers?.mobile,
        c.projects?.name,
        `Plot ${c.plots?.plot_number}${c.plots?.block ? ` (${c.plots.block})` : ''}`,
        c.cancellation_date || '',
        c.cancellation_reason || '',
        paid, c.forfeiture_amount || 0,
        c.refund_due || 0, refunded, outstanding
      ];
    });
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ksr-cancellations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Cancellations</h1>
          <p className="text-sm text-slate-500">{cancellations.length} cancelled booking{cancellations.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={cancellations.length === 0}
          className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading cancellations...</div>
        ) : cancellations.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No cancelled bookings yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Project / Plot</th>
                <th className="text-center px-4 py-3">Cancel Date</th>
                <th className="text-left px-4 py-3">Reason</th>
                <th className="text-right px-4 py-3">Total Paid</th>
                <th className="text-right px-4 py-3">Forfeiture</th>
                <th className="text-right px-4 py-3">Refund Due</th>
                <th className="text-right px-4 py-3">Refund Made</th>
                <th className="text-right px-4 py-3">Outstanding</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {cancellations.map((c) => {
                const paid = paidTotals[c.id] || 0;
                const refunded = refundedTotals[c.id] || 0;
                const outstanding = (c.refund_due || 0) - refunded;
                return (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{c.customers?.name || '—'}</div>
                      <div className="text-xs text-slate-500">{c.customers?.mobile || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.projects?.name || '—'}
                      {c.plots?.plot_number && (
                        <span className="text-slate-400"> · Plot {c.plots.plot_number}{c.plots.block ? ` (${c.plots.block})` : ''}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {c.cancellation_date
                        ? new Date(c.cancellation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {c.cancellation_reason?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{inr(paid)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{inr(c.forfeiture_amount)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{inr(c.refund_due)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{inr(refunded)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${outstanding > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {inr(outstanding)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/bookings/${c.id}`)}
                          className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 text-slate-600"
                        >
                          View
                        </button>
                        {outstanding > 0 && (
                          <button
                            onClick={() => { setSelectedBookingId(c.id); setShowRefundModal(true); }}
                            className="text-xs px-2 py-1 bg-[#0a1f44] text-white rounded hover:bg-[#122a5c]"
                          >
                            + Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Refund history per booking — expandable below table */}
      {cancellations.map(c => {
        const bookingRefunds = refundsByBooking[c.id] || [];
        if (bookingRefunds.length === 0) return null;
        return (
          <div key={`refunds-${c.id}`} className="mt-4 bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">
              Refund History — {c.customers?.name} · {c.projects?.name} Plot {c.plots?.plot_number}
            </p>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left py-1">Date</th>
                  <th className="text-left py-1">Type</th>
                  <th className="text-right py-1">Amount</th>
                  <th className="text-left py-1">Reference</th>
                  <th className="text-left py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {bookingRefunds.map(r => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">
                      {new Date(r.refund_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-1.5 text-slate-600">{REFUND_TYPE_LABELS[r.refund_type] || r.refund_type}</td>
                    <td className="py-1.5 text-right text-green-700 font-medium">{inr(r.amount)}</td>
                    <td className="py-1.5 text-slate-500">{r.reference_no || '—'}</td>
                    <td className="py-1.5 text-slate-500">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Refund Modal */}
      {showRefundModal && selectedCancellation && (
        <RefundModal
          cancellation={selectedCancellation}
          refundedSoFar={refundedTotals[selectedBookingId] || 0}
          allBookings={cancellations}
          onClose={() => { setShowRefundModal(false); setSelectedBookingId(null); }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['cancellations-refunds'] });
            queryClient.invalidateQueries({ queryKey: ['cancellations-list'] });
            setShowRefundModal(false);
            setSelectedBookingId(null);
            toast.success('Refund recorded');
          }}
        />
      )}
    </div>
  );
}

function RefundModal({ cancellation, refundedSoFar, allBookings, onClose, onSuccess }) {
  const outstanding = (cancellation.refund_due || 0) - refundedSoFar;
  const [form, setForm] = useState({
    refund_date: new Date().toISOString().slice(0, 10),
    refund_type: 'cash_refund',
    amount: outstanding,
    adjusted_to_booking_id: '',
    reference_no: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Fetch other bookings for this customer to adjust against
  const { data: customerBookings = [] } = useQuery({
    queryKey: ['customer-bookings-for-adjustment', cancellation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select('id, projects(name), plots(plot_number)')
        .eq('customer_id', cancellation.customer_id)
        .neq('id', cancellation.id)
        .neq('status', 'cancelled');
      if (error) throw error;
      return data;
    },
  });

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Enter a valid refund amount');
      return;
    }
    if (Number(form.amount) > outstanding) {
      toast.error(`Amount cannot exceed outstanding refund of ${inr(outstanding)}`);
      return;
    }
    if (form.refund_type === 'adjusted_to_booking' && !form.adjusted_to_booking_id) {
      toast.error('Select the booking to adjust against');
      return;
    }
    setSaving(true);
    try {
      // 1. Record in cancellation_refunds
      const { error: refundErr } = await supabase
        .schema('ksr')
        .from('cancellation_refunds')
        .insert({
          booking_id: cancellation.id,
          refund_date: form.refund_date,
          refund_type: form.refund_type,
          amount: Number(form.amount),
          adjusted_to_booking_id: form.refund_type === 'adjusted_to_booking' ? form.adjusted_to_booking_id : null,
          reference_no: form.reference_no || null,
          notes: form.notes || null,
        });
      if (refundErr) throw refundErr;

      // 2. If adjusted to new booking, also create a company_share payment in that booking
      if (form.refund_type === 'adjusted_to_booking' && form.adjusted_to_booking_id) {
        const { error: paymentErr } = await supabase
          .schema('ksr')
          .from('payments')
          .insert({
            booking_id: form.adjusted_to_booking_id,
            payment_type: 'company_share',
            payment_date: form.refund_date,
            amount: Number(form.amount),
            mode: 'neft',
            reference_no: form.reference_no || null,
            notes: `Adjusted from cancelled booking — ${cancellation.projects?.name || ''} Plot ${cancellation.plots?.plot_number || ''}${form.notes ? ` | ${form.notes}` : ''}`,
          });
        if (paymentErr) throw paymentErr;
      }

      // 3. If held for customer, create a customer_deposit entry
      if (form.refund_type === 'held_for_customer') {
        const { error: depositErr } = await supabase
          .schema('ksr')
          .from('customer_deposits')
          .insert({
            customer_id: cancellation.customer_id,
            deposit_date: form.refund_date,
            amount: Number(form.amount),
            mode: 'neft',
            reference_no: form.reference_no || null,
            notes: `From cancelled booking — ${cancellation.projects?.name || ''} Plot ${cancellation.plots?.plot_number || ''}${form.notes ? ` | ${form.notes}` : ''}`,
            status: 'held',
          });
        if (depositErr) throw depositErr;
      }

      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to record refund');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Record Refund</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Summary */}
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Refund Due</span>
              <span className="font-medium">{inr(cancellation.refund_due)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Already Refunded</span>
              <span className="text-green-700">{inr(refundedSoFar)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
              <span className="text-slate-700 font-medium">Outstanding</span>
              <span className="font-semibold text-amber-700">{inr(outstanding)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Refund Date</label>
            <input type="date" value={form.refund_date}
              onChange={e => setForm(f => ({ ...f, refund_date: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Refund Type</label>
            <select value={form.refund_type}
              onChange={e => setForm(f => ({ ...f, refund_type: e.target.value, adjusted_to_booking_id: '' }))}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30">
              <option value="cash_refund">Cash Refund</option>
              <option value="adjusted_to_booking">Adjusted to New Booking</option>
              <option value="held_for_customer">Hold for Customer (No Plot Yet)</option>
            </select>
          </div>

          {form.refund_type === 'adjusted_to_booking' && (
            <div>
              <label className="text-xs font-medium text-slate-500">Adjust Against Booking</label>
              <select value={form.adjusted_to_booking_id}
                onChange={e => setForm(f => ({ ...f, adjusted_to_booking_id: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30">
                <option value="">Select booking...</option>
                {customerBookings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.projects?.name} — Plot {b.plots?.plot_number}
                  </option>
                ))}
              </select>
              {customerBookings.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No other active bookings found for this customer</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500">Amount (₹)</label>
            <input type="number" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Reference No.</label>
            <input type="text" value={form.reference_no}
              onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))}
              placeholder="UTR / Cheque no. / etc."
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <textarea value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg text-sm hover:bg-[#122a5c] disabled:opacity-50">
            {saving ? 'Saving...' : 'Record Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}
