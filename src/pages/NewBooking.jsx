// src/pages/NewBooking.jsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Search, X, Plus } from 'lucide-react';

const RELATIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Other'];
const CENTS_TO_SQFT = 435.6;
// Must exactly match the DB check constraint on payments.mode
const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'upi', label: 'UPI' },
  { value: 'dd', label: 'DD' },
  { value: 'imps', label: 'IMPS' },
];

export default function NewBooking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState('');
  const [plotId, setPlotId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', email: '', address: '' });

  const [registrantSame, setRegistrantSame] = useState(true);
  const [registrants, setRegistrants] = useState([{ name: '', relation: '', pan: '', aadhaar: '' }]);

  const addRegistrant = () =>
    setRegistrants((r) => [...r, { name: '', relation: '', pan: '', aadhaar: '' }]);
  const removeRegistrant = (index) =>
    setRegistrants((r) => r.filter((_, i) => i !== index));
  const updateRegistrant = (index, field, value) =>
    setRegistrants((r) => r.map((reg, i) => (i === index ? { ...reg, [field]: value } : reg)));

  const [agreedRate, setAgreedRate] = useState('');
  const [agreedRateCent, setAgreedRateCent] = useState('');
  const [areaOverride, setAreaOverride] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountApprovedBy, setDiscountApprovedBy] = useState('');
  const [discountNotes, setDiscountNotes] = useState('');

  const [source, setSource] = useState('direct');
  const [channelPartnerId, setChannelPartnerId] = useState('');
  const [assignedExecutiveId, setAssignedExecutiveId] = useState('');

  const [incentiveRows, setIncentiveRows] = useState([{ employee_id: '', amount: '' }]);

  const [tokenAdvance, setTokenAdvance] = useState('');
  const [tokenDate, setTokenDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  // ---- Data fetching ----
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('projects')
        .select(
          'id, name, guideline_value_sqft, sale_rate_per_sqft, sale_rate_per_cent, unit_of_measure, is_jv, incentive_amount_per_plot, reg_charge_pct, document_charge_amount, landowner_rate_per_cent'
        )
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: plots = [] } = useQuery({
    queryKey: ['plots-for-booking', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('plots')
        .select('id, plot_number, block, area_sqft, base_price_sqft, rate_per_cent, premium_amount, total_price, status')
        .eq('project_id', projectId)
        .in('status', ['available', 'blocked'])
        .order('plot_number');
      if (error) throw error;
      return data.sort((a, b) => {
        const aNum = parseInt(a.plot_number) || 0;
        const bNum = parseInt(b.plot_number) || 0;
        return aNum - bNum;
      });
    },
  });

  const { data: activeBlock } = useQuery({
    queryKey: ['active-block', plotId],
    enabled: !!plotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('plot_blocks')
        .select('*')
        .eq('plot_id', plotId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: customerResults = [] } = useQuery({
    queryKey: ['customer-search', customerSearch],
    enabled: customerSearch.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('customers')
        .select('id, name, mobile, email')
        .or(`name.ilike.%${customerSearch}%,mobile.ilike.%${customerSearch}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: landowners = [] } = useQuery({
    queryKey: ['project-landowners', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('project_landowners')
        .select('id, landowner_name, share_pct')
        .eq('project_id', projectId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('employees')
        .select('id, name, role')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Employees assigned to the selected project (via project_employees).
  // Used to restrict Assigned Executive + incentive-split dropdowns.
  const { data: projectEmployees = [] } = useQuery({
    queryKey: ['project-employees-for-booking', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('project_employees')
        .select('employee_id, employees ( id, name, role, active )')
        .eq('project_id', projectId);
      if (error) throw error;
      return data
        .map((row) => row.employees)
        .filter((e) => e && e.active !== false);
    },
  });

  // Channel partners assigned to the selected project (via project_channel_partners).
  // Used to restrict the Channel Partner dropdown.
  const { data: projectPartners = [] } = useQuery({
    queryKey: ['project-channel-partners-for-booking', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('project_channel_partners')
        .select('channel_partner_id, channel_partners ( id, name, active )')
        .eq('project_id', projectId);
      if (error) throw error;
      return data
        .map((row) => row.channel_partners)
        .filter((p) => p && p.active !== false);
    },
  });

  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedPlot = plots.find((p) => p.id === plotId);
  const selectedCustomer = customerResults.find((c) => c.id === customerId);

  const isCentsProject = selectedProject?.unit_of_measure === 'cents';

  // Prefill agreed rate when plot changes.
  // Priority: the plot's own listed rate first, project's default rate as
  // fallback only if the plot doesn't have one set.
  // For Cents-based projects, the rate is entered per-Cent and converted to
  // ₹/Sq.ft at FULL precision here — never pre-rounded — so Land Cost stays
  // exact even though the ₹/Sq.ft equivalent looks like a decimal.
  const effectiveRateCent =
    agreedRateCent === ''
      ? Number(selectedPlot?.rate_per_cent) || Number(selectedProject?.sale_rate_per_cent) || 0
      : Number(agreedRateCent);
  const effectiveRate = isCentsProject
    ? effectiveRateCent / CENTS_TO_SQFT
    : agreedRate === ''
    ? selectedPlot?.base_price_sqft ?? 0
    : Number(agreedRate);

  // ---- Calculations ----
  // Land Cost = area × agreed rate + PLC premium − discount
  // GLV Total = area × guideline_value_sqft (computed regardless of JV status)
  // Reg Charge = GLV Total × project's reg_charge_pct (default 9%)
  // Document Charge = flat project-level amount
  // Total Consideration = Land Cost + Reg Charge + Document Charge
  // JV: Landowner Share = GLV Total; Company Share = Total Consideration − Landowner Share
  // Non-JV: Company Share = 100% of Total Consideration (KSR owns the land outright)
  const calc = useMemo(() => {
    if (!selectedPlot || !selectedProject) return null;

    const area = Number(selectedPlot.area_sqft) || 0;
    const premium = Number(selectedPlot.premium_amount) || 0;
    const discount = Number(discountAmount) || 0;
    const regPct = Number(selectedProject.reg_charge_pct) || 0;
    const docCharge = Number(selectedProject.document_charge_amount) || 0;
    const glvRate = Number(selectedProject.guideline_value_sqft) || 0;

    const landCostBeforeDiscount = isCentsProject
      ? Math.round(parseFloat((area / CENTS_TO_SQFT).toFixed(2)) * effectiveRateCent) + premium
      : area * effectiveRate + premium;
    const landCost = landCostBeforeDiscount - discount;
    const glvTotal = area * glvRate;
    const regChargeAmount = (glvTotal * regPct) / 100;
    const totalConsideration = landCost + regChargeAmount + docCharge;

    let landownerShareAmt = 0;
    let companyShareAmt = totalConsideration;
    let ksrOwesLandowner = 0;

    if (selectedProject.is_jv) {
      landownerShareAmt = glvTotal;
      companyShareAmt = totalConsideration - glvTotal;

      // What KSR itself will separately owe the landowner later:
      // (plot area in Cents × Landowner Rate/Cent) − GLV already paid by the customer.
      const landownerRatePerCent = Number(selectedProject.landowner_rate_per_cent) || 0;
      const areaCents = area / CENTS_TO_SQFT;
      ksrOwesLandowner = (areaCents * landownerRatePerCent) - glvTotal;
    }

    const landownerSharePct = totalConsideration > 0 ? (landownerShareAmt / totalConsideration) * 100 : 0;
    const companySharePct = totalConsideration > 0 ? (companyShareAmt / totalConsideration) * 100 : 0;

    return {
      area,
      premium,
      landCost,
      glvTotal,
      regChargeAmount,
      docCharge,
      totalConsideration,
      landownerShareAmt,
      companyShareAmt,
      landownerSharePct,
      companySharePct,
      ksrOwesLandowner,
    };
  }, [selectedPlot, selectedProject, effectiveRate, effectiveRateCent, isCentsProject, discountAmount]);

  // ---- Incentive split ----
  const incentivePool = Number(selectedProject?.incentive_amount_per_plot) || 0;
  const incentiveAllocated = incentiveRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const incentiveRemaining = incentivePool - incentiveAllocated;
  const incentiveOverAllocated = incentiveRemaining < 0;

  const addIncentiveRow = () =>
    setIncentiveRows([...incentiveRows, { employee_id: '', amount: '' }]);

  const removeIncentiveRow = (index) =>
    setIncentiveRows(incentiveRows.filter((_, i) => i !== index));

  const updateIncentiveRow = (index, field, value) =>
    setIncentiveRows(
      incentiveRows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );

  // ---- Mutations ----
  const createCustomerMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('customers')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });

  const submitBookingMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Select a project');
      if (!plotId) throw new Error('Select a plot');
      if (!customerId && !showNewCustomer) throw new Error('Select or add a customer');
      if (!tokenAdvance || Number(tokenAdvance) <= 0) throw new Error('Enter advance amount');
      if (!assignedExecutiveId && source !== 'channel_partner')
        throw new Error('Select the assigned executive');
      if (!registrantSame && registrants.some((r) => !r.name.trim()))
        throw new Error('Enter a name for every registrant, or toggle "Same as customer"');

      const validIncentiveRows = incentiveRows.filter(
        (r) => r.employee_id && Number(r.amount) > 0
      );
      const incentiveTotal = validIncentiveRows.reduce((sum, r) => sum + Number(r.amount), 0);
      if (incentiveTotal > incentivePool) {
        throw new Error(
          `Incentive allocated (₹${incentiveTotal.toLocaleString('en-IN')}) exceeds the pool (₹${incentivePool.toLocaleString('en-IN')}) for this plot`
        );
      }

      let finalCustomerId = customerId;

      // Create new customer if needed
      if (showNewCustomer) {
        if (!newCustomer.name.trim()) throw new Error('Customer name is required');
        const created = await createCustomerMutation.mutateAsync({
          name: newCustomer.name.trim(),
          mobile: newCustomer.mobile.trim() || null,
          email: newCustomer.email.trim() || null,
          address: newCustomer.address.trim() || null,
        });
        finalCustomerId = created.id;
      }

      // Insert booking
      const bookingPayload = {
        project_id: projectId,
        plot_id: plotId,
        customer_id: finalCustomerId,
        booking_date: tokenDate,
        source,
        channel_partner_id: channelPartnerId || null,
        assigned_executive_id: assignedExecutiveId || null,
        agreed_rate_sqft: effectiveRate,
        land_cost: calc.landCost,
        reg_charge_amount: calc.regChargeAmount,
        document_charge_amount: calc.docCharge,
        total_consideration: calc.totalConsideration,
        discount_amount: Number(discountAmount) || 0,
        discount_approved_by: Number(discountAmount) > 0 ? discountApprovedBy || null : null,
        discount_approval_notes: Number(discountAmount) > 0 ? discountNotes || null : null,
        token_advance: Number(tokenAdvance),
        token_date: tokenDate,
        company_share_pct: calc.companySharePct,
        landowner_share_pct: calc.landownerSharePct,
        company_share_amt: calc.companyShareAmt,
        landowner_share_amt: calc.landownerShareAmt,
        ksr_owes_landowner: selectedProject.is_jv ? calc.ksrOwesLandowner : null,
        registrant_same_as_customer: registrantSame,
        registrant_name: registrantSame ? null : registrants[0]?.name.trim() || null,
        registrant_pan: registrantSame ? null : registrants[0]?.pan.trim() || null,
        registrant_aadhaar: registrantSame ? null : registrants[0]?.aadhaar.trim() || null,
        registrant_relation: registrantSame ? null : registrants[0]?.relation || null,
        status: 'booked',
        notes: bookingNotes.trim() || null,
      };

      const { data: booking, error: bookingErr } = await supabase
        .schema('ksr')
        .from('bookings')
        .insert(bookingPayload)
        .select()
        .single();
      if (bookingErr) throw bookingErr;

      // Insert the full registrant list (supports multiple joint registrants,
      // e.g. son + wife) — legacy registrant_* columns above only hold the first.
      if (!registrantSame) {
        const registrantRows = registrants
          .filter((r) => r.name.trim())
          .map((r, i) => ({
            booking_id: booking.id,
            name: r.name.trim(),
            relation: r.relation || null,
            pan: r.pan.trim() || null,
            aadhaar: r.aadhaar.trim() || null,
            sort_order: i,
          }));
        if (registrantRows.length > 0) {
          const { error: registrantErr } = await supabase
            .schema('ksr')
            .from('booking_registrants')
            .insert(registrantRows);
          if (registrantErr) throw registrantErr;
        }
      }

      // Insert incentive split (booking_commissions)
      if (validIncentiveRows.length > 0 && incentivePool > 0) {
        const sortedRoles = [
          ...new Set(
            validIncentiveRows
              .map((r) => employees.find((e) => e.id === r.employee_id)?.role)
              .filter(Boolean)
          ),
        ].sort();
        const combination = sortedRoles.join('+');

        const commissionPayload = validIncentiveRows.map((r) => {
          const emp = employees.find((e) => e.id === r.employee_id);
          return {
            booking_id: booking.id,
            employee_id: r.employee_id,
            role: emp?.role || null,
            share_pct: (Number(r.amount) / incentivePool) * 100,
            combination,
            override: true,
          };
        });

        const { error: commissionErr } = await supabase
          .schema('ksr')
          .from('booking_commissions')
          .insert(commissionPayload);
        if (commissionErr) throw commissionErr;
      }

      // Advance payment at booking time is always paid to KSR (company_share).
      // Landowner payments and any further KSR installments happen later,
      // as separate individual entries added from the Booking Detail payment ledger.
      const { error: paymentErr } = await supabase.schema('ksr').from('payments').insert({
        booking_id: booking.id,
        payment_type: 'company_share',
        landowner_id: null,
        payment_date: tokenDate,
        amount: Number(tokenAdvance),
        mode: paymentMode,
        reference_no: referenceNo.trim() || null,
        notes: 'Advance',
      });
      if (paymentErr) throw paymentErr;

      // Flip plot status
      const { error: plotErr } = await supabase
        .schema('ksr')
        .from('plots')
        .update({ status: 'booked' })
        .eq('id', plotId);
      if (plotErr) throw plotErr;

      // Mark block as converted, if applicable
      if (activeBlock) {
        const { error: blockErr } = await supabase
          .schema('ksr')
          .from('plot_blocks')
          .update({ status: 'converted_to_booking' })
          .eq('id', activeBlock.id);
        if (blockErr) throw blockErr;
      }

      return booking;
    },
    onSuccess: (booking) => {
      toast.success('Booking created');
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate(`/bookings/${booking.id}`);
    },
    onError: (err) => toast.error(err.message || 'Failed to create booking'),
  });

  const inr = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      n || 0
    );

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">New Booking</h1>

      {/* Project + Plot */}
      <Section title="Project & Plot">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Project">
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPlotId('');
              }}
              className="input"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plot">
            <select
              value={plotId}
              onChange={(e) => setPlotId(e.target.value)}
              disabled={!projectId}
              className="input"
            >
              <option value="">Select plot...</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plot_number} {p.block ? `(${p.block})` : ''} — {p.area_sqft} sqft{' '}
                  {p.status === 'blocked' ? '🔒 Blocked' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {activeBlock && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            This plot is currently blocked for <strong>{activeBlock.customer_name}</strong>
            {activeBlock.customer_mobile ? ` (${activeBlock.customer_mobile})` : ''}. Search or add
            this person as the customer below.
          </div>
        )}
      </Section>

      {/* Customer */}
      <Section title="Customer">
        {!showNewCustomer ? (
          <>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerId('');
                }}
                placeholder="Search by name or mobile..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
              />
            </div>
            {customerSearch.length >= 2 && !customerId && (
              <div className="border border-slate-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                {customerResults.length === 0 ? (
                  <div className="p-3 text-sm text-slate-400">No matches</div>
                ) : (
                  customerResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerSearch(c.name);
                      }}
                      className="w-full text-left p-3 hover:bg-slate-50 text-sm"
                    >
                      <div className="font-medium text-slate-800">{c.name}</div>
                      <div className="text-slate-500">{c.mobile}</div>
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedCustomer && (
              <div className="mt-2 bg-slate-50 rounded-lg p-3 text-sm">
                <span className="font-medium">{selectedCustomer.name}</span> —{' '}
                {selectedCustomer.mobile}
              </div>
            )}
            <button
              onClick={() => setShowNewCustomer(true)}
              className="mt-2 flex items-center gap-1 text-sm text-[#0a1f44] hover:underline"
            >
              <Plus size={14} /> Add new customer instead
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">New customer details</span>
              <button
                onClick={() => setShowNewCustomer(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel — search existing instead
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *">
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Mobile">
                <input
                  type="text"
                  value={newCustomer.mobile}
                  onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Address">
                <input
                  type="text"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* Registrant */}
      <Section title="Registration Details">
        <label className="flex items-center gap-2 mb-3 text-sm">
          <input
            type="checkbox"
            checked={registrantSame}
            onChange={(e) => setRegistrantSame(e.target.checked)}
          />
          Registration will be in the customer's own name
        </label>
        {!registrantSame && (
          <div className="space-y-4">
            {registrants.map((reg, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-3 relative">
                {registrants.length > 1 && (
                  <button
                    onClick={() => removeRegistrant(index)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-600"
                    title="Remove this registrant"
                  >
                    <X size={16} />
                  </button>
                )}
                <div className="text-xs font-medium text-slate-500 mb-2">
                  Registrant {index + 1}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name *">
                    <input
                      type="text"
                      value={reg.name}
                      onChange={(e) => updateRegistrant(index, 'name', e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Relation to Customer">
                    <select
                      value={reg.relation}
                      onChange={(e) => updateRegistrant(index, 'relation', e.target.value)}
                      className="input"
                    >
                      <option value="">Select...</option>
                      {RELATIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="PAN">
                    <input
                      type="text"
                      value={reg.pan}
                      onChange={(e) => updateRegistrant(index, 'pan', e.target.value.toUpperCase())}
                      className="input"
                    />
                  </Field>
                  <Field label="Aadhaar">
                    <input
                      type="text"
                      value={reg.aadhaar}
                      onChange={(e) => updateRegistrant(index, 'aadhaar', e.target.value)}
                      className="input"
                    />
                  </Field>
                </div>
              </div>
            ))}
            <button
              onClick={addRegistrant}
              className="flex items-center gap-1 text-sm text-[#0a1f44] hover:underline"
            >
              <Plus size={14} /> Add another registrant
            </button>
          </div>
        )}
      </Section>

      {/* Rate & Calculation */}
      {selectedPlot && selectedProject && calc && (
        <Section title="Sale Value & Split">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Field label={isCentsProject ? 'Area' : 'Area (Sq.ft)'}>
              <input
                type="text"
                value={
                  isCentsProject
                    ? `${(calc.area / CENTS_TO_SQFT).toFixed(2)} Cents (${calc.area} Sq.ft)`
                    : calc.area
                }
                disabled
                className="input bg-slate-50"
              />
            </Field>
            {isCentsProject ? (
              <Field label="Agreed Rate (₹/Cent)">
                <input
                  type="number"
                  value={agreedRateCent === '' ? (selectedPlot?.rate_per_cent ?? selectedProject.sale_rate_per_cent ?? '') : agreedRateCent}
                  onChange={(e) => setAgreedRateCent(e.target.value)}
                  className="input"
                />
                <p className="text-xs text-slate-400 mt-1">
                  ≈ ₹{effectiveRate.toFixed(2)}/Sq.ft (used at full precision for Land Cost, not rounded)
                </p>
              </Field>
            ) : (
              <Field label="Agreed Rate (₹/Sq.ft)">
                <input
                  type="number"
                  value={agreedRate === '' ? selectedPlot.base_price_sqft : agreedRate}
                  onChange={(e) => setAgreedRate(e.target.value)}
                  className="input"
                />
              </Field>
            )}
            <Field label="PLC/Premium (included)">
              <input type="text" value={inr(calc.premium)} disabled className="input bg-slate-50" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Discount Amount">
              <input
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                className="input"
              />
            </Field>
            {Number(discountAmount) > 0 && (
              <Field label="Discount Approved By">
                <select
                  value={discountApprovedBy}
                  onChange={(e) => setDiscountApprovedBy(e.target.value)}
                  className="input"
                >
                  <option value="">Select...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm mb-4">
            <Row label="Land Cost" value={inr(calc.landCost)} />
            <Row
              label={`Reg Charge (${selectedProject.reg_charge_pct ?? 0}% of GLV Total)`}
              value={inr(calc.regChargeAmount)}
            />
            <Row label="Document Charge" value={inr(calc.docCharge)} />
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <Row label="Total Consideration" value={inr(calc.totalConsideration)} bold />
            {selectedProject.is_jv ? (
              <>
                <Row
                  label="Landowner Share (GLV)"
                  value={inr(calc.landownerShareAmt)}
                  sub={`${calc.landownerSharePct.toFixed(1)}%`}
                />
                <Row
                  label="Company (KSR) Share"
                  value={inr(calc.companyShareAmt)}
                  sub={`${calc.companySharePct.toFixed(1)}%`}
                />
              </>
            ) : (
              <Row
                label="Company (KSR) Share"
                value={inr(calc.companyShareAmt)}
                sub="100% — non-JV, KSR owned"
              />
            )}
          </div>

          {selectedProject.is_jv && landowners.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="text-slate-500 mb-1">Landowner-wise GLV split:</div>
              <div className="space-y-1">
                {landowners.map((lo) => (
                  <div key={lo.landowner_name} className="flex justify-between text-slate-600">
                    <span>
                      {lo.landowner_name} ({lo.share_pct}%)
                    </span>
                    <span>{inr((calc.landownerShareAmt * lo.share_pct) / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedProject.is_jv && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-amber-800">KSR Owes Landowner (overall, settled later)</span>
                <span className="font-semibold text-amber-900">{inr(calc.ksrOwesLandowner)}</span>
              </div>
              <p className="text-xs text-amber-700 mt-1">
                (Plot area in Cents × Landowner Rate/Cent) − GLV already paid by the customer.
                {!selectedProject.landowner_rate_per_cent && ' Set a Landowner Rate on this project to see this figure.'}
              </p>
            </div>
          )}
        </Section>
      )}

      {/* Source & Executive */}
      <Section title="Source & Executive">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Source">
            <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
              <option value="direct">Direct</option>
              <option value="channel_partner">Channel Partner</option>
            </select>
          </Field>
          {source === 'channel_partner' && (
            <Field label="Channel Partner">
              <select
                value={channelPartnerId}
                onChange={(e) => setChannelPartnerId(e.target.value)}
                className="input"
              >
                <option value="">Select...</option>
                {projectPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {projectId && projectPartners.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No channel partners assigned to this project yet — add them on the Project page.
                </p>
              )}
            </Field>
          )}
          <Field label={source === 'channel_partner' ? 'Assigned Executive (optional)' : 'Assigned Executive *'}>
            <select
              value={assignedExecutiveId}
              onChange={(e) => setAssignedExecutiveId(e.target.value)}
              className="input"
            >
              <option value="">Select...</option>
              {projectEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {projectId && projectEmployees.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No employees assigned to this project yet — add them on the Project page.
              </p>
            )}
          </Field>
        </div>
      </Section>

      {/* Incentive Split */}
      {selectedProject && (
        <Section title="Incentive Split">
          <div className="mb-3 text-sm text-slate-600">
            Pool for this plot: <span className="font-semibold">{inr(incentivePool)}</span>
            {incentivePool === 0 && (
              <span className="text-amber-600 ml-2">
                (no incentive rate set for this project yet)
              </span>
            )}
          </div>

          <div className="space-y-2">
            {incentiveRows.map((row, index) => (
              <div key={index} className="flex gap-3 items-start">
                <select
                  value={row.employee_id}
                  onChange={(e) => updateIncentiveRow(index, 'employee_id', e.target.value)}
                  className="input flex-1"
                >
                  <option value="">Select employee...</option>
                  {projectEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={row.amount}
                  onChange={(e) => updateIncentiveRow(index, 'amount', e.target.value)}
                  placeholder="Amount ₹"
                  className="input w-40"
                />
                {incentiveRows.length > 1 && (
                  <button
                    onClick={() => removeIncentiveRow(index)}
                    className="p-2 text-slate-400 hover:text-red-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addIncentiveRow}
            className="mt-2 flex items-center gap-1 text-sm text-[#0a1f44] hover:underline"
          >
            <Plus size={14} /> Add another person
          </button>

          <div
            className={`mt-3 text-sm flex justify-between p-3 rounded-lg ${
              incentiveOverAllocated ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'
            }`}
          >
            <span>Allocated: {inr(incentiveAllocated)}</span>
            <span>
              {incentiveOverAllocated ? 'Over by' : 'Remaining'}: {inr(Math.abs(incentiveRemaining))}
            </span>
          </div>
        </Section>
      )}

      {/* Advance Payment */}
      <Section title="Advance Payment">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Advance Amount *">
            <input
              type="number"
              value={tokenAdvance}
              onChange={(e) => setTokenAdvance(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Date *">
            <input
              type="date"
              value={tokenDate}
              onChange={(e) => setTokenDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Payment Mode">
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="input">
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reference No.">
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            value={bookingNotes}
            onChange={(e) => setBookingNotes(e.target.value)}
            rows={2}
            className="input"
          />
        </Field>
      </Section>

      <div className="flex justify-end gap-3 mt-6">
        <button onClick={() => navigate('/bookings')} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          Cancel
        </button>
        <button
          onClick={() => submitBookingMutation.mutate()}
          disabled={submitBookingMutation.isPending || !calc || incentiveOverAllocated}
          className="px-6 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50"
        >
          {submitBookingMutation.isPending ? 'Creating Booking...' : 'Create Booking'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-2">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ label, value, sub, bold }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <span className={bold ? 'font-semibold text-slate-800' : 'text-slate-700'}>
        {value} {sub && <span className="text-xs text-slate-400 ml-1">({sub})</span>}
      </span>
    </div>
  );
}
