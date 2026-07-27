// src/components/ReleaseBlockModal.jsx
// Small modal to release an actively-blocked plot back to "available".
// Wire this in from PlotInventory.jsx when a blocked plot is clicked
// and the user chooses "Release" instead of proceeding to New Booking.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

export default function ReleaseBlockModal({ plot, onClose }) {
  const queryClient = useQueryClient();
  const [releasedById, setReleasedById] = useState('');

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

  const { data: activeBlock } = useQuery({
    queryKey: ['active-block', plot.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('plot_blocks')
        .select('*')
        .eq('plot_id', plot.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      if (!releasedById) throw new Error('Select who is releasing this plot');
      if (!activeBlock) throw new Error('No active block found for this plot');

      const { error: blockErr } = await supabase
        .schema('ksr')
        .from('plot_blocks')
        .update({
          status: 'released',
          released_by: releasedById,
          released_at: new Date().toISOString(),
        })
        .eq('id', activeBlock.id);
      if (blockErr) throw blockErr;

      const { error: plotErr } = await supabase
        .schema('ksr')
        .from('plots')
        .update({ status: 'available' })
        .eq('id', plot.id);
      if (plotErr) throw plotErr;
    },
    onSuccess: () => {
      toast.success(`Plot ${plot.plot_number} released`);
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      onClose();
    },
    onError: (err) => toast.error(err.message || 'Failed to release plot'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Release Plot {plot.plot_number}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {activeBlock ? (
          <p className="text-sm text-slate-600 mb-4">
            Currently blocked for <strong>{activeBlock.customer_name}</strong>
            {activeBlock.customer_mobile ? ` (${activeBlock.customer_mobile})` : ''}. Releasing
            will make this plot available again.
          </p>
        ) : (
          <p className="text-sm text-amber-600 mb-4">No active block found for this plot.</p>
        )}

        <label className="text-xs font-medium text-slate-500">Released By *</label>
        <select
          value={releasedById}
          onChange={(e) => setReleasedById(e.target.value)}
          className="w-full mt-1 mb-4 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        >
          <option value="">Select employee...</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => releaseMutation.mutate()}
            disabled={releaseMutation.isPending || !activeBlock}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {releaseMutation.isPending ? 'Releasing...' : 'Release Plot'}
          </button>
        </div>
      </div>
    </div>
  );
}
