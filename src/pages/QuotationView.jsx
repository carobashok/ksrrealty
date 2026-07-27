// src/pages/QuotationView.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Printer } from 'lucide-react';

const CENTS_TO_SQFT = 435.6;

export default function QuotationView() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-quotation', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select(
          `
          *,
          customers ( name ),
          projects ( id, name, is_jv, unit_of_measure, guideline_value_sqft, reg_charge_pct ),
          plots ( plot_number, block, area_sqft )
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

  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('company_settings')
        .select('account_holder_name, account_no, ifsc_code, address, logo_url')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-6 text-slate-400">Loading quotation...</div>;
  if (!booking) return <div className="p-6 text-slate-400">Booking not found.</div>;

  const isJv = booking.projects?.is_jv;
  const isCents = booking.projects?.unit_of_measure === 'cents';
  const area = Number(booking.plots?.area_sqft) || 0;
  const areaCents = area / CENTS_TO_SQFT;
  const rateSqft = Number(booking.agreed_rate_sqft) || 0;
  const rateCent = rateSqft * CENTS_TO_SQFT;

  const inr = (n) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');

  // Quotation goes in the name of whoever is actually registering the plot —
  // the customer by default, or the registrant if they're a different person.
  const quotationName = booking.registrant_same_as_customer === false && booking.registrant_name
    ? booking.registrant_name
    : booking.customers?.name;

  const rows = [
    { label: 'SITE NO', value: booking.plots?.plot_number },
    {
      label: 'EXTENT',
      value: isCents
        ? `${areaCents.toFixed(2)} CENTS (${inr(area)} SQ.FT)`
        : `${inr(area)} SQ.FT`,
    },
    {
      label: isCents ? 'PER CENT' : 'PER SQ.FT',
      value: inr(isCents ? rateCent : rateSqft),
    },
    { label: 'LAND COST', value: inr(booking.land_cost) },
    { label: 'GLV PER SQ.FT', value: inr(booking.projects?.guideline_value_sqft) },
    { label: 'REG', value: inr(booking.reg_charge_amount) },
    { label: 'DOCUMENT CHARGE', value: inr(booking.document_charge_amount) },
  ];

  const landownerRows = isJv
    ? landowners.map((lo) => ({
        name: lo.landowner_name,
        account: `${lo.account_no || '—'}\n${lo.ifsc_code || ''}`,
        amount: (Number(booking.landowner_share_amt) * Number(lo.share_pct)) / 100,
      }))
    : [];

  const ksrRow = {
    name: companySettings?.account_holder_name || 'KSR REALTY',
    account: `${companySettings?.account_no || '—'}\n${companySettings?.ifsc_code || ''}`,
    amount: Number(booking.company_share_amt) || 0,
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button
          onClick={() => navigate(`/bookings/${bookingId}`)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} /> Back to Booking
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#0a1f44] text-white px-4 py-2 rounded-lg hover:bg-[#122a5c]"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      {/* Printable document */}
      <div className="bg-white border border-slate-200 rounded-xl p-8 print:border-0 print:rounded-none print:p-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            {companySettings?.logo_url ? (
              <img src={companySettings.logo_url} alt="KSR Realty" className="h-14 w-auto" />
            ) : (
              <div className="text-lg font-bold text-slate-800">KSR REALTY</div>
            )}
          </div>
          <div className="text-sm text-slate-600">DATE: {today}</div>
        </div>

        <p className="text-sm text-slate-700 mb-1">Greetings from KSR Realty!</p>
        <p className="text-sm text-slate-700 mb-4">
          We are pleased to submit the quotation for{' '}
          <span className="font-semibold">{quotationName}</span> towards the plot no:{' '}
          <span className="font-semibold">{booking.plots?.plot_number}</span>
        </p>

        <table className="w-full text-sm border border-slate-300 mb-4">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-slate-300">
                <td className="px-3 py-2 font-medium text-slate-700 border-r border-slate-300 w-1/2">
                  {r.label}
                </td>
                <td className="px-3 py-2 text-slate-800">{r.value}</td>
              </tr>
            ))}
            <tr className="border-b border-slate-300 bg-slate-50">
              <td className="px-3 py-2 font-semibold text-slate-800 border-r border-slate-300">
                TOTAL LAND AND REG COST
              </td>
              <td className="px-3 py-2 font-semibold text-slate-900">
                {inr(booking.total_consideration)}
              </td>
            </tr>
            {isJv && (
              <tr>
                <td className="px-3 py-2 font-semibold text-slate-800 border-r border-slate-300">
                  GLV TOTAL
                </td>
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {inr(booking.landowner_share_amt)}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <table className="w-full text-sm border border-slate-300 mb-4">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50">
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-r border-slate-300">
                NAME
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-r border-slate-300">
                AC NUMBER &amp; IFSC CODE
              </th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {landownerRows.map((lo, i) => (
              <tr key={i} className="border-b border-slate-300">
                <td className="px-3 py-2 font-medium text-slate-800 border-r border-slate-300 align-top">
                  {lo.name}
                </td>
                <td className="px-3 py-2 text-slate-700 border-r border-slate-300 align-top whitespace-pre-line">
                  {lo.account}
                </td>
                <td className="px-3 py-2 text-right text-slate-800 align-top">
                  {inr(lo.amount)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-semibold text-slate-800 border-r border-slate-300 align-top">
                {ksrRow.name}
              </td>
              <td className="px-3 py-2 text-slate-700 border-r border-slate-300 align-top whitespace-pre-line">
                {ksrRow.account}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-slate-800 align-top">
                {inr(ksrRow.amount)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-slate-500 italic">
          REMARKS: Registration fees and Document charge are excluded from the Land cost.
        </p>

        {companySettings?.address && (
          <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 whitespace-pre-line">
            {companySettings.address}
          </div>
        )}
      </div>
    </div>
  );
}
