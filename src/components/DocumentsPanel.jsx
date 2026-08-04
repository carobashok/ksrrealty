// src/components/DocumentsPanel.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Upload, FileText, Trash2, Link as LinkIcon, Eye, Lock } from 'lucide-react';

const DOC_TYPES = [
  { value: 'dtcp_approval', label: 'DTCP Approval' },
  { value: 'rera_certificate', label: 'RERA Certificate' },
  { value: 'layout_approval', label: 'Layout Approval' },
  { value: 'ec', label: 'EC (Encumbrance Certificate)' },
  { value: 'patta', label: 'Patta' },
  { value: 'fmb_sketch', label: 'FMB Sketch' },
  { value: 'survey_sketch', label: 'Survey Sketch' },
  { value: 'sale_deed', label: 'Sale Deed' },
  { value: 'power_of_attorney', label: 'Power of Attorney' },
  { value: 'noc', label: 'NOC' },
  { value: 'other', label: 'Other' },
];
const docLabel = (v) => DOC_TYPES.find((d) => d.value === v)?.label || v;

// projectId: required. plotId: pass null/undefined for project-level docs,
// or a plot's id for plot-level docs.
export default function DocumentsPanel({ projectId, plotId = null }) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [docType, setDocType] = useState('other');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sharingId, setSharingId] = useState(null);

  const queryKey = ['project-documents', projectId, plotId];

  const { data: documents = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .schema('ksr')
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });
      q = plotId ? q.eq('plot_id', plotId) : q.is('plot_id', null);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async () => {
    if (!file) {
      toast.error('Choose a file first');
      return;
    }
    setUploading(true);
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const uploadRes = await fetch('/api/upload-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64Data,
          projectId,
          plotId,
        }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      const { error: dbError } = await supabase.schema('ksr').from('project_documents').insert({
        project_id: projectId,
        plot_id: plotId,
        document_type: docType,
        file_name: file.name,
        drive_file_id: uploadData.driveFileId,
        drive_view_link: uploadData.driveViewLink,
        is_shareable: false,
      });
      if (dbError) throw dbError;

      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey });
      setShowUpload(false);
      setFile(null);
      setDocType('other');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (doc) => {
    if (doc.is_shareable && doc.drive_view_link) {
      window.open(doc.drive_view_link, '_blank');
      return;
    }
    // Not shareable yet — make it shareable on demand, then open it.
    setSharingId(doc.id);
    try {
      const res = await fetch('/api/get-shareable-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFileId: doc.drive_file_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to share');

      await supabase
        .schema('ksr')
        .from('project_documents')
        .update({ is_shareable: true, drive_view_link: data.driveViewLink })
        .eq('id', doc.id);

      queryClient.invalidateQueries({ queryKey });
      window.open(data.driveViewLink, '_blank');
    } catch (err) {
      toast.error(err.message || 'Failed to open document');
    } finally {
      setSharingId(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // Removes the metadata row only — the file itself stays in Drive.
      const { error } = await supabase.schema('ksr').from('project_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Removed from list (file still in Drive)');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Documents
        </h3>
        <button
          onClick={() => setShowUpload((s) => !s)}
          className="flex items-center gap-1 text-sm bg-[#0a1f44] text-white px-3 py-1.5 rounded-lg hover:bg-[#122a5c]"
        >
          <Upload size={14} /> Upload
        </button>
      </div>

      {showUpload && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Category</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full mt-1 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowUpload(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50 text-sm"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-slate-400 text-sm py-2">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="text-slate-400 text-sm py-2">No documents uploaded yet.</div>
      ) : (
        <div className="space-y-1">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between py-2 border-b border-slate-100 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 truncate">{doc.file_name}</div>
                  <div className="text-xs text-slate-400">{docLabel(doc.document_type)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.is_shareable ? (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <LinkIcon size={12} /> Shareable
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Lock size={12} /> Private
                  </span>
                )}
                <button
                  onClick={() => handleView(doc)}
                  disabled={sharingId === doc.id}
                  className="p-1.5 text-slate-500 hover:text-[#0a1f44] hover:bg-slate-100 rounded"
                  title={doc.is_shareable ? 'Open' : 'Make shareable & open'}
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
