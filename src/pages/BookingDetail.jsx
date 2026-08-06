// src/pages/BookingDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Pencil, Trash2, X, FileText, Receipt, Ban, ChevronDown } from 'lucide-react';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'upi', label: 'UPI' },
  { value: 'dd', label: 'DD' },
  { value: 'imps', label: 'IMPS' },
];

const modeLabel = (value) => PAYMENT_MODES.find((m) => m.value === value)?.label || value;

const STATUS_STYLES = {
  booked: 'bg-blue-50 text-blue-700 border-blue-200',
  agreement_signed: 'bg-purple-50 text-purple-700 border-purple-200',
  registered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS = {
  booked: 'Booked',
  agreement_signed: 'Agreement Signed',
  registered: 'Registered',
  cancelled: 'Cancelled',
};

export default function BookingDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentType, setPaymentType] = useState('company_share'); // 'company_share' | 'landowner_share'
  const [landownerId, setLandownerId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [isConstructionPayment, setIsConstructionPayment] = useState(false);

  const [editingPayment, setEditingPayment] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [constructionIncluded, setConstructionIncluded] = useState(false);
  const [constructionArea, setConstructionArea] = useState('');
  const [constructionRate, setConstructionRate] = useState('');
  const [constructionSynced, setConstructionSynced] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [agreementDate, setAgreementDate] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [registrationDocNo, setRegistrationDocNo] = useState('');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundDate, setRefundDate] = useState(new Date().toISOString().slice(0, 10));
  const [refundMode, setRefundMode] = useState('cash');
  const [refundReference, setRefundReference] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-detail', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select(
          `
          *,
          customers ( id, name, mobile, email ),
          projects ( id, name, is_jv ),
          plots ( id, plot_number, block, area_sqft ),
          assigned_executive:employees!assigned_executive_id ( id, name, role ),
          channel_partners ( id, name, partner_code )
        `
        )
        .eq('id', bookingId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: landowners = [] } = useQuery({
    queryKey: ['project-landowners', booking?.project_id],
    enabled: !!booking?.project_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('project_landowners')
        .select('id, landowner_name, share_pct, bank_name, account_no, ifsc_code')
        .eq('project_id', booking.project_id)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!amount || Number(amount) <= 0) throw new Error('Enter a valid amount');
      if (paymentType === 'landowner_share' && !landownerId)
        throw new Error('Select which landowner this payment is for');

      const { error } = await supabase.schema('ksr').from('payments').insert({
        booking_id: bookingId,
        payment_type: paymentType,
        landowner_id: paymentType === 'landowner_share' ? landownerId : null,
        payment_date: paymentDate,
        amount: Number(amount),
        mode,
        reference_no: referenceNo.trim() || null,
        notes: notes.trim() || null,
        is_construction: paymentType === 'company_share' ? isConstructionPayment : false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['payments', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['payments-totals-by-booking'] });
      setShowAddPayment(false);
      setAmount('');
      setReferenceNo('');
      setNotes('');
      setLandownerId('');
      setIsConstructionPayment(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to record payment'),
  });

  const openEditPayment = (p) => {
    setEditingPayment(p);
    setEditForm({
      payment_type: p.payment_type,
      landowner_id: p.landowner_id || '',
      payment_date: p.payment_date,
      amount: p.amount,
      mode: p.mode || 'cash',
      reference_no: p.reference_no || '',
      notes: p.notes || '',
      is_construction: p.is_construction || false,
    });
  };

  const updatePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!editForm.amount || Number(editForm.amount) <= 0) throw new Error('Enter a valid amount');
      if (editForm.payment_type === 'landowner_share' && !editForm.landowner_id)
        throw new Error('Select which landowner this payment is for');

      const { error } = await supabase
        .schema('ksr')
        .from('payments')
        .update({
          payment_type: editForm.payment_type,
          landowner_id: editForm.payment_type === 'landowner_share' ? editForm.landowner_id : null,
          payment_date: editForm.payment_date,
          amount: Number(editForm.amount),
          mode: editForm.mode,
          reference_no: editForm.reference_no.trim() || null,
          notes: editForm.notes.trim() || null,
          is_construction: editForm.payment_type === 'company_share' ? editForm.is_construction : false,
        })
        .eq('id', editingPayment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment updated');
      queryClient.invalidateQueries({ queryKey: ['payments', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['payments-totals-by-booking'] });
      setEditingPayment(null);
      setEditForm(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to update payment'),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.schema('ksr').from('payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment deleted');
      queryClient.invalidateQueries({ queryKey: ['payments', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['payments-totals-by-booking'] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to delete payment'),
  });

  const openStatusModal = (status) => {
    setNewStatus(status);
    setAgreementDate(booking.agreement_signed_date || new Date().toISOString().slice(0, 10));
    setRegistrationDate(booking.registration_date || new Date().toISOString().slice(0, 10));
    setRegistrationDocNo(booking.registration_doc_no || '');
    setShowStatusModal(true);
  };

  const statusChangeMutation = useMutation({
    mutationFn: async (targetStatus) => {
      const status = targetStatus ?? newStatus;
      const payload = { status };
      if (status === 'agreement_signed') {
        if (!agreementDate) throw new Error('Enter the agreement signed date');
        payload.agreement_signed_date = agreementDate;
      }
      if (status === 'registered') {
        if (!registrationDate) throw new Error('Enter the registration date');
        if (!registrationDocNo.trim()) throw new Error('Enter the registration document number');
        payload.agreement_signed_date = agreementDate || null;
        payload.registration_date = registrationDate;
        payload.registration_doc_no = registrationDocNo.trim();
      }
      const { error } = await supabase.schema('ksr').from('bookings').update(payload).eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
      setShowStatusModal(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to update status'),
  });

  // Sync construction fields from the booking once it loads, only once —
  // after that, the checkbox/fields are fully user-controlled.
  useEffect(() => {
    if (booking && !constructionSynced) {
      const hasConstruction = booking.construction_amount != null;
      setConstructionIncluded(hasConstruction);
      setConstructionArea(booking.construction_area_sqft ?? '');
      setConstructionRate(booking.construction_rate_per_sqft ?? '');
      setConstructionSynced(true);
    }
  }, [booking, constructionSynced]);

  const constructionAmount =
    constructionIncluded && constructionArea && constructionRate
      ? Math.round(Number(constructionArea) * Number(constructionRate))
      : 0;

  const saveConstructionMutation = useMutation({
    mutationFn: async () => {
      const payload = constructionIncluded
        ? {
            construction_area_sqft: constructionArea ? Number(constructionArea) : null,
            construction_rate_per_sqft: constructionRate ? Number(constructionRate) : null,
            construction_amount: constructionAmount || null,
          }
        : {
            construction_area_sqft: null,
            construction_rate_per_sqft: null,
            construction_amount: null,
          };
      const { error } = await supabase.schema('ksr').from('bookings').update(payload).eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(constructionIncluded ? 'Construction details saved' : 'Construction details cleared');
      queryClient.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to save construction details'),
  });

  const inr = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n || 0);

  if (isLoading) return <div className="p-6 text-slate-400">Loading booking...</div>;
  if (!booking) return <div className="p-6 text-slate-400">Booking not found.</div>;

  const isJv = booking.projects?.is_jv;

  // Company share ledger
  const companyPaid = payments
    .filter((p) => p.payment_type === 'company_share')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const companyDue = (Number(booking.company_share_amt) || 0) + (Number(booking.construction_amount) || 0);
  const companyBalance = companyDue - companyPaid;

  // Landowner-wise ledger (JV only)
  const landownerLedger = landowners.map((lo) => {
    const due = (Number(booking.landowner_share_amt) * Number(lo.share_pct)) / 100;
    const paid = payments
      .filter((p) => p.payment_type === 'landowner_share' && p.landowner_id === lo.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return { ...lo, due, paid, balance: due - paid };
  });

  const totalPaid =
    companyPaid + landownerLedger.reduce((sum, lo) => sum + lo.paid, 0);
  const landDue = Number(booking.total_consideration) || 0;
  const constructionDue = Number(booking.construction_amount) || 0;
  const totalDue = landDue + constructionDue;
  const totalBalance = totalDue - totalPaid;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/bookings')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} /> Back to Bookings
        </button>
        <button
          onClick={() => navigate(`/bookings/${bookingId}/quotation`)}
          className="flex items-center gap-2 text-sm border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50"
        >
          <FileText size={16} /> Generate Quotation
        </button>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">
              {booking.customers?.name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {booking.projects?.name} · Plot {booking.plots?.plot_number}
              {booking.plots?.block ? ` (${booking.plots.block})` : ''} ·{' '}
              {booking.plots?.area_sqft} Sq.ft
            </p>
            <p className="text-sm text-slate-500">
              {booking.customers?.mobile} {booking.customers?.email ? `· ${booking.customers.email}` : ''}
            </p>
            {booking.assigned_executive?.name && (
              <p className="text-sm text-slate-500 mt-1">
                Assigned Executive: <span className="font-medium text-slate-700">{booking.assigned_executive.name}</span>
              </p>
            )}
            {booking.channel_partners?.name && (
              <p className="text-sm text-slate-500 mt-1">
                Channel Partner: <span className="font-medium text-slate-700">{booking.channel_partners.name}</span>
                {booking.channel_partners.partner_code ? ` (${booking.channel_partners.partner_code})` : ''}
              </p>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu((s) => !s)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${
                STATUS_STYLES[booking.status] || 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {STATUS_LABELS[booking.status] || booking.status}
              <ChevronDown size={12} className={showStatusMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 w-40">
                {Object.keys(STATUS_LABELS).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setShowStatusMenu(false);
                      if (s === booking.status) return;
                      if (s === 'agreement_signed' || s === 'registered') {
                        openStatusModal(s);
                      } else {
                        statusChangeMutation.mutate(s);
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
          <div>
            <div className="text-slate-400 text-xs">Land Cost</div>
            <div className="font-medium text-slate-700">{inr(booking.land_cost)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs">Reg Charge</div>
            <div className="font-medium text-slate-700">{inr(booking.reg_charge_amount)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs">Document Charge</div>
            <div className="font-medium text-slate-700">{inr(booking.document_charge_amount)}</div>
          </div>
        </div>
      </div>

      {/* Registration Details — only shown once at least one field is captured */}
      {(booking.agreement_signed_date || booking.registration_date || booking.registration_doc_no) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
            Registration Details
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {booking.agreement_signed_date && (
              <div>
                <div className="text-slate-400 text-xs">Agreement Signed Date</div>
                <div className="font-medium text-slate-700">
                  {new Date(booking.agreement_signed_date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
            {booking.registration_date && (
              <div>
                <div className="text-slate-400 text-xs">Registration Date</div>
                <div className="font-medium text-slate-700">
                  {new Date(booking.registration_date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
            {booking.registration_doc_no && (
              <div>
                <div className="text-slate-400 text-xs">Registration Document No.</div>
                <div className="font-medium text-slate-700">{booking.registration_doc_no}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Construction Details — checkbox pattern, matches "Registration same as customer" */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide cursor-pointer">
          <input
            type="checkbox"
            checked={constructionIncluded}
            onChange={(e) => setConstructionIncluded(e.target.checked)}
          />
          Construction Included
        </label>

        {constructionIncluded && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-4 text-sm mb-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Construction Area (Sq.ft)</label>
                <input
                  type="number"
                  value={constructionArea}
                  onChange={(e) => setConstructionArea(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Construction Rate (₹/Sq.ft)</label>
                <input
                  type="number"
                  value={constructionRate}
                  onChange={(e) => setConstructionRate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Amount</label>
                <div className="mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700">
                  {inr(constructionAmount)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-2">
          <button
            onClick={() => saveConstructionMutation.mutate()}
            disabled={saveConstructionMutation.isPending}
            className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50 text-sm"
          >
            {saveConstructionMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Overall summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
          Overall Summary
        </h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <SummaryBox
            label="Total Consideration"
            value={inr(totalDue)}
            subtitle={constructionDue > 0 ? `Land: ${inr(landDue)} · Construction: ${inr(constructionDue)}` : null}
          />
          <SummaryBox label="Total Paid" value={inr(totalPaid)} tone="text-green-700" />
          <SummaryBox
            label="Balance Due"
            value={inr(totalBalance)}
            tone={totalBalance > 0 ? 'text-red-700' : 'text-green-700'}
          />
        </div>
      </div>

      {/* Company Share ledger */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
          Company (KSR) Share
        </h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <SummaryBox label="Due" value={inr(companyDue)} />
          <SummaryBox label="Paid" value={inr(companyPaid)} tone="text-green-700" />
          <SummaryBox
            label="Balance"
            value={inr(companyBalance)}
            tone={companyBalance > 0 ? 'text-red-700' : 'text-green-700'}
          />
        </div>
      </div>

      {/* Landowner-wise ledger */}
      {isJv && landownerLedger.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
            Landowner Share
          </h3>
          <div className="space-y-3">
            {landownerLedger.map((lo) => (
              <div key={lo.id} className="border border-slate-100 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-slate-800 text-sm">
                    {lo.landowner_name} ({lo.share_pct}%)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <SummaryBox label="Due" value={inr(lo.due)} compact />
                  <SummaryBox label="Paid" value={inr(lo.paid)} tone="text-green-700" compact />
                  <SummaryBox
                    label="Balance"
                    value={inr(lo.balance)}
                    tone={lo.balance > 0 ? 'text-red-700' : 'text-green-700'}
                    compact
                  />
                </div>
              </div>
            ))}
          </div>

          {booking.ksr_owes_landowner != null && (
            <div className="mt-4 space-y-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-amber-800">KSR Owes Landowner (overall, settled later)</span>
                  <span className="font-semibold text-amber-900">{inr(booking.ksr_owes_landowner)}</span>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  Snapshot at booking time — (plot area in Cents × Landowner Rate/Cent) − GLV already paid by the customer.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-800">KSR Net Realisation</span>
                  <span className="font-semibold text-green-900">
                    {inr((Number(booking.company_share_amt) || 0) - (Number(booking.ksr_owes_landowner) || 0))}
                  </span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  Company Share − KSR Owes Landowner
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment history + Add Payment */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Payment History
          </h3>
          <button
            onClick={() => setShowAddPayment((s) => !s)}
            className="flex items-center gap-1 text-sm bg-[#0a1f44] text-white px-3 py-1.5 rounded-lg hover:bg-[#122a5c]"
          >
            <Plus size={14} /> Add Payment
          </button>
        </div>

        {showAddPayment && (
          <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Payment For</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="company_share">Company (KSR) Share</option>
                  {isJv && <option value="landowner_share">Landowner Share</option>}
                </select>
              </div>
              {paymentType === 'landowner_share' && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Landowner *</label>
                  <select
                    value={landownerId}
                    onChange={(e) => setLandownerId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    {landowners.map((lo) => (
                      <option key={lo.id} value={lo.id}>
                        {lo.landowner_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {paymentType === 'company_share' && booking.construction_amount != null && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={isConstructionPayment}
                  onChange={(e) => setIsConstructionPayment(e.target.checked)}
                />
                This is a construction payment
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Amount *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Date *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Reference No.</label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddPayment(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => addPaymentMutation.mutate()}
                disabled={addPaymentMutation.isPending}
                className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50 text-sm"
              >
                {addPaymentMutation.isPending ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </div>
        )}

        {payments.length === 0 ? (
          <div className="text-slate-400 text-sm py-4">No payments recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-xs uppercase">
              <tr>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Mode</th>
                <th className="text-left py-2">Reference</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-right py-2"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const lo = landowners.find((l) => l.id === p.landowner_id);
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-600">
                      {new Date(p.payment_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-2 text-slate-600">
                      {p.payment_type === 'landowner_share'
                        ? `Landowner${lo ? ` — ${lo.landowner_name}` : ''}`
                        : 'Company (KSR)'}
                      {p.is_construction && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-orange-50 text-orange-700 border border-orange-200">
                          🏗 Construction
                        </span>
                      )}
                      {p.notes ? <span className="text-slate-400"> · {p.notes}</span> : ''}
                    </td>
                    <td className="py-2 text-slate-600">{modeLabel(p.mode) || '—'}</td>
                    <td className="py-2 text-slate-600">{p.reference_no || '—'}</td>
                    <td className="py-2 text-right font-medium text-slate-800">
                      {inr(p.amount)}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/bookings/${bookingId}/payments/${p.id}/receipt`)}
                        className="p-1 text-slate-400 hover:text-[#0a1f44] hover:bg-slate-100 rounded"
                        title="Generate Receipt"
                      >
                        <Receipt size={14} />
                      </button>
                      <button
                        onClick={() => openEditPayment(p)}
                        className="p-1 text-slate-400 hover:text-[#0a1f44] hover:bg-slate-100 rounded ml-1"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded ml-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Payment Modal */}
      {editingPayment && editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Edit Payment</h2>
              <button
                onClick={() => {
                  setEditingPayment(null);
                  setEditForm(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Payment For</label>
                  <select
                    value={editForm.payment_type}
                    onChange={(e) => setEditForm({ ...editForm, payment_type: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="company_share">Company (KSR) Share</option>
                    {isJv && <option value="landowner_share">Landowner Share</option>}
                  </select>
                </div>
                {editForm.payment_type === 'landowner_share' && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Landowner *</label>
                    <select
                      value={editForm.landowner_id}
                      onChange={(e) => setEditForm({ ...editForm, landowner_id: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="">Select...</option>
                      {landowners.map((lo) => (
                        <option key={lo.id} value={lo.id}>
                          {lo.landowner_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {editForm.payment_type === 'company_share' && booking.construction_amount != null && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={editForm.is_construction}
                    onChange={(e) => setEditForm({ ...editForm, is_construction: e.target.checked })}
                  />
                  This is a construction payment
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Amount *</label>
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Date *</label>
                  <input
                    type="date"
                    value={editForm.payment_date}
                    onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Mode</label>
                  <select
                    value={editForm.mode}
                    onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Reference No.</label>
                  <input
                    type="text"
                    value={editForm.reference_no}
                    onChange={(e) => setEditForm({ ...editForm, reference_no: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingPayment(null);
                  setEditForm(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => updatePaymentMutation.mutate()}
                disabled={updatePaymentMutation.isPending}
                className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50"
              >
                {updatePaymentMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Mark as {STATUS_LABELS[newStatus] || newStatus}
              </h2>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Agreement Signed Date</label>
                <input
                  type="date"
                  value={agreementDate}
                  onChange={(e) => setAgreementDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {newStatus === 'registered' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Registration Date *</label>
                    <input
                      type="date"
                      value={registrationDate}
                      onChange={(e) => setRegistrationDate(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Registration Document No. *</label>
                    <input
                      type="text"
                      value={registrationDocNo}
                      onChange={(e) => setRegistrationDocNo(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="e.g. Doc No. 1234/2026"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => statusChangeMutation.mutate(newStatus)}
                disabled={statusChangeMutation.isPending}
                className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50"
              >
                {statusChangeMutation.isPending ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete this payment?</h3>
            <p className="text-sm text-slate-500 mb-6">
              {inr(deleteTarget.amount)} paid on{' '}
              {new Date(deleteTarget.payment_date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
              . This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePaymentMutation.mutate(deleteTarget.id)}
                disabled={deletePaymentMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deletePaymentMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBox({ label, value, tone = 'text-slate-800', compact, subtitle }) {
  return (
    <div className={compact ? '' : 'bg-slate-50 rounded-lg p-3'}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`font-semibold ${tone}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );
}
