// src/lib/googleDrive.js
import { supabase } from './supabase';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI;

// Full drive scope needed to access all files owned by user
const SCOPES = 'https://www.googleapis.com/auth/drive';

export function getGoogleAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code) {
  const res = await fetch('/api/google-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token exchange failed');
  return data;
}

export async function getValidAccessToken(settings) {
  const now = new Date();
  const expiry = settings.drive_token_expiry ? new Date(settings.drive_token_expiry) : null;

  if (settings.drive_access_token && expiry && expiry > new Date(now.getTime() + 5 * 60 * 1000)) {
    return settings.drive_access_token;
  }

  if (!settings.drive_refresh_token) throw new Error('Google Drive not connected. Please connect in Settings.');

  const res = await fetch('/api/google-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: settings.drive_refresh_token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token refresh failed');

  await supabase
    .schema('ksr')
    .from('company_settings')
    .update({
      drive_access_token: data.access_token,
      drive_token_expiry: data.expiry,
    })
    .eq('id', SETTINGS_ID);

  return data.access_token;
}

export async function createDriveFolder(access_token, name, parent_folder_id = null) {
  const res = await fetch('/api/google-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_folder', access_token, name, parent_folder_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create folder');
  return data.folder_id;
}

export async function uploadFileToDrive(access_token, file, parent_folder_id) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch('/api/google-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upload_file',
      access_token,
      name: file.name,
      mime_type: file.type || 'application/octet-stream',
      file_base64: base64,
      parent_folder_id,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export async function ensureProjectFolder(access_token, project, settings) {
  if (project.drive_folder_id) return project.drive_folder_id;

  let rootFolderId = settings.drive_root_folder_id;
  if (!rootFolderId) {
    rootFolderId = await createDriveFolder(access_token, 'KSR Realty');
    await supabase
      .schema('ksr')
      .from('company_settings')
      .update({ drive_root_folder_id: rootFolderId })
      .eq('id', SETTINGS_ID);
  }

  const projectFolderId = await createDriveFolder(access_token, project.name, rootFolderId);

  await supabase
    .schema('ksr')
    .from('projects')
    .update({ drive_folder_id: projectFolderId })
    .eq('id', project.id);

  return projectFolderId;
}
