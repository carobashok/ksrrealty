// api/get-shareable-link.js
// Sets a specific Drive file's permission to "anyone with the link can
// view" — on demand, never by default. Returns the view link.

import { google } from 'googleapis';

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { driveFileId } = req.body;
    if (!driveFileId) {
      return res.status(400).json({ error: 'driveFileId is required' });
    }

    const drive = getDriveClient();

    await drive.permissions.create({
      fileId: driveFileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const file = await drive.files.get({
      fileId: driveFileId,
      fields: 'webViewLink',
    });

    return res.status(200).json({ driveViewLink: file.data.webViewLink });
  } catch (err) {
    console.error('Share error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create shareable link' });
  }
}
