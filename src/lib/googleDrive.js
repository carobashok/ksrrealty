// src/lib/googleDrive.js
// Helper functions for Google Drive OAuth and file operations

import { supabase } from './supabase';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Build the Google OAuth URL
export function getGoogleAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // force refresh_token to be returned
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Exchange auth code for tokens (via Vercel function)
export async function exchangeCodeForTokens(code) {
  const res = await fetch('/api/google-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token exchange failed');
  return data; // { access_token, refresh_token, expiry }
}

// Get a valid access token — refreshes if expired
export async function getValidAccessToken(settings) {
  const now = new Date();
  const expiry = settings.drive_token_expiry ? new Date(settings.drive_token_expiry) : null;

  // If token is still valid (with 5 min buffer), return it
  if (settings.drive_access_token && expiry && expiry > new Date(now.getTime() + 5 * 60 * 1000)) {
    return settings.drive_access_token;
  }

  // Refresh the token
  if (!settings.drive_refresh_token) throw new Error('Google Drive not connected. Please connect in Settings.');

  const res = await fetch('/api/google-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: settings.drive_refresh_token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Token refresh failed');

  // Save new access token to DB
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

// Create a folder in Drive, return folder_id
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

// Upload a file to Drive, return { file_id, file_name, web_view_link }
export async function uploadFileToDrive(access_token, file, parent_folder_id) {
  // Convert file to base64
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

// Ensure project folder exists — creates if not, returns folder_id
export async function ensureProjectFolder(access_token, project, settings) {
  if (project.drive_folder_id) return project.drive_folder_id;

  // Create root KSR folder if not exists
  let rootFolderId = settings.drive_root_folder_id;
  if (!rootFolderId) {
    rootFolderId = await createDriveFolder(access_token, 'KSR Realty');
    await supabase
      .schema('ksr')
      .from('company_settings')
      .update({ drive_root_folder_id: rootFolderId })
      .eq('id', SETTINGS_ID);
  }

  // Create project folder inside root
  const projectFolderId = await createDriveFolder(access_token, project.name, rootFolderId);

  // Save folder ID to project
  await supabase
    .schema('ksr')
    .from('projects')
    .update({ drive_folder_id: projectFolderId })
    .eq('id', project.id);

  return projectFolderId;
}
