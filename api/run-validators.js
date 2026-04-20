/* ══════════════════════════════════════════════════════
   /api/run-validators.js
   Orchestrator — runs all three validators in parallel and
   determines overall outcome. Logs result to Supabase.

   Scoring logic:
   - All three score 7+  → outcome = 'pass'
   - Any score below 5   → outcome = 'fail'
   - Otherwise           → outcome = 'rewrite'

   Returns: { outcome, v1, v2, v3, combined_score }

   Run in Supabase SQL Editor before first use:
   CREATE TABLE IF NOT EXISTS validation_results (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     question_text text,
     category text,
     year_group text,
     v1_score int, v1_reason text,
     v2_score int, v2_reason text,
     v3_score int, v3_reason text,
     outcome text CHECK (outcome IN ('pass','fail','rewrite')),
     attempts int DEFAULT 1,
     created_at timestamp DEFAULT now()
   );
══════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question_text, correct_answer, category, year_group, difficulty } = req.body || {};

  if (!question_text)  return res.status(400).json({ error: 'question_text is required' });
  if (!correct_answer) return res.status(400).json({ error: 'correct_answer is required' });
  if (!category)       return res.status(400).json({ error: 'category is required' });
  if (!year_group)     return res.status(400).json({ error: 'year_group is required' });
  if (!difficulty)     return res.status(400).json({ error: 'difficulty is required' });

  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Build absolute base URL for internal API calls
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const payload = { question_text, correct_answer, category, year_group, difficulty };
  const headers = { 'Content-Type': 'application/json' };

  try {
    // Run all three validators in parallel
    const [r1, r2, r3] = await Promise.all([
      fetch(`${baseUrl}/api/validate-accuracy`,   { method: 'POST', headers, body: JSON.stringify(payload) }),
      fetch(`${baseUrl}/api/validate-difficulty`, { method: 'POST', headers, body: JSON.stringify(payload) }),
      fetch(`${baseUrl}/api/validate-quality`,    { method: 'POST', headers, body: JSON.stringify(payload) }),
    ]);

    const [v1, v2, v3] = await Promise.all([r1.json(), r2.json(), r3.json()]);

    if (v1.error) return res.status(500).json({ error: `validate-accuracy failed: ${v1.error}` });
    if (v2.error) return res.status(500).json({ error: `validate-difficulty failed: ${v2.error}` });
    if (v3.error) return res.status(500).json({ error: `validate-quality failed: ${v3.error}` });

    const scores = [v1.score, v2.score, v3.score];
    const combined_score = Math.round((scores.reduce((a, b) => a + b, 0) / 3) * 10) / 10;

    let outcome;
    if (scores.every(s => s >= 7)) {
      outcome = 'pass';
    } else if (scores.some(s => s < 5)) {
      outcome = 'fail';
    } else {
      outcome = 'rewrite';
    }

    console.log(`run-validators: ${outcome} (scores: ${scores.join(', ')}) — ${category} ${year_group}`);

    // Log to Supabase (best-effort — don't fail the request if logging fails)
    if (supabaseUrl && serviceRoleKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/validation_results`, {
          method: 'POST',
          headers: {
            'apikey':        serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type':  'application/json',
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({
            question_text,
            category,
            year_group,
            v1_score:  v1.score,
            v1_reason: v1.reason,
            v2_score:  v2.score,
            v2_reason: v2.reason,
            v3_score:  v3.score,
            v3_reason: v3.reason,
            outcome,
            attempts:  1,
          }),
        });
      } catch (logErr) {
        console.warn('run-validators: Supabase log failed (non-fatal):', logErr.message);
      }
    }

    return res.status(200).json({ outcome, v1, v2, v3, combined_score });

  } catch (err) {
    console.error('run-validators error:', err.message);
    return res.status(500).json({ error: err.message || 'Validation failed' });
  }
}
