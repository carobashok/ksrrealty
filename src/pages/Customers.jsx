// src/pages/Customers.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Search, Plus, Pencil, Trash2, X, Phone, Mail, MapPin, Wallet } from 'lucide-react';


const emptyForm = { id: null, name: '', mobile: '', email: '', address: '', pan: '', aadhaar: '' };

export default function Customers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [depositCustomer, setDepositCustomer] = useState(null); // customer for deposit modal
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositForm, setDepositForm] = useState({
    deposit_date: new Date().toISOString().slice(0, 10),
    amount: '',
    mode: 'neft',
    reference_no: '',
    notes: '',
  });

  // Fetch customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch deposits for selected customer
  const { data: customerDeposits = [], refetch: refetchDeposits } = useQuery({
    queryKey: ['customer-deposits', depositCustomer?.id],
    enabled: !!depositCustomer?.id,
    queryFn: async () => {
      // Fetch direct deposits
      const { data: deposits, error: dErr } = await supabase
        .schema('ksr')
        .from('customer_deposits')
        .select('id, deposit_date, amount, mode, reference_no, notes, status, applied_to_booking_id')
        .eq('customer_id', depositCustomer.id)
        .order('deposit_date', { ascending: false });
      if (dErr) throw dErr;

      // Fetch cancellation refunds held for customer
      const { data: bookings, error: bErr } = await supabase
        .schema('ksr')
        .from('bookings')
        .select('id, projects(name), plots(plot_number)')
        .eq('customer_id', depositCustomer.id)
        .eq('status', 'cancelled');
      if (bErr) throw bErr;

      const bookingIds = bookings.map(b => b.id);
      let heldRefunds = [];
      if (bookingIds.length > 0) {
        const { data: refunds, error: rErr } = await supabase
          .schema('ksr')
          .from('cancellation_refunds')
          .select('id, refund_date, amount, reference_no, notes, booking_id')
          .eq('refund_type', 'held_for_customer')
          .in('booking_id', bookingIds);
        if (rErr) throw rErr;
        heldRefunds = refunds.map(r => {
          const booking = bookings.find(b => b.id === r.booking_id);
          return {
            id: r.id,
            deposit_date: r.refund_date,
            amount: r.amount,
            mode: '—',
            reference_no: r.reference_no,
            notes: r.notes || `Cancellation — ${booking?.projects?.name || ''} Plot ${booking?.plots?.plot_number || ''}`,
            status: 'held',
            _source: 'cancellation',
          };
        });
      }

      return [...deposits.map(d => ({ ...d, _source: 'direct' })), ...heldRefunds]
        .sort((a, b) => new Date(b.deposit_date) - new Date(a.deposit_date));
    },
  });

  const addDepositMutation = useMutation({
    mutationFn: async () => {
      if (!depositForm.amount || Number(depositForm.amount) <= 0) throw new Error('Enter a valid amount');
      const { error } = await supabase
        .schema('ksr')
        .from('customer_deposits')
        .insert({
          customer_id: depositCustomer.id,
          deposit_date: depositForm.deposit_date,
          amount: Number(depositForm.amount),
          mode: depositForm.mode,
          reference_no: depositForm.reference_no || null,
          notes: depositForm.notes || null,
          status: 'held',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deposit recorded');
      refetchDeposits();
      setShowDepositForm(false);
      setDepositForm({ deposit_date: new Date().toISOString().slice(0, 10), amount: '', mode: 'neft', reference_no: '', notes: '' });
    },
    onError: (err) => toast.error(err.message || 'Failed to record deposit'),
  });

  const totalHeld = customerDeposits
    .filter(d => d.status === 'held')
    .reduce((s, d) => s + Number(d.amount), 0);

  const inr = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN');

  // Add / Update mutation
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase
          .schema('ksr')
          .from('customers')
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { id, ...rest } = payload;
        const { error } = await supabase.schema('ksr').from('customers').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Customer updated' : 'Customer added');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Something went wrong'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.schema('ksr').from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Customer deleted');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      // Likely FK violation if linked to a booking
      toast.error('Cannot delete — this customer may be linked to a booking');
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setForm(emptyForm);
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEditModal = (customer) => {
    setForm({
      id: customer.id,
      name: customer.name || '',
      mobile: customer.mobile || '',
      email: customer.email || '',
      address: customer.address || '',
      pan: customer.pan || '',
      aadhaar: customer.aadhaar || '',
    });
    setIsEdit(true);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    saveMutation.mutate(form);
  };

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.mobile?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Customers</h1>
          <p className="text-sm text-slate-500">{customers.length} total</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#0a1f44] text-white px-4 py-2 rounded-lg hover:bg-[#122a5c] transition"
        >
          <Plus size={18} />
          New Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, mobile, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading customers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {search ? 'No customers match your search' : 'No customers yet — add one to get started'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Mobile</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Address</th>
                <th className="text-left px-4 py-3">PAN</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.mobile ? (
                      <span className="flex items-center gap-1">
                        <Phone size={14} className="text-slate-400" /> {c.mobile}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.email ? (
                      <span className="flex items-center gap-1">
                        <Mail size={14} className="text-slate-400" /> {c.email}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate">
                    {c.address ? (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.pan || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setDepositCustomer(c); setShowDepositForm(false); }}
                        className="p-1.5 text-slate-500 hover:text-green-700 hover:bg-green-50 rounded"
                        title="View/Add Deposits"
                      >
                        <Wallet size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1.5 text-slate-500 hover:text-[#0a1f44] hover:bg-slate-100 rounded"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                {isEdit ? 'Edit Customer' : 'New Customer'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Mobile</label>
                <input
                  type="text"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  placeholder="10-digit mobile"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  placeholder="Full address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">PAN</label>
                  <input
                    type="text"
                    value={form.pan}
                    onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Aadhaar</label>
                  <input
                    type="text"
                    value={form.aadhaar}
                    onChange={(e) => setForm({ ...form, aadhaar: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                    placeholder="12-digit number"
                    maxLength={12}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {depositCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Customer Deposits</h2>
                <p className="text-sm text-slate-500">{depositCustomer.name}</p>
              </div>
              <button onClick={() => { setDepositCustomer(null); setShowDepositForm(false); }}>
                <X size={20} className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-green-800 font-medium">Total Held Balance</span>
                <span className="text-lg font-bold text-green-700">{inr(totalHeld)}</span>
              </div>

              {/* Add deposit form */}
              {showDepositForm ? (
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">New Deposit</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500">Date</label>
                      <input type="date" value={depositForm.deposit_date}
                        onChange={e => setDepositForm(f => ({ ...f, deposit_date: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">Amount (₹)</label>
                      <input type="number" value={depositForm.amount}
                        onChange={e => setDepositForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                        placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">Mode</label>
                      <select value={depositForm.mode}
                        onChange={e => setDepositForm(f => ({ ...f, mode: e.target.value }))}
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
                      <label className="text-xs font-medium text-slate-500">Reference No.</label>
                      <input type="text" value={depositForm.reference_no}
                        onChange={e => setDepositForm(f => ({ ...f, reference_no: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                        placeholder="UTR / Cheque no." />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Notes</label>
                    <input type="text" value={depositForm.notes}
                      onChange={e => setDepositForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => addDepositMutation.mutate()}
                      disabled={addDepositMutation.isPending}
                      className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg text-sm hover:bg-[#122a5c] disabled:opacity-50">
                      {addDepositMutation.isPending ? 'Saving...' : 'Save Deposit'}
                    </button>
                    <button onClick={() => setShowDepositForm(false)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowDepositForm(true)}
                  className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  <Plus size={14} /> Add Deposit
                </button>
              )}

              {/* Deposits list */}
              {customerDeposits.length === 0 ? (
                <p className="text-sm text-slate-400">No deposits recorded yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="text-left py-1">Date</th>
                      <th className="text-left py-1">Source</th>
                      <th className="text-left py-1">Notes</th>
                      <th className="text-right py-1">Amount</th>
                      <th className="text-center py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDeposits.map(d => (
                      <tr key={d.id} className="border-t border-slate-100">
                        <td className="py-2 text-slate-600 pr-3">
                          {new Date(d.deposit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            d._source === 'cancellation'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {d._source === 'cancellation' ? 'Cancellation' : 'Direct'}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500 text-xs pr-3">{d.notes || d.reference_no || '—'}</td>
                        <td className="py-2 text-right font-medium text-slate-800">{inr(d.amount)}</td>
                        <td className="py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            d.status === 'held'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {d.status === 'held' ? 'Held' : 'Applied'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete customer?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will permanently remove <span className="font-medium">{deleteTarget.name}</span>.
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}