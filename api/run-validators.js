/* ══════════════════════════════════════════════════════
   /api/run-validators.js
   Runs all three validators in parallel as internal functions
   and determines overall outcome. Logs result to Supabase.

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

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const HAIKU_MODEL   = 'claude-haiku-4-5-20251001';

function anthropicHeaders(apiKey) {
  return {
    'x-api-key':         apiKey,
    'anthropic-version': '2023-06-01',
    'content-type':      'application/json',
  };
}

const PARSE_FALLBACK = { score: 5, reason: 'Could not parse validator response', verdict: 'warn' };

function parseValidatorResponse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    console.warn('parseValidatorResponse: falling back to default. Raw:', rawText.slice(0, 200));
    return PARSE_FALLBACK;
  }
}

// ── Validator 1: Accuracy ──────────────────────────────
async function validateAccuracy({ question_text, correct_answer, category, year_group }, apiKey) {
  const system = `You are an expert SEAG transfer test validator for Northern Ireland P6/P7 pupils (ages 10-11). Your job is to verify whether the given correct answer is actually correct for the question.

For maths questions: verify by calculation.
For English questions: verify against grammar/spelling/punctuation rules.
For comprehension: verify the answer is supported by the question text.

Return ONLY a JSON object in this exact format:
{"score":<number 1-10>,"reason":"<brief explanation>","verdict":"<pass|warn|fail>"}`;

  const userMessage = `Category: ${category}
Year group: ${year_group}
Question: ${question_text}
Correct answer: ${correct_answer}

Is this answer correct? Score 7+ = pass, 4-6 = warn, 1-3 = fail.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model:      HAIKU_MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'validate-accuracy AI error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score), reason: result.reason || '', verdict: result.verdict || 'warn' };
}

// ── Validator 2: Difficulty ────────────────────────────
async function validateDifficulty({ question_text, correct_answer, category, year_group, difficulty }, apiKey) {
  const system = `You are an expert SEAG transfer test validator for Northern Ireland P6/P7 pupils (ages 10-11). Your job is to verify whether the question difficulty is appropriate for the target year group.

P6 pupils are approximately 9-10 years old, early in their transfer test preparation.
P7 pupils are approximately 10-11 years old, in final exam preparation.

Consider: vocabulary level, mathematical complexity, reading demand, and whether the skill would be expected at that stage.

Return ONLY a JSON object in this exact format:
{"score":<number 1-10>,"reason":"<brief explanation>","verdict":"<pass|warn|fail>"}`;

  const userMessage = `Category: ${category}
Year group: ${year_group}
Claimed difficulty: ${difficulty}
Question: ${question_text}
Correct answer: ${correct_answer}

Is this question appropriate for ${year_group}? Score 7+ = pass, 4-6 = warn, 1-3 = fail.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model:      HAIKU_MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'validate-difficulty AI error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score), reason: result.reason || '', verdict: result.verdict || 'warn' };
}

// ── Validator 3: Quality ───────────────────────────────
async function validateQuality({ question_text, correct_answer, category, year_group }, apiKey) {
  const system = `You are an expert SEAG transfer test validator for Northern Ireland P6/P7 pupils (ages 10-11). Your job is to verify question quality.

Check:
1. Is the question clearly and unambiguously worded?
2. Are the wrong answer options (if present) plausible but definitely wrong?
3. Does it follow SEAG question style?
4. Is the question free from bias or culturally inappropriate content?

Return ONLY a JSON object in this exact format:
{"score":<number 1-10>,"reason":"<brief explanation>","verdict":"<pass|warn|fail>"}`;

  const userMessage = `Category: ${category}
Year group: ${year_group}
Question: ${question_text}
Correct answer: ${correct_answer}

Rate the quality of this question. Score 7+ = pass, 4-6 = warn, 1-3 = fail.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model:      HAIKU_MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'validate-quality AI error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score), reason: result.reason || '', verdict: result.verdict || 'warn' };
}

// ── Handler ────────────────────────────────────────────
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

  const apiKey         = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) return res.status(500).json({ error: 'AI configuration error' });

  const payload = { question_text, correct_answer, category, year_group, difficulty };

  try {
    const [v1, v2, v3] = await Promise.all([
      validateAccuracy(payload,   apiKey),
      validateDifficulty(payload, apiKey),
      validateQuality(payload,    apiKey),
    ]);

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
