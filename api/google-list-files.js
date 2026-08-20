// api/google-list-files.js
// Lists all files in a Google Drive folder

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { access_token, folder_id } = req.body;
  if (!access_token || !folder_id) return res.status(400).json({ error: 'Missing access_token or folder_id' });

  try {
    const params = new URLSearchParams({
      q: `'${folder_id}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,webViewLink,size,modifiedTime)',
      pageSize: '100',
    });

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    // Filter out folders, only return files
    const files = (data.files || []).filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    return res.status(200).json({ files });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
