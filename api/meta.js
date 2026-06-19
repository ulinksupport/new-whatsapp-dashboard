// Vercel serverless proxy — keeps Meta API calls server-side
// Browser calls /api/meta instead of graph.facebook.com directly
// This avoids CORS issues and ad-blocker interference

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const META_GRAPH = 'https://graph.facebook.com/v22.0';
  const { method = 'POST', path, body, token } = req.body || {};

  if (!path) return res.status(400).json({ error: { message: 'path is required' } });
  if (!token) return res.status(400).json({ error: { message: 'token is required' } });

  try {
    const fetchOptions = {
      method,
      headers: { 'Authorization': 'Bearer ' + token }
    };
    if (method !== 'GET' && method !== 'DELETE' && body !== undefined) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }

    const metaRes = await fetch(META_GRAPH + path, fetchOptions);
    const json = await metaRes.json();
    return res.status(metaRes.status).json(json);
  } catch (e) {
    return res.status(500).json({ error: { message: 'Proxy error: ' + e.message } });
  }
}
