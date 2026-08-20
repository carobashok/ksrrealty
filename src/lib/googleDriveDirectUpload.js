// src/lib/googleDriveDirectUpload.js
// Direct browser-to-Drive upload using resumable upload API
// Bypasses Vercel function size limit

export async function uploadFileToDriveDirect(access_token, file, parent_folder_id) {
  // Step 1: Initiate resumable upload session
  const metadata = {
    name: file.name,
    parents: [parent_folder_id],
  };

  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': file.size,
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.json();
    throw new Error(err.error?.message || 'Failed to initiate upload');
  }

  // Step 2: Get the upload URI from Location header
  const uploadUri = initRes.headers.get('Location');
  if (!uploadUri) throw new Error('No upload URI returned');

  // Step 3: Upload the file directly to Drive
  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Length': file.size,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    throw new Error(err.error?.message || 'Upload failed');
  }

  const data = await uploadRes.json();

  // Step 4: Make file publicly readable
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch (e) {
    console.warn('Permission setting failed (non-fatal):', e.message);
  }

  return {
    file_id: data.id,
    file_name: data.name,
    web_view_link: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}
