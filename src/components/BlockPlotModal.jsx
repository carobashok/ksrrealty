// src/components/BlockPlotModal.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const EXPIRY_OPTIONS = [
  { label: 'No expiry', hours: null },
  { label: '1 day', hours: 24 },
  { label: '2 days', hours: 48 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
];

export default function BlockPlotModal({ plot, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customer_name: '',
    customer_mobile: '',
    blocked_by_type: 'internal', // 'internal' | 'channel_partner' — must match plot_blocks_blocked_by_type_check
    blocked_by_id: '',
    expiry_hours: 72,
    notes: '',
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('employees')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['channel-partners-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('channel_partners')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!form.customer_name.trim()) throw new Error('Customer name is required');
      if (!form.blocked_by_id) throw new Error('Select who is blocking this plot');

      const expiry_time = form.expiry_hours
        ? new Date(Date.now() + form.expiry_hours * 3600 * 1000).toISOString()
        : null;

      const { error: blockErr } = await supabase.schema('ksr').from('plot_blocks').insert({
        plot_id: plot.id,
        blocked_by_type: form.blocked_by_type,
        blocked_by_id: form.blocked_by_id,
        customer_name: form.customer_name.trim(),
        customer_mobile: form.customer_mobile.trim() || null,
        block_time: new Date().toISOString(),
        expiry_time,
        status: 'active',
        notes: form.notes.trim() || null,
      });
      if (blockErr) throw blockErr;

      const { error: plotErr } = await supabase
        .schema('ksr')
        .from('plots')
        .update({ status: 'blocked' })
        .eq('id', plot.id);
      if (plotErr) throw plotErr;
    },
    onSuccess: () => {
      toast.success(`Plot ${plot.plot_number} blocked`);
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      onClose();
    },
    onError: (err) => toast.error(err.message || 'Failed to block plot'),
  });

  const peopleOptions = form.blocked_by_type === 'internal' ? employees : partners;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Block Plot {plot.plot_number}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Customer Name *</label>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
              placeholder="Name of person requesting hold"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Mobile</label>
            <input
              type="text"
              value={form.customer_mobile}
              onChange={(e) => setForm({ ...form, customer_mobile: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Blocked By</label>
              <select
                value={form.blocked_by_type}
                onChange={(e) =>
                  setForm({ ...form, blocked_by_type: e.target.value, blocked_by_id: '' })
                }
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
              >
                <option value="internal">Employee</option>
                <option value="channel_partner">Channel Partner</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Name</label>
              <select
                value={form.blocked_by_id}
                onChange={(e) => setForm({ ...form, blocked_by_id: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
              >
                <option value="">Select...</option>
                {peopleOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Hold Period</label>
            <select
              value={form.expiry_hours ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  expiry_hours: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
            >
              {EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.hours ?? ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => blockMutation.mutate()}
            disabled={blockMutation.isPending}
            className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50"
          >
            {blockMutation.isPending ? 'Blocking...' : 'Block Plot'}
          </button>
        </div>
      </div>
    </div>
  );
}
