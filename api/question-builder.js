/* ══════════════════════════════════════════════════════
   /api/question-builder.js
   Single merged endpoint for all Question Builder
   operations — keeps project under Vercel Hobby's
   12-function limit.

   Routing:
     GET  /api/question-builder?action=get-question-counts
     POST /api/question-builder  { action: 'extract-paper', ...params }
     POST /api/question-builder  { action: 'generate-questions', ...params }
     POST /api/question-builder  { action: 'run-validators', ...params }
     POST /api/question-builder  { action: 'save-generated', ...params }
     POST /api/question-builder  { action: 'save-reference', ...params }
══════════════════════════════════════════════════════ */

export const config = { maxDuration: 60 };

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const HAIKU_MODEL   = 'claude-haiku-4-5-20251001';

// ── Shared: Supabase REST helpers ──────────────────────
function supabaseHeaders(serviceKey, extra = {}) {
  return {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type':  'application/json',
    ...extra,
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

// ── Shared: robust JSON array parse ───────────────────
function salvagePartial(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;
  const lastClose = text.lastIndexOf('}');
  if (lastClose === -1) return null;
  const candidate = text.slice(start, lastClose + 1) + ']';
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function parseJsonArray(rawText) {
  try {
    return { items: JSON.parse(rawText), truncated: false };
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) {
      try { return { items: JSON.parse(match[0]), truncated: false }; }
      catch { /* fall through */ }
    }
    const salvaged = salvagePartial(rawText);
    if (salvaged) return { items: salvaged, truncated: true };
    return null;
  }
}

// ══════════════════════════════════════════════════════
// HANDLER: extract-paper
// ══════════════════════════════════════════════════════
async function handleExtractPaper(req, res) {
  const { pdf_base64, pdf_filename, answer_sheet, year_group, paper_number } = req.body;

  if (!pdf_base64)   return res.status(400).json({ error: 'pdf_base64 is required' });
  if (!answer_sheet) return res.status(400).json({ error: 'answer_sheet is required' });
  if (!year_group)   return res.status(400).json({ error: 'year_group is required' });
  if (!paper_number) return res.status(400).json({ error: 'paper_number is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI configuration error' });

  const systemPrompt = `You are an expert at analysing SEAG transfer test papers for Northern Ireland P6 and P7 pupils (ages 10-11). You will be given a question paper PDF and an official answer sheet. Extract every question and return a JSON array.`;

  const instruction = `Year group: ${year_group}
Paper: ${paper_number}

The PDF contains the question paper. The text below contains the official answer sheet with correct answers and explanations.

Extract all 56 questions. For each question return:
- question_text: full question text from the PDF
- correct_answer: exact answer from the answer sheet (letter A/B/C/D/E/N for MC, or exact text for written answers)
- explanation: the explanation from the answer sheet for why this answer is correct (copy it accurately)
- category: one of: punctuation, grammar, spelling, vocabulary, comprehension_mc, comprehension_written, arithmetic, geometry, fractions_decimals, measurement, statistics, algebra_sequences
- difficulty: easy, medium, or hard
- needs_diagram: true if the question requires a visual element such as a diagram, shape, graph, chart, table, pictogram, number line, grid, or clock. false if purely text-based.
- diagram_description: brief plain-English description of the diagram if needs_diagram is true, otherwise null

CRITICAL: Use the answer sheet as the source of truth for correct_answer and explanation. Do not guess answers.

For punctuation and spelling questions: correct_answer must be A, B, C, D, or N only. Never E.

Return ONLY a valid JSON array. No preamble, no markdown.

Answer sheet content:
${answer_sheet}`;

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'pdfs-2024-09-25',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      HAIKU_MODEL,
        max_tokens: 16000,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
          { type: 'text', text: instruction },
        ]}],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'AI API error' });

    const rawText = data.content?.[0]?.text || '';
    const parsed  = parseJsonArray(rawText);

    if (!parsed) {
      console.error('extract-paper: JSON parse failed. Raw:', rawText.slice(0, 300));
      return res.status(500).json({ error: 'Could not parse AI response', raw: rawText.slice(0, 2000) });
    }
    if (!Array.isArray(parsed.items)) return res.status(500).json({ error: 'AI returned unexpected format' });

    if (parsed.truncated) console.warn(`extract-paper: truncated response, salvaged ${parsed.items.length} questions`);
    console.log(`extract-paper: extracted ${parsed.items.length} questions from ${year_group} paper ${paper_number}`);
    return res.status(200).json({ questions: parsed.items, truncated: parsed.truncated });

  } catch (err) {
    console.error('extract-paper error:', err.message);
    return res.status(500).json({ error: err.message || 'Extraction failed' });
  }
}

// ══════════════════════════════════════════════════════
// HANDLER: generate-questions
// ══════════════════════════════════════════════════════

const US_UK_PAIRS = [
  ['color','colour'],['flavor','flavour'],['honor','honour'],['neighbor','neighbour'],
  ['favorite','favourite'],['organize','organise'],['recognize','recognise'],
  ['realize','realise'],['analyze','analyse'],['center','centre'],['theater','theatre'],
  ['liter','litre'],['meter','metre'],['aluminum','aluminium'],['defense','defence'],
  ['offense','offence'],['license','licence'],['program','programme'],['catalog','catalogue'],
  ['dialog','dialogue'],['traveled','travelled'],['canceled','cancelled'],['fulfill','fulfil'],
  ['skillful','skilful'],['enrollment','enrolment'],['jewelry','jewellery'],['pajamas','pyjamas'],
  ['gray','grey'],['tire','tyre'],['curb','kerb'],
];

function ukEnglishWarnings(text) {
  const lower = (text || '').toLowerCase();
  return [...new Set(US_UK_PAIRS.filter(([us]) => new RegExp(`\\b${us}\\b`,'i').test(lower)).map(([us]) => us))];
}

function fingerprint(text) {
  return (text || '').toLowerCase().replace(/\s+/g,' ').trim().slice(0, 80);
}

function difficultyLabel(d) {
  if (d <= 2) return 'easy';
  if (d === 3) return 'medium';
  return 'hard';
}

function categoryGuidance(category) {
  const guides = {
    punctuation:            `Generate "find the mistake" questions. Each question gives 4 numbered segments of a sentence; one segment has a punctuation error. Options must be A, B, C, D, or N (N = no mistake). Always include exactly one correct answer.`,
    grammar:                `Generate "choose the best word" questions. The question presents a sentence with a gap; options A–E are single words or short phrases that could fill it. Only one is grammatically correct in context.`,
    spelling:               `Generate "find the misspelled word" questions. Each question gives 4 numbered words; one is misspelled. Options must be A, B, C, D, or N (N = no mistake). Always include exactly one correct answer.`,
    vocabulary:             `Generate questions that test word meaning, synonyms, antonyms, or words in context appropriate for P6/P7 Northern Ireland pupils.`,
    comprehension_mc:       `Generate multiple-choice questions based on a short reading passage (50–120 words). Include the passage in the question_text. Questions should test inference, vocabulary in context, and literal comprehension. Options A–E.`,
    comprehension_written:  `Generate short-answer comprehension questions based on a reading passage (50–120 words). Include the passage in question_text. Answers should be 1–2 sentences. correct_answer should be a model answer.`,
    arithmetic:             `Generate calculation questions: addition, subtraction, multiplication, division, word problems. Use numbers appropriate for P6/P7. Multiple choice A–E.`,
    geometry:               `Generate questions about 2D/3D shapes, angles, perimeter, area, symmetry, coordinates. Multiple choice A–E. Describe any required diagram in a diagram_description field.`,
    fractions_decimals:     `Generate questions involving fractions, decimals, percentages, and conversions between them. Appropriate for P6/P7. Multiple choice A–E.`,
    measurement:            `Generate questions about length, mass, capacity, time, temperature, money, and unit conversions. Use metric units. Multiple choice A–E.`,
    statistics:             `Generate questions about bar charts, pictograms, line graphs, pie charts, mean, and range. Describe any required diagram in diagram_description. Multiple choice A–E.`,
    algebra_sequences:      `Generate questions about number sequences, function machines, simple algebra (find the missing number), and patterns. Multiple choice A–E.`,
  };
  return guides[category] || 'Generate appropriate SEAG transfer test questions for this category.';
}

function buildGeneratePrompt({ category, year_group, batch_size, references, failReasons, passExamples }) {
  const isPunctuationOrSpelling = ['punctuation', 'spelling'].includes(category);

  const refSection = references.length
    ? `## REFERENCE QUESTIONS (real SEAG exam questions — match this style and difficulty)\n\n${
        references.map((r, i) =>
          `${i + 1}. [${difficultyLabel(r.difficulty || 'medium')}] ${r.question_text}\n   Answer: ${r.correct_answer}`
        ).join('\n\n')}`
    : '## REFERENCE QUESTIONS\nNo reference examples available for this category yet.';

  const failSection = failReasons.length
    ? `## PATTERNS TO AVOID (these question types failed validation — do not repeat)\n\n${
        failReasons.map((f, i) => `${i + 1}. ${f.v1_reason || f.v2_reason || f.v3_reason || 'Unclear or ambiguous question'}`).join('\n')}`
    : '';

  const passSection = passExamples.length
    ? `## HIGH-QUALITY EXAMPLES (these passed all three validators — aim for this standard)\n\n${
        passExamples.map((p, i) => `${i + 1}. ${p.question_text}`).join('\n\n')}`
    : '';

  const isWritten = category === 'comprehension_written';

  const optionsFormat = isWritten
    ? `- "question_type": "written"
- "options": null`
    : isPunctuationOrSpelling
    ? `- "question_type": "Multiple_Choice"
- "options": object with exactly these five keys, each mapping to a non-empty string:
  { "A": "segment text", "B": "segment text", "C": "segment text", "D": "segment text", "N": "No mistake" }
  IMPORTANT: Use N not E as the fifth key. "N" always has the value "No mistake".`
    : `- "question_type": "Multiple_Choice"
- "options": object with exactly these five keys, each mapping to a non-empty string:
  { "A": "option text", "B": "option text", "C": "option text", "D": "option text", "E": "option text" }
  Make wrong options (distractors) plausible but definitively incorrect.`;

  return `You are an expert creator of SEAG transfer test questions for Northern Ireland P6/P7 pupils (ages 10–11).

## TASK
Generate exactly ${batch_size} original questions for:
- Category: ${category}
- Year group: ${year_group}
- Use UK English spelling throughout (colour not color, organise not organize, etc.)

## CATEGORY GUIDANCE
${categoryGuidance(category)}

${isPunctuationOrSpelling ? `## PUNCTUATION/SPELLING FORMAT
Present the full sentence with the error embedded naturally.
DO NOT split into segments A/B/C/D in the question text.
The question text should be the complete sentence only.

Options format:
A: first segment of sentence
B: second segment
C: third segment (contains the error)
D: fourth segment
N: No mistake

CRITICAL: Options A, B, C, D must ALL be consecutive segments from the SAME sentence in question_text. Do NOT add unrelated sentences as option D. Every word in the question sentence must appear in exactly one of the A/B/C/D segments.

WRONG:
Question: The children went to the park they played games.
D: It was a sunny day. ❌ (unrelated sentence)

CORRECT:
Question: The children went to the park they played games.
A: The children went to the park
B: they played
C: games.
D: (unused - sentence only has 3 segments)
N: No mistake

Example question_text:
'Frank, did you clean your room,' asked Mum. Unsurprisingly, there was no reply.

Example options:
A: 'Frank, did you clean your room,'
B: asked Mum.
C: Unsurprisingly, there was
D: no reply.
N: No mistake

The correct answer is the letter of the segment containing the error, or N if no error exists.

` : ''}${year_group === 'P6' ? `## P6 DIFFICULTY GUIDANCE
P6 APPROPRIATE: Single-step calculations, times tables to 12x12, simple fractions (1/2, 1/4), basic shapes, telling time, money.
TOO HARD: Multi-step word problems, division with remainders over 100, percentages beyond 10/25/50%, complex fractions.

` : ''}${refSection}

${failSection}

${passSection}

## OUTPUT FORMAT
Return ONLY a valid JSON array with exactly ${batch_size} objects. No preamble, no markdown.

Each object must have:
- "question_text": full question text (string)
- "correct_answer": ${isWritten ? 'model answer (1–2 sentences)' : `correct option letter (${isPunctuationOrSpelling ? 'A/B/C/D/N' : 'A/B/C/D/E'})`}
- "explanation": why this answer is correct (1–2 sentences, UK English)
- "difficulty": integer 1–5 (1=very easy, 3=medium, 5=very hard) appropriate for ${year_group}${year_group === 'P6' ? ' — P6 questions should mostly be difficulty 1 or 2 (easy). Do not exceed 3.' : ' — P7 questions should be difficulty 2 or 3. Avoid difficulty 4–5 unless truly needed.'}
${optionsFormat}

Make each question original — do not copy reference examples verbatim. Vary difficulty across the batch. Ensure every question has one and only one definitively correct answer.`;
}

async function handleGenerateQuestions(req, res) {
  const { category, year_group, batch_size } = req.body;

  if (!category)   return res.status(400).json({ error: 'category is required' });
  if (!year_group) return res.status(400).json({ error: 'year_group is required' });
  if (!batch_size || batch_size < 1 || batch_size > 50)
    return res.status(400).json({ error: 'batch_size must be 1–50' });

  const apiKey      = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey)                    return res.status(500).json({ error: 'AI configuration error' });
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Database configuration error' });

  try {
    const refLimit = Math.min(15, Math.max(10, batch_size));

    const [refRows, failRows, passRows, existingRows] = await Promise.all([
      supabaseFetch(supabaseUrl, serviceKey,
        `reference_questions?select=question_text,correct_answer,difficulty&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&${year_group === 'P6' ? 'difficulty=lte.2' : 'difficulty=lte.3'}&limit=${refLimit}&order=extracted_at.desc`),
      supabaseFetch(supabaseUrl, serviceKey,
        `validation_results?select=v1_reason,v2_reason,v3_reason&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&outcome=eq.fail&order=created_at.desc&limit=20`),
      supabaseFetch(supabaseUrl, serviceKey,
        `validation_results?select=question_text,v1_score,v2_score,v3_score&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&outcome=eq.pass&order=v1_score.desc,v2_score.desc,v3_score.desc&limit=10`),
      supabaseFetch(supabaseUrl, serviceKey,
        `questions?select=question_text&topic=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&limit=5000`),
    ]);

    const existingFingerprints = new Set(existingRows.map(r => fingerprint(r.question_text)));
    console.log(`generate-questions: refs=${refRows.length} fails=${failRows.length} passes=${passRows.length} existing=${existingFingerprints.size}`);

    const prompt = buildGeneratePrompt({ category, year_group, batch_size, references: refRows, failReasons: failRows, passExamples: passRows });

    const aiResponse = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: HAIKU_MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) return res.status(500).json({ error: aiData.error?.message || 'AI API error' });

    const rawText = aiData.content?.[0]?.text || '';
    const parsed  = parseJsonArray(rawText);

    if (!parsed || !Array.isArray(parsed.items))
      return res.status(500).json({ error: 'Could not parse AI response', raw: rawText.slice(0, 2000) });

    const withUkCheck = parsed.items.map(q => {
      const warnings = [...ukEnglishWarnings(q.question_text || ''), ...ukEnglishWarnings(q.explanation || ''),
        ...Object.values(q.options || {}).flatMap(v => ukEnglishWarnings(v))];
      const unique = [...new Set(warnings)];
      return { ...q, category, year_group, source: 'ai_generated_v2', ...(unique.length ? { uk_english_warnings: unique } : {}) };
    });

    const unique = [];
    let skipped = 0;
    for (const q of withUkCheck) {
      const fp = fingerprint(q.question_text);
      if (existingFingerprints.has(fp)) { skipped++; }
      else { existingFingerprints.add(fp); unique.push(q); }
    }

    console.log(`generate-questions: ${unique.length} unique, ${skipped} duplicates skipped`);
    return res.status(200).json({ questions: unique, skipped_duplicates: skipped, total_generated: parsed.items.length, truncated: parsed.truncated });

  } catch (err) {
    console.error('generate-questions error:', err.message);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
}

// ══════════════════════════════════════════════════════
// HANDLER: get-question-counts
// ══════════════════════════════════════════════════════
async function handleGetQuestionCounts(req, res) {
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl)    return res.status(500).json({ error: 'NEXT_PUBLIC_SUPABASE_URL not configured' });
  if (!serviceRoleKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_question_counts`, {
      method: 'POST',
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(500).json({ error: `Supabase RPC error: ${response.status}`, detail: body });
    }

    const rows = await response.json();
    const counts = {};
    let total = 0;
    (rows || []).forEach(row => {
      const topic = (row.topic || '').toLowerCase();
      const yg    = row.year_group;
      if (!topic || (yg !== 'P6' && yg !== 'P7')) return;
      counts[`${topic}_${yg}`] = Number(row.count);
      total += Number(row.count);
    });

    console.log(`get-question-counts: ${total} validated questions`);
    return res.status(200).json({ counts, total });

  } catch (err) {
    console.error('get-question-counts error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════
// HANDLER: run-validators
// ══════════════════════════════════════════════════════
const PARSE_FALLBACK = { score: 5, reason: 'Could not parse validator response', verdict: 'warn' };

function parseValidatorResponse(rawText) {
  try { return JSON.parse(rawText); }
  catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
    console.warn('parseValidatorResponse fallback. Raw:', rawText.slice(0, 200));
    return PARSE_FALLBACK;
  }
}

function anthropicHeaders(apiKey) {
  return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
}

async function callValidator(systemPrompt, userMessage, apiKey) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: HAIKU_MODEL, max_tokens: 500, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Validator AI error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score), reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function handleRunValidators(req, res) {
  const { question_text, correct_answer, category, year_group, difficulty, options } = req.body;

  if (!question_text)  return res.status(400).json({ error: 'question_text is required' });
  if (!correct_answer) return res.status(400).json({ error: 'correct_answer is required' });
  if (!category)       return res.status(400).json({ error: 'category is required' });
  if (!year_group)     return res.status(400).json({ error: 'year_group is required' });
  if (!difficulty)     return res.status(400).json({ error: 'difficulty is required' });

  const apiKey         = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) return res.status(500).json({ error: 'AI configuration error' });

  const optionsBlock = options && typeof options === 'object' && Object.keys(options).length
    ? '\nAnswer options:\n' + Object.entries(options).map(([k, v]) => `  ${k}: ${v}`).join('\n')
    : '';

  const v1System = `You are an expert SEAG transfer test validator for Northern Ireland P6/P7 pupils (ages 10-11). Your job is to verify whether a question has a clear, unambiguous correct answer.

For maths questions: solve the problem yourself and verify the stated answer value is correct.
For English questions: verify the answer is correct according to grammar/spelling/punctuation rules.
For comprehension: verify the answer makes sense given the question.

IMPORTANT: The correct_answer field may be a letter (A/B/C/D/E/N) for multiple choice questions, or a text value for written questions.
- If it is a letter, solve the question yourself and give a high score (8-10) if the question has a clear correct answer, lower if ambiguous.
- If it is a text value, verify the text answer is correct.

IMPORTANT SCORING RULE: If the correct_answer is a letter (A/B/C/D/E/N) and you can verify the underlying calculation or rule is correct, give a score of 8-9. Only give a low score if the question itself is mathematically wrong or has no clear correct answer. Do not penalise for missing answer options — the letter is just a label, focus on whether the question has a definitive correct answer.

Return ONLY a JSON object:
{"score":<number 1-10>,"reason":"<brief explanation>","verdict":"<pass|warn|fail>"}`;

  const v1User = `Category: ${category}
Year group: ${year_group}
Question: ${question_text}${optionsBlock}
Stated correct answer: ${correct_answer}

Verify this question has a clear correct answer. Score 7+ = pass, 4-6 = warn, 1-3 = fail.
Note: if the answer is a letter, verify the question has a clear correct answer by solving it yourself. Score based on whether the maths/rule is correct, not on whether you can confirm the letter mapping.`;

  const v2System = `You are an expert SEAG transfer test validator for Northern Ireland P6/P7 pupils (ages 10-11). Your job is to verify whether the question difficulty is appropriate for the target year group.

P6 pupils are approximately 9-10 years old, early in their transfer test preparation.
P7 pupils are approximately 10-11 years old, in final exam preparation.

Consider: vocabulary level, mathematical complexity, reading demand, and whether the skill would be expected at that stage.

Return ONLY a JSON object in this exact format:
{"score":<number 1-10>,"reason":"<brief explanation>","verdict":"<pass|warn|fail>"}`;

  const v2User = `Category: ${category}
Year group: ${year_group}
Claimed difficulty: ${difficulty}
Question: ${question_text}${optionsBlock}
Correct answer: ${correct_answer}

Is this question appropriate for ${year_group}? Score 6+ = pass, 4-5 = warn, 1-3 = fail.`;

  const v3System = `You are an expert SEAG transfer test validator for Northern Ireland P6/P7 pupils (ages 10-11). Your job is to verify question quality.

Check:
1. Is the question clearly and unambiguously worded?
2. Are the wrong answer options (distractors) plausible but definitively incorrect?
3. Does it follow SEAG question style?
4. Is the question free from bias or culturally inappropriate content?

When answer options are provided, assess whether the distractors are well-chosen — they should be tempting but clearly wrong on reflection.

Return ONLY a JSON object in this exact format:
{"score":<number 1-10>,"reason":"<brief explanation>","verdict":"<pass|warn|fail>"}`;

  const v3User = `Category: ${category}
Year group: ${year_group}
Question: ${question_text}${optionsBlock}
Correct answer: ${correct_answer}

Rate the quality of this question. Score 7+ = pass, 4-6 = warn, 1-3 = fail.`;

  try {
    const [v1, v2, v3] = await Promise.all([
      callValidator(v1System, v1User, apiKey),
      callValidator(v2System, v2User, apiKey),
      callValidator(v3System, v3User, apiKey),
    ]);

    const scores = [v1.score, v2.score, v3.score];
    const combined_score = Math.round((scores.reduce((a, b) => a + b, 0) / 3) * 10) / 10;

    let outcome;
    if (scores.every(s => s >= 6))  outcome = 'pass';
    else if (scores.some(s => s < 5)) outcome = 'fail';
    else                              outcome = 'rewrite';

    console.log(`run-validators: ${outcome} (${scores.join(', ')}) — ${category} ${year_group}`);

    if (supabaseUrl && serviceRoleKey) {
      fetch(`${supabaseUrl}/rest/v1/validation_results`, {
        method: 'POST',
        headers: supabaseHeaders(serviceRoleKey, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ question_text, category, year_group, v1_score: v1.score, v1_reason: v1.reason, v2_score: v2.score, v2_reason: v2.reason, v3_score: v3.score, v3_reason: v3.reason, outcome, attempts: 1 }),
      }).catch(e => console.warn('run-validators: Supabase log failed:', e.message));
    }

    return res.status(200).json({ outcome, v1, v2, v3, combined_score });

  } catch (err) {
    console.error('run-validators error:', err.message);
    return res.status(500).json({ error: err.message || 'Validation failed' });
  }
}

// ══════════════════════════════════════════════════════
// HANDLER: save-generated
// ══════════════════════════════════════════════════════
const ENGLISH_TOPICS = new Set([
  'punctuation', 'grammar', 'spelling', 'vocabulary',
  'comprehension_mc', 'comprehension_written',
]);

function deriveSubject(category) {
  return ENGLISH_TOPICS.has(category) ? 'english' : 'maths';
}

function combineReasons(v1, v2, v3) {
  return [
    v1?.reason ? `Accuracy: ${v1.reason}`   : null,
    v2?.reason ? `Difficulty: ${v2.reason}` : null,
    v3?.reason ? `Quality: ${v3.reason}`    : null,
  ].filter(Boolean).join(' | ') || null;
}

async function handleSaveGenerated(req, res) {
  const { questions } = req.body;

  if (!questions || !Array.isArray(questions) || !questions.length)
    return res.status(400).json({ error: 'questions array is required and must not be empty' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) return res.status(500).json({ error: 'NEXT_PUBLIC_SUPABASE_URL not configured' });
  if (!serviceKey)  return res.status(500).json({ error: 'Supabase service key not configured' });

  const rows = questions.map(q => {
    const v1 = q.validation?.v1 || {};
    const v2 = q.validation?.v2 || {};
    const v3 = q.validation?.v3 || {};
    return {
      subject:           deriveSubject(q.category),
      topic:             q.category,
      year_group:        q.year_group,
      difficulty:        Number(q.difficulty) || 3,
      question_type:     q.question_type || 'Multiple_Choice',
      question_text:     q.question_text,
      options:           q.options || null,
      correct_answer:    q.correct_answer,
      explanation:       q.explanation || null,
      validated:         true,
      source:            'ai_generated_v2',
      validator_verdict: 'pass',
      validator_reason:  combineReasons(v1, v2, v3),
    };
  });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/questions`, {
      method: 'POST',
      headers: supabaseHeaders(serviceKey, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('save-generated: Supabase insert error:', response.status, errorBody.slice(0, 300));
      return res.status(500).json({ error: `Database error ${response.status}: ${errorBody.slice(0, 200)}` });
    }

    console.log(`save-generated: inserted ${rows.length} questions`);
    return res.status(200).json({ saved: rows.length });

  } catch (err) {
    console.error('save-generated error:', err.message);
    return res.status(500).json({ error: err.message || 'Save failed' });
  }
}

// ══════════════════════════════════════════════════════
// HANDLER: save-reference
// ══════════════════════════════════════════════════════
async function handleSaveReference(req, res) {
  const { questions, year_group, paper_source } = req.body;

  if (!questions || !Array.isArray(questions) || !questions.length)
    return res.status(400).json({ error: 'questions array is required and must not be empty' });
  if (!year_group)   return res.status(400).json({ error: 'year_group is required' });
  if (!paper_source) return res.status(400).json({ error: 'paper_source is required' });

  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl)    return res.status(500).json({ error: 'NEXT_PUBLIC_SUPABASE_URL not configured' });
  if (!serviceRoleKey) return res.status(500).json({ error: 'Supabase service key not configured' });

  const rows = questions.map(q => ({
    question_text:       q.question_text,
    correct_answer:      q.correct_answer,
    category:            q.category,
    difficulty:          q.difficulty || 'medium',
    year_group,
    paper_source,
    explanation:         q.explanation  || null,
    needs_diagram:       q.needs_diagram || false,
    diagram_description: q.diagram_description || null,
  }));

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/reference_questions`, {
      method: 'POST',
      headers: supabaseHeaders(serviceRoleKey, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('save-reference: Supabase insert error:', response.status, errorBody);
      return res.status(500).json({ error: `Database error: ${response.status}` });
    }

    console.log(`save-reference: saved ${rows.length} reference questions from ${paper_source}`);
    return res.status(200).json({ saved: rows.length });

  } catch (err) {
    console.error('save-reference error:', err.message);
    return res.status(500).json({ error: err.message || 'Save failed' });
  }
}

// ══════════════════════════════════════════════════════
// MAIN ROUTER
// ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.method === 'GET' ? req.query.action : req.body?.action;

  if (!action) return res.status(400).json({ error: 'action is required' });

  switch (action) {
    case 'extract-paper':       return handleExtractPaper(req, res);
    case 'generate-questions':  return handleGenerateQuestions(req, res);
    case 'get-question-counts': return handleGetQuestionCounts(req, res);
    case 'run-validators':      return handleRunValidators(req, res);
    case 'save-generated':      return handleSaveGenerated(req, res);
    case 'save-reference':      return handleSaveReference(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
