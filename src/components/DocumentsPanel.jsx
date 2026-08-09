// src/components/DocumentsPanel.jsx
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getValidAccessToken, ensureProjectFolder, uploadFileToDrive } from '../lib/googleDrive';
import toast from 'react-hot-toast';
import { Upload, FileText, ExternalLink, Trash2 } from 'lucide-react';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export default function DocumentsPanel({ projectId }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');

  // Fetch settings (for drive tokens)
  const { data: settings } = useQuery({
    queryKey: ['company-settings-drive'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('company_settings')
        .select('drive_access_token, drive_refresh_token, drive_token_expiry, drive_root_folder_id')
        .eq('id', SETTINGS_ID)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch project (for name + drive_folder_id)
  const { data: project } = useQuery({
    queryKey: ['project-for-docs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('projects')
        .select('id, name, drive_folder_id')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch documents for this project
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['project-documents', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!settings?.drive_refresh_token) {
      toast.error('Google Drive not connected — go to Settings to connect');
      return;
    }

    setUploading(true);
    try {
      // 1. Get valid access token
      const accessToken = await getValidAccessToken(settings);

      // 2. Ensure project folder exists (creates if not)
      const folderId = await ensureProjectFolder(accessToken, project, settings);

      // Refresh project query to get updated drive_folder_id
      queryClient.invalidateQueries({ queryKey: ['project-for-docs', projectId] });

      // 3. Upload file to Drive
      setUploadLabel(`Uploading ${file.name}...`);
      const { file_id, file_name, web_view_link } = await uploadFileToDrive(accessToken, file, folderId);

      // 4. Save document record to Supabase
      const { error } = await supabase
        .schema('ksr')
        .from('project_documents')
        .insert({
          project_id: projectId,
          file_name,
          drive_file_id: file_id,
          drive_link: web_view_link,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
        });
      if (error) throw error;

      toast.success(`${file_name} uploaded successfully`);
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.file_name}"? This removes it from the MIS but not from Google Drive.`)) return;
    const { error } = await supabase
      .schema('ksr')
      .from('project_documents')
      .delete()
      .eq('id', doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Document removed');
    queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isDriveConnected = !!settings?.drive_refresh_token;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Documents</h3>
        <div className="flex items-center gap-2">
          {!isDriveConnected && (
            <span className="text-xs text-amber-600 border border-amber-200 bg-amber-50 px-2 py-1 rounded">
              Drive not connected
            </span>
          )}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition ${
            isDriveConnected && !uploading
              ? 'bg-[#0a1f44] text-white hover:bg-[#122a5c]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}>
            <Upload size={14} />
            {uploading ? uploadLabel || 'Uploading...' : 'Upload'}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              disabled={!isDriveConnected || uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="text-sm text-slate-400">
          {isDriveConnected
            ? 'No documents uploaded yet — click Upload to add files'
            : 'Connect Google Drive in Settings to upload documents'}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={16} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{doc.file_name}</p>
                  <p className="text-xs text-slate-400">
                    {formatSize(doc.file_size)}
                    {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={doc.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-400 hover:text-[#0a1f44] rounded"
                  title="Open in Google Drive"
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                  title="Remove"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
