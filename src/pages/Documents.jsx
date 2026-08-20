// src/pages/Documents.jsx
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getValidAccessToken, ensureProjectFolder, uploadFileToDrive } from '../lib/googleDrive';
import toast from 'react-hot-toast';
import { Upload, ExternalLink, Trash2, FileText, FolderOpen, RefreshCw, Search } from 'lucide-react';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

const inr = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN');

export default function Documents() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [projectFilter, setProjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingProjectId, setUploadingProjectId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importingProjectId, setImportingProjectId] = useState(null);

  // Fetch settings for Drive tokens
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

  // Fetch all projects
  const { data: projects = [] } = useQuery({
    queryKey: ['documents-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('projects')
        .select('id, name, drive_folder_id')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['all-documents', projectFilter],
    queryFn: async () => {
      let q = supabase
        .schema('ksr')
        .from('project_documents')
        .select('id, project_id, file_name, drive_file_id, drive_view_link, uploaded_at')
        .order('uploaded_at', { ascending: false });
      if (projectFilter) q = q.eq('project_id', projectFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const isDriveConnected = !!settings?.drive_refresh_token;

  // Filter by search
  const filtered = documents.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.file_name?.toLowerCase().includes(q) ||
      projectMap[d.project_id]?.name?.toLowerCase().includes(q)
    );
  });

  // Upload handler
  const handleUpload = async (e, projectId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isDriveConnected) { toast.error('Google Drive not connected — go to Settings'); return; }

    const project = projectMap[projectId];
    if (!project) return;

    setUploading(true);
    setUploadingProjectId(projectId);
    try {
      const accessToken = await getValidAccessToken(settings);
      const folderId = await ensureProjectFolder(accessToken, project, settings);
      queryClient.invalidateQueries({ queryKey: ['documents-projects'] });

      const { file_id, file_name, web_view_link } = await uploadFileToDrive(accessToken, file, folderId);

      const { error } = await supabase
        .schema('ksr')
        .from('project_documents')
        .upsert({
          project_id: projectId,
          file_name,
          drive_file_id: file_id,
          drive_view_link: web_view_link,
          uploaded_at: new Date().toISOString(),
        }, { onConflict: 'drive_file_id' });
      if (error) throw error;

      toast.success(`${file_name} uploaded`);
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadingProjectId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Import from Drive handler
  const handleImport = async (projectId) => {
    if (!isDriveConnected) { toast.error('Google Drive not connected — go to Settings'); return; }
    const project = projectMap[projectId];
    if (!project?.drive_folder_id) {
      toast.error('No Drive folder linked to this project yet. Upload a file first to auto-create the folder.');
      return;
    }

    setImporting(true);
    setImportingProjectId(projectId);
    try {
      const accessToken = await getValidAccessToken(settings);

      // List files from Drive folder
      const res = await fetch('/api/google-list-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, folder_id: project.drive_folder_id }),
      });
      const text = await res.text();
      if (!text) throw new Error('Empty response from server — check if api/google-list-files.js is deployed');
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('Invalid response: ' + text.slice(0, 100)); }
      if (!res.ok) throw new Error(data.error || 'Failed to list Drive files');

      if (data.files.length === 0) {
        toast('No files found in this project\'s Drive folder');
        return;
      }

      // Upsert all files — duplicate drive_file_ids are silently skipped
      const payload = data.files.map(f => ({
        project_id: projectId,
        file_name: f.name,
        drive_file_id: f.id,
        drive_view_link: f.webViewLink,
        uploaded_at: f.modifiedTime || new Date().toISOString(),
      }));

      const { error } = await supabase
        .schema('ksr')
        .from('project_documents')
        .upsert(payload, { onConflict: 'drive_file_id' });
      if (error) throw error;

      toast.success(`Imported ${data.files.length} file(s) from Drive`);
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
      setImportingProjectId(null);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Remove "${doc.file_name}" from the MIS? (File stays in Google Drive)`)) return;
    const { error } = await supabase
      .schema('ksr')
      .from('project_documents')
      .delete()
      .eq('id', doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Document removed');
    queryClient.invalidateQueries({ queryKey: ['all-documents'] });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Documents</h1>
          <p className="text-sm text-slate-500">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {!isDriveConnected && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            Google Drive not connected — go to Settings
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by file name or project..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
          />
        </div>
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Per-project action bar */}
      {projectFilter && (
        <div className="flex items-center gap-3 mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <span className="text-sm font-medium text-slate-700">{projectMap[projectFilter]?.name}</span>
          <div className="flex gap-2 ml-auto">
            {/* Import from Drive */}
            <button
              onClick={() => handleImport(projectFilter)}
              disabled={importing && importingProjectId === projectFilter}
              className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-white disabled:opacity-50"
            >
              <RefreshCw size={14} className={importing && importingProjectId === projectFilter ? 'animate-spin' : ''} />
              {importing && importingProjectId === projectFilter ? 'Importing...' : 'Import from Drive'}
            </button>
            {/* Upload */}
            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer ${
              isDriveConnected && !uploading ? 'bg-[#0a1f44] text-white hover:bg-[#122a5c]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}>
              <Upload size={14} />
              {uploading && uploadingProjectId === projectFilter ? 'Uploading...' : 'Upload File'}
              <input
                ref={fileInputRef}
                type="file"
                onChange={e => handleUpload(e, projectFilter)}
                disabled={!isDriveConnected || uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Documents table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slateate-400">Loading documents...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {projectFilter
              ? 'No documents for this project — upload a file or import from Drive'
              : 'No documents yet — select a project to upload or import'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">File Name</th>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-center px-4 py-3">Uploaded</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-700">{doc.file_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {projectMap[doc.project_id]?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {doc.uploaded_at
                      ? new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={doc.drive_view_link}
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
                        title="Remove from MIS"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
