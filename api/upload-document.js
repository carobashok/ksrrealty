// api/upload-document.js
// Uploads a base64-encoded file to the shared Google Drive folder using
// the service account. Returns the new file's Drive ID + view link.
// The service account credentials NEVER reach the browser — this function
// is the only thing that touches them.

import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_ID = '1j6zouC95FEoXajLwKgnxrreOYSTEwUfY';

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
    const { fileName, mimeType, base64Data, projectId, plotId } = req.body;
    if (!fileName || !base64Data) {
      return res.status(400).json({ error: 'fileName and base64Data are required' });
    }

    const drive = getDriveClient();

    // Organize by project (and plot, if given) as subfolders under the
    // shared folder, so Drive stays browsable/tidy for humans too.
    let targetFolderId = FOLDER_ID;
    if (projectId) {
      targetFolderId = await ensureSubfolder(drive, FOLDER_ID, projectId);
      if (plotId) {
        targetFolderId = await ensureSubfolder(drive, targetFolderId, plotId);
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const stream = Readable.from(buffer);

    const file = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType: mimeType || 'application/octet-stream',
        body: stream,
      },
      fields: 'id, webViewLink',
    });

    return res.status(200).json({
      driveFileId: file.data.id,
      driveViewLink: file.data.webViewLink,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

// Finds or creates a subfolder with the given name inside parentId —
// used to keep each project/plot's documents organized in Drive.
async function ensureSubfolder(drive, parentId, name) {
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  if (existing.data.files.length > 0) {
    return existing.data.files[0].id;
  }
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return created.data.id;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};
