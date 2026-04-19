/* ══════════════════════════════════════════════════════
   /question-builder/api/save-reference.js
   Inserts extracted questions into the reference_questions
   table using the Supabase service role key.

   Run this in Supabase SQL editor before first use:
   CREATE TABLE IF NOT EXISTS reference_questions (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     question_text text NOT NULL,
     correct_answer text NOT NULL,
     category text NOT NULL,
     difficulty text CHECK (difficulty IN ('easy','medium','hard')),
     year_group text CHECK (year_group IN ('P6','P7')),
     paper_source text,
     extracted_at timestamp DEFAULT now()
   );
══════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { questions, year_group, paper_source } = req.body || {};

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions array is required and must not be empty' });
  }
  if (!year_group)   return res.status(400).json({ error: 'year_group is required' });
  if (!paper_source) return res.status(400).json({ error: 'paper_source is required' });

  const supabaseUrl     = process.env.SUPABASE_URL;
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl)    return res.status(500).json({ error: 'Supabase URL not configured' });
  if (!serviceRoleKey) return res.status(500).json({ error: 'Supabase service key not configured' });

  // Map questions to include year_group and paper_source
  const rows = questions.map(q => ({
    question_text:  q.question_text,
    correct_answer: q.correct_answer,
    category:       q.category,
    difficulty:     q.difficulty || 'medium',
    year_group,
    paper_source,
  }));

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/reference_questions`, {
      method: 'POST',
      headers: {
        'apikey':        serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Supabase insert error:', response.status, errorBody);
      return res.status(500).json({ error: `Database error: ${response.status}` });
    }

    console.log(`Saved ${rows.length} reference questions from ${paper_source}`);
    return res.status(200).json({ saved: rows.length });

  } catch (err) {
    console.error('save-reference error:', err.message);
    return res.status(500).json({ error: err.message || 'Save failed' });
  }
}
