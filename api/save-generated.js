/* ══════════════════════════════════════════════════════
   /api/save-generated.js
   Phase 3 — Save passing generated questions to the
   live questions table in one batch insert.

   Accepts POST: { questions: [...] }
   Each question must have all fields from generate-questions.js
   plus validation.v1/v2/v3 from run-validators.js.

   Inserts with:
   - validated = true  (all passed three validators)
   - source    = 'ai_generated_v2'
   - validator_verdict = 'pass'
   - validator_reason  = combined v1/v2/v3 reasons

   Returns: { saved: count }
══════════════════════════════════════════════════════ */

const ENGLISH_TOPICS = new Set([
  'punctuation', 'grammar', 'spelling', 'vocabulary',
  'comprehension_mc', 'comprehension_written',
]);

function deriveSubject(category) {
  return ENGLISH_TOPICS.has(category) ? 'english' : 'maths';
}

function combineReasons(v1, v2, v3) {
  const parts = [
    v1?.reason ? `Accuracy: ${v1.reason}`   : null,
    v2?.reason ? `Difficulty: ${v2.reason}` : null,
    v3?.reason ? `Quality: ${v3.reason}`    : null,
  ].filter(Boolean);
  return parts.join(' | ') || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { questions } = req.body || {};

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions array is required and must not be empty' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) return res.status(500).json({ error: 'NEXT_PUBLIC_SUPABASE_URL not configured' });
  if (!serviceKey)  return res.status(500).json({ error: 'Supabase service key not configured' });

  const rows = questions.map(q => {
    const v1 = q.validation?.v1 || {};
    const v2 = q.validation?.v2 || {};
    const v3 = q.validation?.v3 || {};

    return {
      subject:          deriveSubject(q.category),
      topic:            q.category,
      year_group:       q.year_group,
      difficulty:       Number(q.difficulty) || 3,
      question_type:    q.question_type || 'Multiple_Choice',
      question_text:    q.question_text,
      options:          q.options || null,
      correct_answer:   q.correct_answer,
      explanation:      q.explanation || null,
      validated:        true,
      source:           'ai_generated_v2',
      validator_verdict: 'pass',
      validator_reason:  combineReasons(v1, v2, v3),
    };
  });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/questions`, {
      method: 'POST',
      headers: {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('save-generated: Supabase insert error:', response.status, errorBody.slice(0, 300));
      return res.status(500).json({ error: `Database error ${response.status}: ${errorBody.slice(0, 200)}` });
    }

    console.log(`save-generated: inserted ${rows.length} questions (source=ai_generated_v2)`);
    return res.status(200).json({ saved: rows.length });

  } catch (err) {
    console.error('save-generated error:', err.message);
    return res.status(500).json({ error: err.message || 'Save failed' });
  }
}
