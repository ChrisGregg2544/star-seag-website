/* ══════════════════════════════════════════════════════
   /api/get-question-counts.js
   Calls a Supabase RPC function that runs the GROUP BY
   count inside the database, returning just 24 rows.
   Avoids the REST API row cap entirely.
   Returns: { counts: { "punctuation_P6": 79, ... }, total: 1156 }

   Run this in Supabase SQL Editor before first use:
   CREATE OR REPLACE FUNCTION get_question_counts()
   RETURNS TABLE(topic text, year_group text, count bigint)
   LANGUAGE sql SECURITY DEFINER
   AS $$
     SELECT topic, year_group, COUNT(*) as count
     FROM questions
     WHERE validated = true
     GROUP BY topic, year_group
     ORDER BY topic, year_group;
   $$;
══════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  console.log('ENV CHECK:', {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl)    return res.status(500).json({ error: 'NEXT_PUBLIC_SUPABASE_URL not configured' });
  if (!serviceRoleKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_question_counts`,
      {
        method: 'POST',
        headers: {
          'apikey':        serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('Supabase RPC error — status:', response.status, 'body:', body);
      return res.status(500).json({ error: `Supabase RPC error: ${response.status}`, detail: body });
    }

    const rows = await response.json();

    // Transform [{ topic, year_group, count }] into { "punctuation_P6": 79, ... }
    const counts = {};
    let total = 0;

    (rows || []).forEach(row => {
      const topic = (row.topic || '').toLowerCase();
      const yg    = row.year_group;
      if (!topic || (yg !== 'P6' && yg !== 'P7')) return;
      const key = `${topic}_${yg}`;
      counts[key] = Number(row.count);
      total += Number(row.count);
    });

    console.log(`get-question-counts: ${total} validated questions across ${Object.keys(counts).length} buckets`);
    return res.status(200).json({ counts, total });

  } catch (err) {
    console.error('get-question-counts error:', err.message, err.stack);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
