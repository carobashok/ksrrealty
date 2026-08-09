// api/google-upload.js
// Creates a folder in Drive or uploads a file into an existing folder

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, access_token, name, parent_folder_id, mime_type, file_base64 } = req.body;

  if (!access_token) return res.status(400).json({ error: 'Missing access_token' });

  try {
    if (action === 'create_folder') {
      // Create a folder in Drive
      const metadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parent_folder_id ? { parents: [parent_folder_id] } : {}),
      };

      const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      const data = await response.json();
      if (data.error) return res.status(400).json({ error: data.error.message });

      // Make folder publicly readable so links work
      await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });

      return res.status(200).json({ folder_id: data.id });

    } else if (action === 'upload_file') {
      // Upload a file using multipart upload
      if (!file_base64 || !mime_type || !name || !parent_folder_id) {
        return res.status(400).json({ error: 'Missing required fields for upload' });
      }

      const fileBuffer = Buffer.from(file_base64, 'base64');
      const metadata = JSON.stringify({
        name,
        parents: [parent_folder_id],
      });

      const boundary = '-------GoogleDriveUpload';
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadata,
        `--${boundary}`,
        `Content-Type: ${mime_type}`,
        'Content-Transfer-Encoding: base64',
        '',
        file_base64,
        `--${boundary}--`,
      ].join('\r\n');

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': `multipart/related; boundary="${boundary}"`,
          },
          body,
        }
      );

      const data = await response.json();
      if (data.error) return res.status(400).json({ error: data.error.message });

      // Make file publicly readable
      await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });

      return res.status(200).json({
        file_id: data.id,
        file_name: data.name,
        web_view_link: data.webViewLink,
      });

    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
