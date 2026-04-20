/* ══════════════════════════════════════════════════════
   /api/generate-questions.js
   Phase 3 — Question Generator with Learning Loop

   Accepts POST: { category, year_group, batch_size }

   Steps:
   1. Fetch 10–15 reference examples from reference_questions
   2. Fetch 20 most recent FAIL reasons from validation_results
   3. Fetch 10 highest-scoring PASS questions from validation_results
   4. Fetch existing question_text fingerprints for duplicate detection
   5. Build prompt and call Claude Haiku (max_tokens: 8000)
   6. Robust JSON parse (same strategy as extract-paper.js)
   7. UK English post-check (flag common US spellings)
   8. Duplicate detection (first-80-chars fingerprint match)

   Returns: { questions, skipped_duplicates, total_generated }
   Each question includes source='ai_generated_v2'
══════════════════════════════════════════════════════ */

export const config = { maxDuration: 60 };

const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';
const HAIKU_MODEL    = 'claude-haiku-4-5-20251001';

// ── US → UK spelling pairs for post-check ─────────────
const US_UK_PAIRS = [
  ['color',      'colour'],
  ['flavor',     'flavour'],
  ['honor',      'honour'],
  ['neighbor',   'neighbour'],
  ['favorite',   'favourite'],
  ['organize',   'organise'],
  ['recognize',  'recognise'],
  ['realize',    'realise'],
  ['analyze',    'analyse'],
  ['center',     'centre'],
  ['theater',    'theatre'],
  ['liter',      'litre'],
  ['meter',      'metre'],
  ['aluminum',   'aluminium'],
  ['defense',    'defence'],
  ['offense',    'offence'],
  ['license',    'licence'],
  ['practice',   'practise'],  // verb form
  ['program',    'programme'],
  ['catalog',    'catalogue'],
  ['dialog',     'dialogue'],
  ['traveled',   'travelled'],
  ['canceled',   'cancelled'],
  ['fulfill',    'fulfil'],
  ['skillful',   'skilful'],
  ['enrollment', 'enrolment'],
  ['fulfill',    'fulfil'],
  ['jewelry',    'jewellery'],
  ['pajamas',    'pyjamas'],
  ['gray',       'grey'],
  ['tire',       'tyre'],
  ['curb',       'kerb'],
];

// ── Supabase REST helper ───────────────────────────────
function supabaseHeaders(serviceKey) {
  return {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type':  'application/json',
  };
}

async function supabaseFetch(supabaseUrl, serviceKey, path) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: supabaseHeaders(serviceKey),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Robust JSON parse (mirrors extract-paper.js) ──────
function salvagePartial(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;
  const lastClose = text.lastIndexOf('}');
  if (lastClose === -1) return null;
  const candidate = text.slice(start, lastClose + 1) + ']';
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseGeneratedJSON(rawText) {
  try {
    return { questions: JSON.parse(rawText), truncated: false };
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return { questions: JSON.parse(match[0]), truncated: false };
      } catch {
        const salvaged = salvagePartial(rawText);
        if (salvaged) {
          console.warn(`generate-questions: truncated response, salvaged ${salvaged.length} questions`);
          return { questions: salvaged, truncated: true };
        }
      }
    }
    const salvaged = salvagePartial(rawText);
    if (salvaged) {
      console.warn(`generate-questions: no brackets, salvaged ${salvaged.length} questions`);
      return { questions: salvaged, truncated: true };
    }
    return null;
  }
}

// ── UK English check ───────────────────────────────────
function ukEnglishWarnings(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [us] of US_UK_PAIRS) {
    const re = new RegExp(`\\b${us}\\b`, 'i');
    if (re.test(lower)) found.push(us);
  }
  return found;
}

// ── Duplicate fingerprint (first 80 chars, normalised) ─
function fingerprint(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
}

// ── Category-specific prompt guidance ─────────────────
function categoryGuidance(category) {
  const guides = {
    punctuation: `Generate "find the mistake" questions. Each question gives 4 numbered segments of a sentence; one segment has a punctuation error. Options must be A, B, C, D, or N (N = no mistake). Always include exactly one correct answer.`,
    grammar: `Generate "choose the best word" questions. The question presents a sentence with a gap; options A–E are single words or short phrases that could fill it. Only one is grammatically correct in context.`,
    spelling: `Generate "find the misspelled word" questions. Each question gives 4 numbered words; one is misspelled. Options must be A, B, C, D, or N (N = no mistake). Always include exactly one correct answer.`,
    vocabulary: `Generate questions that test word meaning, synonyms, antonyms, or words in context appropriate for P6/P7 Northern Ireland pupils.`,
    comprehension_mc: `Generate multiple-choice questions based on a short reading passage (50–120 words). Include the passage in the question_text. Questions should test inference, vocabulary in context, and literal comprehension. Options A–E.`,
    comprehension_written: `Generate short-answer comprehension questions based on a reading passage (50–120 words). Include the passage in question_text. Answers should be 1–2 sentences. correct_answer should be a model answer.`,
    arithmetic: `Generate calculation questions: addition, subtraction, multiplication, division, word problems. Use numbers appropriate for P6/P7. Multiple choice A–E.`,
    geometry: `Generate questions about 2D/3D shapes, angles, perimeter, area, symmetry, coordinates. Multiple choice A–E. Describe any required diagram in a diagram_description field.`,
    fractions_decimals: `Generate questions involving fractions, decimals, percentages, and conversions between them. Appropriate for P6/P7. Multiple choice A–E.`,
    measurement: `Generate questions about length, mass, capacity, time, temperature, money, and unit conversions. Use metric units. Multiple choice A–E.`,
    statistics: `Generate questions about bar charts, pictograms, line graphs, pie charts, mean, and range. Describe any required diagram in diagram_description. Multiple choice A–E.`,
    algebra_sequences: `Generate questions about number sequences, function machines, simple algebra (find the missing number), and patterns. Multiple choice A–E.`,
  };
  return guides[category] || 'Generate appropriate SEAG transfer test questions for this category.';
}

// ── Difficulty label helper ────────────────────────────
function difficultyLabel(d) {
  if (d <= 2) return 'easy';
  if (d === 3) return 'medium';
  return 'hard';
}

// ── Build Claude prompt ────────────────────────────────
function buildPrompt({ category, year_group, batch_size, references, failReasons, passExamples }) {
  const isPunctuationOrSpelling = ['punctuation', 'spelling'].includes(category);
  const fifthOption = isPunctuationOrSpelling ? 'N' : 'E';

  const refSection = references.length
    ? `## REFERENCE QUESTIONS (real SEAG exam questions — match this style and difficulty)\n\n${
        references.map((r, i) =>
          `${i + 1}. [${difficultyLabel(r.difficulty || 'medium')}] ${r.question_text}\n   Answer: ${r.correct_answer}`
        ).join('\n\n')
      }`
    : '## REFERENCE QUESTIONS\nNo reference examples available for this category yet.';

  const failSection = failReasons.length
    ? `## PATTERNS TO AVOID (these question types failed validation — do not repeat)\n\n${
        failReasons.map((f, i) => `${i + 1}. ${f.v1_reason || f.v2_reason || f.v3_reason || 'Unclear or ambiguous question'}`).join('\n')
      }`
    : '';

  const passSection = passExamples.length
    ? `## HIGH-QUALITY EXAMPLES (these passed all three validators — aim for this standard)\n\n${
        passExamples.map((p, i) =>
          `${i + 1}. ${p.question_text}\n   Answer: ${p.correct_answer}`
        ).join('\n\n')
      }`
    : '';

  const optionNote = isPunctuationOrSpelling
    ? `IMPORTANT: For ${category} questions, options must be A, B, C, D, N only. Never use E. The N option means "No mistake".`
    : `Options must be A, B, C, D, E.`;

  return `You are an expert creator of SEAG transfer test questions for Northern Ireland P6/P7 pupils (ages 10–11).

## TASK
Generate exactly ${batch_size} original multiple-choice questions for:
- Category: ${category}
- Year group: ${year_group}
- Use UK English spelling throughout (colour not color, organise not organize, etc.)

## CATEGORY GUIDANCE
${categoryGuidance(category)}

${refSection}

${failSection}

${passSection}

## OUTPUT FORMAT
Return ONLY a valid JSON array with exactly ${batch_size} objects. No preamble, no markdown.

Each object must have:
- "question_text": full question text (string)
- "correct_answer": correct option letter (${isPunctuationOrSpelling ? 'A/B/C/D/N' : 'A/B/C/D/E'})
- "explanation": why this answer is correct (1–2 sentences, UK English)
- "difficulty": integer 1–5 (1=very easy, 3=medium, 5=very hard) appropriate for ${year_group}
- "question_type": "Multiple_Choice"
- "options": object with keys ${isPunctuationOrSpelling ? '"A","B","C","D","N"' : '"A","B","C","D","E"'} each mapping to a string

${optionNote}

Make each question original — do not copy reference examples verbatim. Vary difficulty across the batch. Ensure every question has one and only one definitively correct answer.`;
}

// ── Handler ────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { category, year_group, batch_size } = req.body || {};

  if (!category)   return res.status(400).json({ error: 'category is required' });
  if (!year_group) return res.status(400).json({ error: 'year_group is required' });
  if (!batch_size || batch_size < 1 || batch_size > 50)
    return res.status(400).json({ error: 'batch_size must be 1–50' });

  const apiKey      = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey)      return res.status(500).json({ error: 'AI configuration error' });
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Database configuration error' });

  try {
    // ── Step 1: Fetch 10–15 reference examples ──────────
    const refLimit = Math.min(15, Math.max(10, batch_size));
    const refRows = await supabaseFetch(
      supabaseUrl, serviceKey,
      `reference_questions?select=question_text,correct_answer,difficulty&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&limit=${refLimit}&order=extracted_at.desc`
    );
    console.log(`generate-questions: fetched ${refRows.length} reference examples for ${category} ${year_group}`);

    // ── Step 2: Fetch 20 most recent FAIL reasons ───────
    const failRows = await supabaseFetch(
      supabaseUrl, serviceKey,
      `validation_results?select=v1_reason,v2_reason,v3_reason&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&outcome=eq.fail&order=created_at.desc&limit=20`
    );
    console.log(`generate-questions: fetched ${failRows.length} fail patterns`);

    // ── Step 3: Fetch 10 highest-scoring PASS questions ─
    const passRows = await supabaseFetch(
      supabaseUrl, serviceKey,
      `validation_results?select=question_text,correct_answer,v1_score,v2_score,v3_score&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&outcome=eq.pass&order=v1_score.desc,v2_score.desc,v3_score.desc&limit=10`
    );
    console.log(`generate-questions: fetched ${passRows.length} high-quality pass examples`);

    // ── Step 4: Fetch existing question fingerprints ────
    const existingRows = await supabaseFetch(
      supabaseUrl, serviceKey,
      `questions?select=question_text&topic=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&limit=5000`
    );
    const existingFingerprints = new Set(
      existingRows.map(r => fingerprint(r.question_text))
    );
    console.log(`generate-questions: loaded ${existingFingerprints.size} existing fingerprints for duplicate detection`);

    // ── Step 5: Build prompt and call Claude Haiku ──────
    const prompt = buildPrompt({
      category,
      year_group,
      batch_size,
      references:   refRows,
      failReasons:  failRows,
      passExamples: passRows,
    });

    const aiResponse = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      HAIKU_MODEL,
        max_tokens: 8000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      console.error('generate-questions: Anthropic error', aiData.error);
      return res.status(500).json({ error: aiData.error?.message || 'AI API error' });
    }

    const rawText = aiData.content?.[0]?.text || '';

    // ── Step 6: Robust JSON parse ────────────────────────
    const parsed = parseGeneratedJSON(rawText);
    if (!parsed) {
      console.error('generate-questions: JSON parse failed. Raw:', rawText.slice(0, 300));
      return res.status(500).json({ error: 'Could not parse AI response', raw: rawText.slice(0, 2000) });
    }
    if (!Array.isArray(parsed.questions)) {
      return res.status(500).json({ error: 'AI returned unexpected format' });
    }

    // ── Step 7: UK English post-check ───────────────────
    const withUkCheck = parsed.questions.map(q => {
      const warnings = [
        ...ukEnglishWarnings(q.question_text || ''),
        ...ukEnglishWarnings(q.explanation || ''),
        ...Object.values(q.options || {}).flatMap(v => ukEnglishWarnings(v)),
      ];
      const uniqueWarnings = [...new Set(warnings)];
      return {
        ...q,
        category,
        year_group,
        source: 'ai_generated_v2',
        ...(uniqueWarnings.length ? { uk_english_warnings: uniqueWarnings } : {}),
      };
    });

    // ── Step 8: Duplicate detection ──────────────────────
    const unique = [];
    let skipped = 0;
    for (const q of withUkCheck) {
      const fp = fingerprint(q.question_text);
      if (existingFingerprints.has(fp)) {
        skipped++;
        console.log(`generate-questions: duplicate skipped — "${fp.slice(0, 60)}…"`);
      } else {
        existingFingerprints.add(fp); // prevent within-batch duplicates too
        unique.push(q);
      }
    }

    console.log(`generate-questions: DONE — ${unique.length} unique, ${skipped} duplicates skipped, truncated=${parsed.truncated}`);

    return res.status(200).json({
      questions:          unique,
      skipped_duplicates: skipped,
      total_generated:    parsed.questions.length,
      truncated:          parsed.truncated,
    });

  } catch (err) {
    console.error('generate-questions error:', err.message);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
}
