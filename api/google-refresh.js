// api/google-refresh.js
// Refreshes an expired access token using the stored refresh token

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'Missing refresh_token' });

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error_description || data.error });

    return res.status(200).json({
      access_token: data.access_token,
      expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
