// src/pages/ReceiptView.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, CheckCircle } from 'lucide-react';

export default function ReceiptView() {
  const { bookingId, paymentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: booking } = useQuery({
    queryKey: ['booking-receipt', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select(
          `
          id,
          customers ( name ),
          projects ( name ),
          plots ( plot_number, block )
        `
        )
        .eq('id', bookingId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: landowner } = useQuery({
    queryKey: ['landowner', payment?.landowner_id],
    enabled: !!payment?.landowner_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('project_landowners')
        .select('landowner_name')
        .eq('id', payment.landowner_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('company_settings')
        .select('account_holder_name, address, logo_url')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const markSentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .schema('ksr')
        .from('payments')
        .update({ receipt_sent: true, receipt_sent_at: new Date().toISOString() })
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marked as sent');
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to update'),
  });

  const inr = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n || 0);

  if (isLoading) return <div className="p-6 text-slate-400">Loading receipt...</div>;
  if (!payment) return <div className="p-6 text-slate-400">Payment not found.</div>;

  const paidTo =
    payment.payment_type === 'landowner_share'
      ? landowner?.landowner_name || 'Landowner'
      : companySettings?.account_holder_name || 'KSR REALTY';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button
          onClick={() => navigate(`/bookings/${bookingId}`)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} /> Back to Booking
        </button>
        <div className="flex gap-2">
          {!payment.receipt_sent && (
            <button
              onClick={() => markSentMutation.mutate()}
              disabled={markSentMutation.isPending}
              className="flex items-center gap-2 border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              <CheckCircle size={16} /> Mark as Sent
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-[#0a1f44] text-white px-4 py-2 rounded-lg hover:bg-[#122a5c]"
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {payment.receipt_sent && (
        <div className="mb-4 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 print:hidden">
          Sent on{' '}
          {new Date(payment.receipt_sent_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      )}

      {/* Printable receipt */}
      <div className="bg-white border border-slate-200 rounded-xl p-8 print:border-0 print:rounded-none print:p-0">
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-200">
          <div>
            {companySettings?.logo_url ? (
              <img src={companySettings.logo_url} alt="KSR Realty" className="h-14 w-auto" />
            ) : (
              <div className="text-lg font-bold text-slate-800">KSR REALTY</div>
            )}
          </div>
          <div className="text-right text-sm text-slate-600">
            <div>Receipt No: {payment.receipt_no || payment.id.slice(0, 8).toUpperCase()}</div>
            <div>
              Date:{' '}
              {new Date(payment.payment_date).toLocaleDateString('en-GB')}
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-700 mb-4">
          Received with thanks from <span className="font-semibold">{booking?.customers?.name}</span>
        </p>

        <table className="w-full text-sm border border-slate-300 mb-4">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 font-medium text-slate-600 border-r border-slate-300 w-1/2">
                Towards
              </td>
              <td className="px-3 py-2 text-slate-800">
                {booking?.projects?.name} · Plot {booking?.plots?.plot_number}
                {booking?.plots?.block ? ` (${booking.plots.block})` : ''}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 font-medium text-slate-600 border-r border-slate-300">
                Paid To
              </td>
              <td className="px-3 py-2 text-slate-800">{paidTo}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 font-medium text-slate-600 border-r border-slate-300">
                Payment Mode
              </td>
              <td className="px-3 py-2 text-slate-800 capitalize">{payment.mode || '—'}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 font-medium text-slate-600 border-r border-slate-300">
                Reference No.
              </td>
              <td className="px-3 py-2 text-slate-800">{payment.reference_no || '—'}</td>
            </tr>
            {payment.notes && (
              <tr className="border-b border-slate-300">
                <td className="px-3 py-2 font-medium text-slate-600 border-r border-slate-300">
                  Notes
                </td>
                <td className="px-3 py-2 text-slate-800">{payment.notes}</td>
              </tr>
            )}
            <tr className="bg-slate-50">
              <td className="px-3 py-2 font-semibold text-slate-800 border-r border-slate-300">
                Amount
              </td>
              <td className="px-3 py-2 font-semibold text-slate-900">{inr(payment.amount)}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-slate-400 mt-8">
          This is a system-generated receipt from KSR Realty.
        </p>

        {companySettings?.address && (
          <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500 whitespace-pre-line">
            {companySettings.address}
          </div>
        )}
      </div>
    </div>
  );
}
