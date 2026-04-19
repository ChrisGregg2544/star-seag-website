/* ══════════════════════════════════════════════════════
   /question-builder/api/get-question-counts.js
   Fetches validated question counts from Supabase using
   the service role key (bypasses RLS row limits entirely)
   and groups by topic + year_group server-side.
   Returns: { counts: { "punctuation_P6": 79, ... }, total: 1156 }
══════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl)    return res.status(500).json({ error: 'SUPABASE_URL not configured' });
  if (!serviceRoleKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/questions?select=topic,year_group&validated=eq.true`,
      {
        headers: {
          'apikey':        serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Range':         '0-99999',
          'Prefer':        'count=exact',
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('Supabase fetch error:', response.status, body);
      return res.status(500).json({ error: `Supabase error: ${response.status}` });
    }

    const rows = await response.json();

    // Group by topic_YearGroup key
    const counts = {};
    let total = 0;

    (rows || []).forEach(row => {
      const topic = (row.topic || '').toLowerCase();
      const yg    = row.year_group;
      if (!topic || (yg !== 'P6' && yg !== 'P7')) return;
      const key = `${topic}_${yg}`;
      counts[key] = (counts[key] || 0) + 1;
      total++;
    });

    console.log(`get-question-counts: ${total} validated questions across ${Object.keys(counts).length} buckets`);
    return res.status(200).json({ counts, total });

  } catch (err) {
    console.error('get-question-counts error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to fetch counts' });
  }
}
