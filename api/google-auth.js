// api/google-auth.js
// Exchanges OAuth authorization code for access + refresh tokens

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error_description || data.error });

    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
