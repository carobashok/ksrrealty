// src/pages/ChannelPartners.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Search, Plus, Pencil, Trash2, X, Phone, Mail, HelpCircle } from 'lucide-react';
import ChannelPartnersHelp from '../components/help/ChannelPartnersHelp';

const emptyForm = {
  id: null,
  name: '',
  partner_code: '',
  contact_person: '',
  mobile: '',
  email: '',
  active: true,
};

export default function ChannelPartners() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['channel-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('channel_partners')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const cleaned = {
        ...payload,
        partner_code: payload.partner_code.trim() || null,
        contact_person: payload.contact_person.trim() || null,
        mobile: payload.mobile.trim() || null,
        email: payload.email.trim() || null,
      };
      if (payload.id) {
        const { id, ...rest } = cleaned;
        const { error } = await supabase
          .schema('ksr')
          .from('channel_partners')
          .update(rest)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { id, ...rest } = cleaned;
        const { error } = await supabase.schema('ksr').from('channel_partners').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Channel partner updated' : 'Channel partner added');
      queryClient.invalidateQueries({ queryKey: ['channel-partners'] });
      queryClient.invalidateQueries({ queryKey: ['channel-partners-active'] });
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Something went wrong'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.schema('ksr').from('channel_partners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Channel partner deleted');
      queryClient.invalidateQueries({ queryKey: ['channel-partners'] });
      queryClient.invalidateQueries({ queryKey: ['channel-partners-active'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Cannot delete — this partner may be linked to a booking or project');
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setForm(emptyForm);
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEditModal = (p) => {
    setForm({
      id: p.id,
      name: p.name || '',
      partner_code: p.partner_code || '',
      contact_person: p.contact_person || '',
      mobile: p.mobile || '',
      email: p.email || '',
      active: p.active ?? true,
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

  const filtered = partners.filter((p) => {
    if (!showInactive && p.active === false) return false;
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.partner_code?.toLowerCase().includes(q) ||
      p.contact_person?.toLowerCase().includes(q) ||
      p.mobile?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Channel Partners</h1>
          <p className="text-sm text-slate-500">
            {partners.filter((p) => p.active !== false).length} active · {partners.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition text-sm"
          >
            <HelpCircle size={16} />
            Help
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-[#0a1f44] text-white px-4 py-2 rounded-lg hover:bg-[#122a5c] transition"
          >
            <Plus size={18} />
            New Channel Partner
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, code, contact, or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading channel partners...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {search ? 'No channel partners match your search' : 'No channel partners yet — add one to get started'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Contact Person</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.partner_code || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.contact_person || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex flex-col gap-0.5">
                      {p.mobile && (
                        <span className="flex items-center gap-1 text-xs">
                          <Phone size={12} className="text-slate-400" /> {p.mobile}
                        </span>
                      )}
                      {p.email && (
                        <span className="flex items-center gap-1 text-xs">
                          <Mail size={12} className="text-slate-400" /> {p.email}
                        </span>
                      )}
                      {!p.mobile && !p.email && '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs border ${
                        p.active === false
                          ? 'bg-slate-50 text-slate-500 border-slate-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                    >
                      {p.active === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 text-slate-500 hover:text-[#0a1f44] hover:bg-slate-100 rounded"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
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
                {isEdit ? 'Edit Channel Partner' : 'New Channel Partner'}
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
                  placeholder="Firm / agent name"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">Partner Code</label>
                <input
                  type="text"
                  value={form.partner_code}
                  onChange={(e) => setForm({ ...form, partner_code: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  placeholder="e.g. CP-014"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">Contact Person</label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Mobile</label>
                  <input
                    type="text"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 pt-1">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active (shows up in project assignment / booking dropdowns)
              </label>
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
                {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Add Channel Partner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete channel partner?</h3>
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
      {showHelp && <ChannelPartnersHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
