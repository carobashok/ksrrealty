// src/pages/Settings.jsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';

// Fixed id for the single company_settings row — matches migration_06.
const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

// Supabase Storage bucket used for the logo. Must exist and be public —
// create it once in Supabase Dashboard → Storage → New bucket → "company-assets" (public).
const LOGO_BUCKET = 'company-assets';

export default function Settings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    account_holder_name: 'KSR REALTY',
    bank_name: '',
    account_no: '',
    ifsc_code: '',
    address: '',
    logo_url: '',
  });
  const [uploading, setUploading] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('company_settings')
        .select('*')
        .eq('id', SETTINGS_ID)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        account_holder_name: settings.account_holder_name || 'KSR REALTY',
        bank_name: settings.bank_name || '',
        account_no: settings.account_no || '',
        ifsc_code: settings.ifsc_code || '',
        address: settings.address || '',
        logo_url: settings.logo_url || '',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Upsert on the fixed id — works whether or not a row already exists,
      // so this can never fail with "settings is undefined".
      const { error } = await supabase
        .schema('ksr')
        .from('company_settings')
        .upsert({ id: SETTINGS_ID, ...form, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    },
    onError: (err) => toast.error(err.message || 'Failed to save settings'),
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `logo/ksr-realty-logo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: publicUrlData.publicUrl }));
      toast.success('Logo uploaded — click Save Settings to apply');
    } catch (err) {
      toast.error(
        err.message?.includes('Bucket not found')
          ? `Create a public storage bucket named "${LOGO_BUCKET}" in Supabase first (Storage → New bucket)`
          : err.message || 'Logo upload failed'
      );
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <div className="p-6 text-slate-400">Loading settings...</div>;

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-6">
        This bank account appears as the "KSR REALTY" row on every quotation, across all projects.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-500">Logo</label>
          <div className="flex items-center gap-3 mt-1">
            {form.logo_url && (
              <img
                src={form.logo_url}
                alt="KSR Realty logo"
                className="h-12 w-auto border border-slate-200 rounded bg-white p-1"
              />
            )}
            <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
              <Upload size={14} />
              {uploading ? 'Uploading...' : form.logo_url ? 'Replace logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-1">Shown at the top of every quotation and receipt.</p>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500">Account Holder Name</label>
          <input
            type="text"
            value={form.account_holder_name}
            onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Bank Name</label>
          <input
            type="text"
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Account No.</label>
            <input
              type="text"
              value={form.account_no}
              onChange={(e) => setForm({ ...form, account_no: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">IFSC Code</label>
            <input
              type="text"
              value={form.ifsc_code}
              onChange={(e) => setForm({ ...form, ifsc_code: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500">Office Address</label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={4}
            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
            placeholder="One office per line"
          />
          <p className="text-xs text-slate-400 mt-1">
            Shown in the footer of every quotation and receipt. Put each office on its own line.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
