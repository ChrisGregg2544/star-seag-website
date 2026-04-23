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

Example 1 (comma missing in list):
question_text: "The children collected apples oranges and pears from the garden."
A: The children collected apples
B: oranges and pears
C: from the garden.
D: (unused)
N: No mistake
correct_answer: A  ← missing comma after 'apples'

Example 2 (no error):
question_text: "The dogs were playing happily in the park all afternoon."
A: The dogs
B: were playing happily
C: in the park all afternoon.
D: (unused)
N: No mistake
correct_answer: N

Example 3 (missing full stop):
question_text: "Please return your books to the library before Friday"
A: Please return your books
B: to the library
C: before Friday
D: (unused)
N: No mistake
correct_answer: B  ← missing full stop after 'library'

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

const TEMPLATE_CATEGORIES = new Set(['punctuation', 'spelling', 'grammar']);

async function validateGeneratedQuestion(q, apiKey) {
  const optionsBlock = q.options && typeof q.options === 'object' && Object.keys(q.options).length
    ? '\nAnswer options:\n' + Object.entries(q.options).map(([k, v]) => `  ${k}: ${v}`).join('\n')
    : '';

  const v1System = `You are an expert SEAG transfer test validator for Northern Ireland P6/P7 pupils (ages 10-11). Verify the question has a clear, unambiguous correct answer. Return ONLY a JSON object: {"score":<1-10>,"reason":"<brief explanation>","verdict":"<pass|warn|fail>"}`;
  const v1User = `Category: ${q.category}\nYear group: ${q.year_group}\nQuestion: ${q.question_text}${optionsBlock}\nStated correct answer: ${q.correct_answer}\n\nVerify this question has a clear correct answer. Score 7+ = pass, 4-6 = warn, 1-3 = fail.`;

  const [v1, v4] = await Promise.all([
    callValidator(v1System, v1User, apiKey),
    validateByCategory(q, apiKey),
  ]);

  // V4 (Sonnet specialist) is authoritative for English categories; V1 is informational only
  const v4_score = v4.score;
  const validator_verdict = v4_score >= 7 ? 'pass' : v4_score >= 5 ? 'rewrite' : 'fail';
  console.log('V4 score:', v4_score, 'Verdict:', validator_verdict);

  return { v1_score: v1.score, v1_reason: v1.reason, v4_score, v4_reason: v4.reason, validator_verdict };
}

function buildVariationPrompt(template, batch_size, year_group, category) {
  const categoryInstruction = category === 'grammar'
    ? `\nCRITICAL: Create GRAMMAR errors only - wrong verb tense, subject-verb disagreement, wrong word form. DO NOT create punctuation errors (missing commas, apostrophes) - those belong in the punctuation category.\n`
    : category === 'spelling'
    ? `\nCRITICAL: Ensure there is EXACTLY ONE clear, unambiguous spelling error. Use common P6/P7 misspellings: recieve/receive, seperate/separate, definately/definitely, freind/friend, beleive/believe, occured/occurred. DO NOT use compound words that could be spelled as one or two words (lunchtime/lunch time). If correct_answer is N, verify ALL words are spelled correctly.\n`
    : '';

  return `Create ${batch_size} variations of this template question.
Keep EXACT SAME error type and segment structure.
Only change vocabulary and context.
${categoryInstruction}
Template:
Question: ${template.question_text}
Options: ${JSON.stringify(template.options)}
Correct answer: ${template.correct_answer}

Each variation must:
- Have identical segment structure (A/B/C/D/N)
- Have error in same segment position
- Have same error type (missing comma/apostrophe/etc)
- Use different vocabulary and context
- Keep vocabulary and subject matter SIMPLE and appropriate for ${year_group} students (ages ${year_group === 'P6' ? '10-11' : '11-12'})
- Use topics familiar to children: school, home, friends, pets, hobbies, sports, food, family
- AVOID: academic subjects, scientific terminology, complex concepts, adult workplace scenarios
- The punctuation rule can be challenging, but the sentence content must be child-friendly

Return ONLY a valid JSON array of ${batch_size} objects. No preamble, no markdown.

Each object must have:
- "question_text": full sentence (string)
- "correct_answer": letter of segment containing the error (A/B/C/D/N)
- "explanation": why this answer is correct (1–2 sentences, UK English)
- "difficulty": integer 1–5
- "question_type": "Multiple_Choice"
- "options": object with exactly keys A, B, C, D, N where N is always "No mistake"`;
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

  if (!apiKey)                     return res.status(500).json({ error: 'AI configuration error' });
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Database configuration error' });

  try {
    const [existingRows] = await Promise.all([
      supabaseFetch(supabaseUrl, serviceKey,
        `questions?select=question_text&topic=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&limit=5000`),
    ]);

    const existingFingerprints = new Set(existingRows.map(r => fingerprint(r.question_text)));

    let allItems = [];

    if (TEMPLATE_CATEGORIES.has(category)) {
      // Template mode: fetch a pool of templates, then generate 1 variation per iteration
      const templateRows = await supabaseFetch(supabaseUrl, serviceKey,
        `reference_questions?select=question_text,correct_answer,options&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&options=not.is.null&limit=50`);

      if (!templateRows.length)
        return res.status(500).json({ error: `No segmented reference questions found for ${category} ${year_group}` });

      console.log(`generate-questions: template mode for ${category} ${year_group}, pool=${templateRows.length}, generating ${batch_size} variations`);

      for (let i = 0; i < batch_size; i++) {
        const template = templateRows[Math.floor(Math.random() * templateRows.length)];
        const prompt = buildVariationPrompt(template, 1, year_group, category);

        try {
          const aiResponse = await fetch(ANTHROPIC_URL, {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({ model: HAIKU_MODEL, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
          });
          const aiData = await aiResponse.json();
          if (!aiResponse.ok) { console.warn(`generate-questions: variation ${i + 1} AI error: ${aiData.error?.message}`); continue; }

          const rawText = aiData.content?.[0]?.text || '';
          const parsed  = parseJsonArray(rawText);
          if (!parsed?.items?.length) { console.warn(`generate-questions: variation ${i + 1} parse failed`); continue; }

          const generated = { ...parsed.items[0], category, year_group };
          // Inline validation disabled to avoid timeouts
          allItems.push(generated);
        } catch (e) {
          console.warn(`generate-questions: variation ${i + 1} error: ${e.message}`);
        }
      }

    } else {
      // Standard mode: generate from scratch using references, fail patterns, pass examples
      const refLimit = Math.min(15, Math.max(10, batch_size));
      const [refRows, failRows, passRows] = await Promise.all([
        supabaseFetch(supabaseUrl, serviceKey,
          `reference_questions?select=question_text,correct_answer,difficulty&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&${year_group === 'P6' ? 'difficulty=lte.2' : 'difficulty=lte.3'}&limit=${refLimit}&order=extracted_at.desc`),
        supabaseFetch(supabaseUrl, serviceKey,
          `validation_results?select=v1_reason,v2_reason,v3_reason&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&outcome=eq.fail&order=created_at.desc&limit=20`),
        supabaseFetch(supabaseUrl, serviceKey,
          `validation_results?select=question_text,v1_score,v2_score,v3_score&category=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&outcome=eq.pass&order=v1_score.desc,v2_score.desc,v3_score.desc&limit=10`),
      ]);
      console.log(`generate-questions: standard mode for ${category} ${year_group}, refs=${refRows.length} fails=${failRows.length} passes=${passRows.length} existing=${existingFingerprints.size}`);

      const prompt = buildGeneratePrompt({ category, year_group, batch_size, references: refRows, failReasons: failRows, passExamples: passRows });

      const aiResponse = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: HAIKU_MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
      });
      const aiData = await aiResponse.json();
      if (!aiResponse.ok) return res.status(500).json({ error: aiData.error?.message || 'AI API error' });

      const rawText = aiData.content?.[0]?.text || '';
      const parsed  = parseJsonArray(rawText);
      if (!parsed || !Array.isArray(parsed.items))
        return res.status(500).json({ error: 'Could not parse AI response', raw: rawText.slice(0, 2000) });

      allItems = parsed.items;
    }

    const withUkCheck = allItems.map(q => {
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
    return res.status(200).json({ questions: unique, skipped_duplicates: skipped, total_generated: allItems.length });

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

const SONNET_MODEL = 'claude-sonnet-4-6';
const SPECIALIST_CATEGORIES = new Set(['punctuation', 'spelling', 'grammar']);

async function callValidator(systemPrompt, userMessage, apiKey, model = HAIKU_MODEL) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model, max_tokens: 500, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Validator AI error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score) || 0, reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function validatePunctuation(question_text, correct_answer, category, year_group, optionsBlock, apiKey) {
  const system = `You are a specialist SEAG punctuation validator for Northern Ireland P6/P7 pupils (ages 10-11).

FOCUS: Binary punctuation checks only.
- Comma: present or missing?
- Full stop: present or missing?
- Apostrophe: correct position or wrong/missing?
- Quotation marks: opening/closing matched?
- Colon/semicolon: used correctly?

Return ONLY a JSON object:
{"score":<number 1-10>,"reason":"<specific explanation>","verdict":"<pass|warn|fail>"}`;

  const user = `Category: ${category}
Year group: ${year_group}
Question: ${question_text}${optionsBlock}
Stated correct answer: ${correct_answer}

BINARY CHECKS:
1. Is there EXACTLY ONE punctuation error in segment ${correct_answer}?
2. Is it a clear missing/wrong punctuation mark (not stylistic preference)?
3. Are ALL other segments completely error-free?
4. If correct_answer is N, is the sentence genuinely error-free?

Score 7+ = pass, 5-6 = warn, 1-4 = fail.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 500, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Punctuation validator error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score) || 0, reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function validateSpelling(question_text, correct_answer, category, year_group, optionsBlock, apiKey) {
  const system = `You are a specialist SEAG spelling validator for Northern Ireland P6/P7 pupils (ages 10-11).

FOCUS: UK spelling correctness.
- Is the word spelled according to UK English dictionary?
- Common P6/P7 spelling errors (double letters, ie/ei, silent letters)
- NOT American spellings (color, realize, etc.)

Return ONLY a JSON object:
{"score":<number 1-10>,"reason":"<specific explanation>","verdict":"<pass|warn|fail>"}`;

  const user = `Category: ${category}
Year group: ${year_group}
Question: ${question_text}${optionsBlock}
Stated correct answer: ${correct_answer}

SPELLING CHECKS:
1. Is there EXACTLY ONE misspelled word in segment ${correct_answer}?
2. Is it a genuine spelling error (not a valid variant or regional spelling)?
3. Are ALL other segments spelled correctly?
4. If correct_answer is N, are all words spelled correctly?

Common P6/P7 spelling errors to check:
- receive/recieve, separate/seperate, necessary/neccessary
- Double consonants: occurred, beginning, committed
- Silent letters: knight, psychology, doubt

Score 7+ = pass, 5-6 = warn, 1-4 = fail.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 500, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Spelling validator error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score) || 0, reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function validateGrammar(question_text, correct_answer, category, year_group, optionsBlock, apiKey) {
  const system = `You are a specialist SEAG grammar validator for Northern Ireland P6/P7 pupils (ages 10-11).

FOCUS: Clear, unambiguous grammatical errors only.
- Subject-verb agreement: "The children was" → "were"
- Verb tense: "Yesterday I walk" → "walked"
- Pronoun agreement: clear errors only

IGNORE dialectical/informal variations that are widely used in speech.
ONLY flag errors that would be marked wrong in formal written English exams.

Return ONLY a JSON object:
{"score":<number 1-10>,"reason":"<specific explanation>","verdict":"<pass|warn|fail>"}`;

  const user = `Category: ${category}
Year group: ${year_group}
Question: ${question_text}${optionsBlock}
Stated correct answer: ${correct_answer}

GRAMMAR CHECKS (lenient on dialectical variations):
1. Is there ONE clear grammatical error in segment ${correct_answer}?
2. Would this error be marked wrong in a formal written exam?
3. Are ALL other segments grammatically correct?
4. If correct_answer is N, is the sentence grammatically correct?

CLEAR ERRORS (always fail):
- Subject-verb disagreement: "The children was playing"
- Wrong tense: "Yesterday I go to school"
- Pronoun case: "Me and Sarah went shopping"

DIALECTICAL (be lenient, score 6-7 not 9-10):
- Preposition variation: "different to/from"
- Since/for duration: "since three months" (informal but used)
- Informal contractions in speech

Score 6+ = pass, 4-5 = warn, 1-3 = fail.
Note: Lower threshold (6 not 7) because grammar is inherently more subjective.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 500, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Grammar validator error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score) || 0, reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function validateArithmetic(question_text, correct_answer, options, year_group, apiKey) {
  const optionsBlock = options && typeof options === 'object' && Object.keys(options).length
    ? '\nAnswer options:\n' + Object.entries(options).map(([k, v]) => `  ${k}: ${v}`).join('\n')
    : '';

  const system = `You are a specialist SEAG arithmetic validator for Northern Ireland P6/P7 pupils (ages 10-11).

FOCUS: Mathematical correctness.
- Does the calculation yield the stated answer?
- Are the numbers appropriate for the year group?
- Is there exactly one correct answer?

Return ONLY a JSON object:
{"score":<number 1-10>,"reason":"<specific explanation>","verdict":"<pass|warn|fail>"}`;

  const user = `Year group: ${year_group}
Question: ${question_text}${optionsBlock}
Stated correct answer: ${correct_answer}

ARITHMETIC CHECKS:
1. Solve the problem yourself - does it equal the stated answer?
2. Are the numbers age-appropriate for ${year_group}?
   - P6: Single/double digit operations, times tables to 12×12, simple fractions
   - P7: More complex multi-digit, division with remainders, percentages
3. Are wrong options (distractors) plausible but definitively incorrect?
4. Is there exactly one correct answer?

Score 8+ = pass, 6-7 = warn, 1-5 = fail.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 600, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Arithmetic validator error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score) || 0, reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function validateGeometry(question_text, correct_answer, options, year_group, apiKey) {
  const optionsBlock = options && typeof options === 'object' && Object.keys(options).length
    ? '\nAnswer options:\n' + Object.entries(options).map(([k, v]) => `  ${k}: ${v}`).join('\n')
    : '';

  const system = `You are a specialist SEAG geometry validator for Northern Ireland P6/P7 pupils (ages 10-11).

FOCUS: Geometric accuracy and diagram clarity.
- Are shape properties correct (angles, sides, area, perimeter)?
- Do measurements make logical sense?
- Would a P6/P7 pupil understand the diagram description?

Return ONLY a JSON object:
{"score":<number 1-10>,"reason":"<specific explanation>","verdict":"<pass|warn|fail>"}`;

  const user = `Year group: ${year_group}
Question: ${question_text}${optionsBlock}
Stated correct answer: ${correct_answer}

GEOMETRY CHECKS:
1. Verify the geometric calculation - is the stated answer correct?
2. Check shape properties (angles add to 180°/360°, parallel sides, etc.)
3. Are measurements realistic and age-appropriate?
4. If needs_diagram, is the description clear enough for a P6/P7 student?
5. Is there exactly one correct answer?

Age-appropriate for ${year_group}:
- P6: Basic shapes (triangle, rectangle, circle), perimeter, simple area
- P7: More complex shapes, composite shapes, volume of cuboids

Score 8+ = pass, 6-7 = warn, 1-5 = fail.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 600, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Geometry validator error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score) || 0, reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function validateComprehension(question_text, correct_answer, passage, year_group, apiKey) {
  const system = `You are a specialist SEAG comprehension validator for Northern Ireland P6/P7 pupils (ages 10-11).

FOCUS: Answer derivability from passage.
- Can the answer be found/inferred from the passage?
- Is it unambiguous?
- Does it test comprehension (not general knowledge)?

Return ONLY a JSON object:
{"score":<number 1-10>,"reason":"<specific explanation>","verdict":"<pass|warn|fail>"}`;

  const user = `Year group: ${year_group}
Passage: ${passage}

Question: ${question_text}
Stated correct answer: ${correct_answer}

COMPREHENSION CHECKS:
1. Can the answer be found or reasonably inferred from the passage?
2. Is there exactly one defensible answer based on the text?
3. Does the question test reading comprehension (not external knowledge)?
4. Is the question clear and unambiguous for a ${year_group} student?
5. Is the passage age-appropriate (vocabulary, length, complexity)?

Score 8+ = pass, 6-7 = warn, 1-5 = fail.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 600, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Comprehension validator error');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score) || 0, reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function validateByCategory(question, apiKey) {
  const { question_text, correct_answer, category, year_group, options, passage } = question;

  const optionsBlock = options && typeof options === 'object' && Object.keys(options).length
    ? '\nAnswer options:\n' + Object.entries(options).map(([k, v]) => `  ${k}: ${v}`).join('\n')
    : '';

  switch (category) {
    case 'punctuation':
      return await validatePunctuation(question_text, correct_answer, category, year_group, optionsBlock, apiKey);
    case 'spelling':
      return await validateSpelling(question_text, correct_answer, category, year_group, optionsBlock, apiKey);
    case 'grammar':
      return await validateGrammar(question_text, correct_answer, category, year_group, optionsBlock, apiKey);
    case 'arithmetic':
      return await validateArithmetic(question_text, correct_answer, options, year_group, apiKey);
    case 'geometry':
      return await validateGeometry(question_text, correct_answer, options, year_group, apiKey);
    case 'comprehension_mc':
    case 'comprehension_written':
      return await validateComprehension(question_text, correct_answer, passage, year_group, apiKey);
    default:
      return await validatePunctuation(question_text, correct_answer, category, year_group, optionsBlock, apiKey);
  }
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
    let v1, v2, v3, v4, scores, outcome, combined_score;

    if (SPECIALIST_CATEGORIES.has(category)) {
      // Punctuation/spelling/grammar: V1 (Haiku) + V4 Specialist (Sonnet)
      let v4Result;
      [v1, v4Result] = await Promise.all([
        callValidator(v1System, v1User, apiKey),
        validateByCategory({ question_text, correct_answer, category, year_group, options, passage: req.body.passage }, apiKey),
      ]);
      console.log('V4 result:', v4Result);
      if (!v4Result || typeof v4Result.score === 'undefined') {
        console.error('V4 validator returned invalid result:', v4Result);
        return res.status(500).json({ error: 'Specialist validator returned invalid result', v4Result });
      }
      v4 = v4Result;
      scores = [v1.score, v4.score];
      combined_score = Math.round((scores.reduce((a, b) => a + b, 0) / 2) * 10) / 10;
      // V4 is authoritative for specialist categories
      outcome = v4.score >= 7 ? 'pass' : v4.score >= 5 ? 'rewrite' : 'fail';
      console.log(`run-validators: ${outcome} (v1=${v1.score}, v4=${v4.score}) — ${category} ${year_group}`);

      if (supabaseUrl && serviceRoleKey) {
        fetch(`${supabaseUrl}/rest/v1/validation_results`, {
          method: 'POST',
          headers: supabaseHeaders(serviceRoleKey, { 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ question_text, category, year_group, v1_score: v1.score, v1_reason: v1.reason, v2_score: v4.score, v2_reason: v4.reason, outcome, attempts: 1 }),
        }).catch(e => console.warn('run-validators: Supabase log failed:', e.message));
      }

      return res.status(200).json({ outcome, v1, v4, combined_score });

    } else {
      // All other categories: V1 + V2 + V3 (all Haiku)
      [v1, v2, v3] = await Promise.all([
        callValidator(v1System, v1User, apiKey),
        callValidator(v2System, v2User, apiKey),
        callValidator(v3System, v3User, apiKey),
      ]);
      scores = [v1.score, v2.score, v3.score];
      combined_score = Math.round((scores.reduce((a, b) => a + b, 0) / 3) * 10) / 10;
      outcome = scores.every(s => s >= 6) ? 'pass' : scores.some(s => s < 5) ? 'fail' : 'rewrite';
      console.log(`run-validators: ${outcome} (${scores.join(', ')}) — ${category} ${year_group}`);

      if (supabaseUrl && serviceRoleKey) {
        fetch(`${supabaseUrl}/rest/v1/validation_results`, {
          method: 'POST',
          headers: supabaseHeaders(serviceRoleKey, { 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ question_text, category, year_group, v1_score: v1.score, v1_reason: v1.reason, v2_score: v2.score, v2_reason: v2.reason, v3_score: v3.score, v3_reason: v3.reason, outcome, attempts: 1 }),
        }).catch(e => console.warn('run-validators: Supabase log failed:', e.message));
      }

      return res.status(200).json({ outcome, v1, v2, v3, combined_score });
    }

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

function combineReasons(q) {
  const v1reason = q.v1_reason || q.validation?.v1?.reason;
  const v4reason = q.v4_reason || q.validation?.v4?.reason;
  const v2reason = q.validation?.v2?.reason;
  const v3reason = q.validation?.v3?.reason;
  return [
    v1reason ? `Accuracy: ${v1reason}`    : null,
    v4reason ? `Specialist: ${v4reason}`  : null,
    v2reason ? `Difficulty: ${v2reason}`  : null,
    v3reason ? `Quality: ${v3reason}`     : null,
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

  const questionRows = questions.map(q => ({
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
    validator_verdict: q.validator_verdict || q.validation?.outcome || 'pass',
    validator_reason:  combineReasons(q),
  }));

  // Build validation_results rows — v4 mapped to v2 slot (table has no v4 columns)
  const validationRows = questions
    .filter(q => q.v1_score != null || q.v4_score != null || q.validation?.v1)
    .map(q => ({
      question_text: q.question_text,
      category:      q.category,
      year_group:    q.year_group,
      v1_score:      q.v1_score ?? q.validation?.v1?.score ?? null,
      v1_reason:     q.v1_reason ?? q.validation?.v1?.reason ?? null,
      v2_score:      q.v4_score ?? q.validation?.v2?.score ?? null,
      v2_reason:     q.v4_reason ?? q.validation?.v2?.reason ?? null,
      v3_score:      q.validation?.v3?.score ?? null,
      v3_reason:     q.validation?.v3?.reason ?? null,
      outcome:       q.validator_verdict || q.validation?.outcome || 'pass',
      attempts:      1,
    }));

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/questions`, {
      method: 'POST',
      headers: supabaseHeaders(serviceKey, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(questionRows),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('save-generated: Supabase insert error:', response.status, errorBody.slice(0, 300));
      return res.status(500).json({ error: `Database error ${response.status}: ${errorBody.slice(0, 200)}` });
    }

    // Save validation results (fire-and-forget)
    if (validationRows.length) {
      fetch(`${supabaseUrl}/rest/v1/validation_results`, {
        method: 'POST',
        headers: supabaseHeaders(serviceKey, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify(validationRows),
      }).catch(e => console.warn('save-generated: validation_results insert failed:', e.message));
    }

    console.log(`save-generated: inserted ${questionRows.length} questions, ${validationRows.length} validation results`);
    return res.status(200).json({ saved: questionRows.length });

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
// HANDLER: save-comprehension-set
// ══════════════════════════════════════════════════════
async function handleSaveComprehensionSet(req, res) {
  const { passage, title, topic, word_count, selected_questions, year_group } = req.body;

  if (!passage)            return res.status(400).json({ error: 'passage is required' });
  if (!year_group)         return res.status(400).json({ error: 'year_group is required' });
  if (!selected_questions || !Array.isArray(selected_questions) || !selected_questions.length)
    return res.status(400).json({ error: 'selected_questions array is required' });

  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl)    return res.status(500).json({ error: 'NEXT_PUBLIC_SUPABASE_URL not configured' });
  if (!serviceRoleKey) return res.status(500).json({ error: 'Supabase service key not configured' });

  try {
    // Step 1: Insert passage into comprehension_passages, return id
    const passageRes = await fetch(`${supabaseUrl}/rest/v1/comprehension_passages`, {
      method:  'POST',
      headers: supabaseHeaders(serviceRoleKey, { 'Prefer': 'return=representation' }),
      body:    JSON.stringify({
        title:      title      || 'Untitled Passage',
        passage,
        word_count: word_count || null,
        year_group,
        topic:      topic      || null,
      }),
    });

    if (!passageRes.ok) {
      const err = await passageRes.text();
      console.error('save-comprehension-set: passage insert failed:', passageRes.status, err);
      return res.status(500).json({ error: `Failed to save passage: ${passageRes.status}` });
    }

    const passageRows = await passageRes.json();
    const passage_id  = passageRows?.[0]?.id;

    if (!passage_id) {
      return res.status(500).json({ error: 'Passage inserted but no id returned' });
    }

    console.log(`save-comprehension-set: passage saved with id ${passage_id}`);

    // Step 2: Insert all selected questions in parallel
    const difficultyMap = { 1: 'easy', 2: 'medium', 3: 'hard', 4: 'hard', 5: 'hard' };

    await Promise.all(selected_questions.map(q => {
      const mappedDifficulty = difficultyMap[q.difficulty] || 'medium';
      return fetch(`${supabaseUrl}/rest/v1/reference_questions`, {
        method:  'POST',
        headers: supabaseHeaders(serviceRoleKey, { 'Prefer': 'return=minimal' }),
        body:    JSON.stringify({
          passage_id,
          question_text:  q.question_text,
          correct_answer: q.correct_answer,
          explanation:    q.explanation    || null,
          category:       q.category,
          year_group,
          difficulty:     mappedDifficulty,
          options:        q.options        || null,
          paper_source:   'ai_generated_comprehension',
          needs_diagram:  false,
        }),
      }).then(async r => {
        if (!r.ok) {
          const body = await r.text();
          throw new Error(`Question insert failed (${r.status}): ${body.slice(0, 100)}`);
        }
      });
    }));

    console.log(`save-comprehension-set: saved ${selected_questions.length} questions for passage ${passage_id}`);
    return res.status(200).json({
      success:        true,
      passage_id,
      questions_saved: selected_questions.length,
    });

  } catch (err) {
    console.error('save-comprehension-set error:', err.message);
    return res.status(500).json({ error: err.message || 'Save failed' });
  }
}

// ══════════════════════════════════════════════════════
// COMPREHENSION QUESTION GENERATION
// ══════════════════════════════════════════════════════

const QUESTION_TYPES = {
  mc: [
    { type: 'literal',    instruction: 'Ask a literal retrieval question — the answer is stated directly in the passage.' },
    { type: 'inference',  instruction: 'Ask an inference question — the answer requires reading between the lines.' },
    { type: 'vocabulary', instruction: 'Ask about the meaning of a specific word or phrase as used in the passage.' },
    { type: 'structure',  instruction: 'Ask about how the passage is structured or why the writer made a particular choice.' },
    { type: 'literal',    instruction: 'Ask a second literal retrieval question about a different part of the passage.' },
    { type: 'inference',  instruction: 'Ask a second inference question requiring a different deduction.' },
    { type: 'vocabulary', instruction: 'Ask about a second word or phrase from the passage.' },
    { type: 'literal',    instruction: 'Ask a third literal retrieval question about a different detail in the passage.' },
    { type: 'inference',  instruction: 'Ask a third inference question requiring a further deduction from the text.' },
  ],
  written: [
    { type: 'explain',  instruction: 'Ask the pupil to explain in their own words why something happened or what something means.' },
    { type: 'evidence', instruction: 'Ask the pupil to find and copy a phrase or sentence from the passage that shows something.' },
    { type: 'opinion',  instruction: 'Ask the pupil for their opinion with evidence from the text.' },
    { type: 'summary',  instruction: 'Ask the pupil to summarise a section of the passage in their own words.' },
    { type: 'language', instruction: 'Ask the pupil to identify and comment on a language technique used in the passage.' },
    { type: 'explain',  instruction: 'Ask a second explanation question about a different aspect of the passage.' },
    { type: 'evidence', instruction: 'Ask the pupil to find and copy a second phrase or sentence that shows something different.' },
    { type: 'opinion',  instruction: 'Ask a second opinion question about a different part of the passage, with text evidence.' },
  ],
};

async function generateQuestionsForPassage(passage, title, year_group, apiKey) {
  const mcPrompt = `You are an expert SEAG comprehension question writer for Northern Ireland P6/P7 pupils (ages 10-11).

Passage title: ${title}
Passage: ${passage}
Year group: ${year_group}

Write exactly 9 multiple-choice questions about this passage.
Question types to include (one per question, in this order):
${QUESTION_TYPES.mc.map((t, i) => `${i + 1}. ${t.type.toUpperCase()}: ${t.instruction}`).join('\n')}

Rules:
- Each question must have exactly 5 options: A, B, C, D, E
- Only one option is correct; others are plausible distractors
- Correct answers should be spread across A/B/C/D/E (not all the same letter)
- Questions must be answerable from the passage only (no outside knowledge)
- Use UK English throughout
- Keep language accessible for ${year_group} (age ${year_group === 'P6' ? '10-11' : '11-12'})

Return ONLY a valid JSON array of 9 objects. Each object:
{
  "question_text": "the question",
  "options": {"A":"...","B":"...","C":"...","D":"...","E":"..."},
  "correct_answer": "A|B|C|D|E",
  "explanation": "why this answer is correct (1-2 sentences)",
  "question_type": "Multiple_Choice",
  "category": "comprehension_mc",
  "difficulty": 1-5
}`;

  const writtenPrompt = `You are an expert SEAG comprehension question writer for Northern Ireland P6/P7 pupils (ages 10-11).

Passage title: ${title}
Passage: ${passage}
Year group: ${year_group}

Write exactly 8 short-answer (written) questions about this passage.
Question types to include (one per question, in this order):
${QUESTION_TYPES.written.map((t, i) => `${i + 1}. ${t.type.toUpperCase()}: ${t.instruction}`).join('\n')}

Rules:
- Each answer should be 1-3 sentences
- Answers must be derivable from the passage
- Use UK English throughout
- Keep language accessible for ${year_group} (age ${year_group === 'P6' ? '10-11' : '11-12'})
- correct_answer should be a model answer

CRITICAL RULES FOR MODEL ANSWERS:
- Use ONLY facts explicitly stated in the passage
- Do NOT add inferences or details not in the text
- Avoid technical grammar terminology (adverbs, adjectives, metaphor) unless absolutely necessary
- Keep answers simple: what a P6/P7 pupil who read carefully could write
- If asking about writer's technique, use simple terms: "descriptive words", "action words", "word choice"

Example BAD model answer: "The park was large so the dog could have gone far" (adds "large" not in text)
Example GOOD model answer: "Biscuit had slipped his lead while chasing a squirrel" (only text facts)

Example BAD model answer: "The writer uses adverbs like 'breathless' and 'desperately'" (wrong - breathless is adjective)
Example GOOD model answer: "The writer uses descriptive words like 'breathless' and 'desperately' to show worry"

Return ONLY a valid JSON array of 8 objects. Each object:
{
  "question_text": "the question",
  "options": null,
  "correct_answer": "model answer text",
  "explanation": "what a good answer should include",
  "question_type": "written",
  "category": "comprehension_written",
  "difficulty": 1-5
}`;

  const [mcRes, writtenRes] = await Promise.all([
    fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: anthropicHeaders(apiKey),
      body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 3000, messages: [{ role: 'user', content: mcPrompt }] }),
    }),
    fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: anthropicHeaders(apiKey),
      body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 2000, messages: [{ role: 'user', content: writtenPrompt }] }),
    }),
  ]);

  const [mcData, writtenData] = await Promise.all([mcRes.json(), writtenRes.json()]);
  if (!mcRes.ok)      throw new Error(mcData.error?.message      || 'MC question generation failed');
  if (!writtenRes.ok) throw new Error(writtenData.error?.message  || 'Written question generation failed');

  const parseJsonArray = (text) => {
    const clean = (text || '').replace(/^```json\s*/i, '').replace(/```[\s\S]*$/, '').trim();
    try { return JSON.parse(clean); } catch { /* fall through */ }
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
    throw new Error(`Could not parse JSON array: ${clean.slice(0, 200)}`);
  };

  const mcQuestions      = parseJsonArray(mcData.content?.[0]?.text      || '');
  const writtenQuestions = parseJsonArray(writtenData.content?.[0]?.text  || '');

  return [...mcQuestions, ...writtenQuestions].map(q => ({ ...q, year_group, passage }));
}

async function validateComprehensionQuestion(question, passage, apiKey) {
  const { question_text, correct_answer, options, question_type, year_group } = question;

  const optionsBlock = options && typeof options === 'object'
    ? '\nOptions:\n' + Object.entries(options).map(([k, v]) => `  ${k}: ${v}`).join('\n')
    : '';

  const system = `You are a specialist SEAG comprehension question validator for Northern Ireland P6/P7 pupils (ages 10-11).
Return ONLY a JSON object: {"score":<1-10>,"reason":"<explanation>","verdict":"<pass|warn|fail>"}`;

  const user = `Passage: ${passage}

Question: ${question_text}${optionsBlock}
Correct answer: ${correct_answer}
Type: ${question_type}
Year group: ${year_group}

Check:
1. Is the answer clearly derivable from the passage?
2. Is there exactly one correct/best answer?
3. Is the question unambiguous for a ${year_group} pupil?
4. For MC: are distractors plausible but definitely wrong?
5. For written: is the model answer a fair expectation?

Score 8+ = pass, 6-7 = warn, 1-5 = fail.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 400, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Question validation failed');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score) || 0, reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function validateQuestionSet(questions, passage, apiKey) {
  const validations = await Promise.all(
    questions.map(q => validateComprehensionQuestion(q, passage, apiKey))
  );

  const results = questions.map((q, i) => ({ ...q, validation: validations[i] }));

  const passed  = results.filter(q => q.validation.verdict === 'pass').length;
  const warned  = results.filter(q => q.validation.verdict === 'warn').length;
  const failed  = results.filter(q => q.validation.verdict === 'fail').length;
  const avgScore = Math.round(
    (validations.reduce((sum, v) => sum + v.score, 0) / validations.length) * 10
  ) / 10;

  return {
    questions: results,
    summary: { total: results.length, passed, warned, failed, avg_score: avgScore },
  };
}

async function handleGenerateComprehensionQuestions(req, res) {
  const { passage, title, year_group } = req.body;

  if (!passage)    return res.status(400).json({ error: 'passage is required' });
  if (!year_group) return res.status(400).json({ error: 'year_group is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI configuration error' });

  try {
    const passageTitle = title || 'Untitled Passage';
    const questions    = await generateQuestionsForPassage(passage, passageTitle, year_group, apiKey);
    const result       = await validateQuestionSet(questions, passage, apiKey);

    // Sort by score descending, then select best passing MC (7) and Written (6) separately
    const byScore = (a, b) => (b.validation.score ?? 0) - (a.validation.score ?? 0);

    const passingMC      = result.questions.filter(q => q.question_type === 'Multiple_Choice' && q.validation.verdict === 'pass' && (q.validation.score ?? 0) >= 8).sort(byScore);
    const passingWritten = result.questions.filter(q => q.question_type === 'written'          && q.validation.verdict === 'pass' && (q.validation.score ?? 0) >= 7).sort(byScore);

    const selectedMC      = passingMC.slice(0, 7);
    const selectedWritten = passingWritten.slice(0, 6);
    const selected        = [...selectedMC, ...selectedWritten];

    const mcPassed      = result.questions.filter(q => q.question_type === 'Multiple_Choice').filter(q => q.validation.verdict === 'pass').length;
    const writtenPassed = result.questions.filter(q => q.question_type === 'written').filter(q => q.validation.verdict === 'pass').length;

    return res.status(200).json({
      questions: result.questions,
      selected,
      summary: {
        total:            result.questions.length,
        passed:           result.summary.passed,
        warned:           result.summary.warned,
        failed:           result.summary.failed,
        avg_score:        result.summary.avg_score,
        mc_passed:        mcPassed,
        written_passed:   writtenPassed,
        mc_selected:      selectedMC.length,
        written_selected: selectedWritten.length,
        selected:         selected.length,
        is_complete:      selectedMC.length >= 7 && selectedWritten.length >= 6,
      },
    });
  } catch (err) {
    console.error('generate-comprehension-questions error:', err.message);
    return res.status(500).json({ error: err.message || 'Comprehension question generation failed' });
  }
}

// ══════════════════════════════════════════════════════
// PASSAGE GENERATION
// ══════════════════════════════════════════════════════

const PASSAGE_TOPICS = {
  P6: [
    'A school trip to a local museum',
    'Learning to ride a bicycle',
    'A rainy day at the seaside',
    'The class science fair project',
    'Making a new friend at school',
    'A surprise birthday party',
    'Looking after a pet for the first time',
    'A camping trip with the family',
    'The school sports day',
    'Finding a lost dog in the park',
  ],
  P7: [
    'A conservation project to save local wildlife',
    'The history of a famous Northern Ireland landmark',
    'An inventor who changed everyday life',
    'A young athlete training for a competition',
    'How the local community came together after a flood',
    'A journey on the first steam railway',
    'A marine biologist studying ocean creatures',
    'The life of a lighthouse keeper',
    'How newspapers were made before the internet',
    'A record-breaking explorer preparing for an expedition',
  ],
};

async function generatePassage(year_group, topic, apiKey) {
  const topics = PASSAGE_TOPICS[year_group] || PASSAGE_TOPICS.P6;
  const chosenTopic = topic || topics[Math.floor(Math.random() * topics.length)];

  const system = `You are an expert writer of reading comprehension passages for Northern Ireland SEAG Transfer Test (P6/P7, ages 10-11).

Write engaging, age-appropriate passages that:
- Are 180-220 words long
- Use clear, accessible language appropriate for the year group
- Have a clear narrative or informational structure
- Contain rich detail that supports comprehension questions
- Use UK English spelling throughout

Return ONLY a JSON object:
{"title":"<passage title>","passage":"<full passage text>","word_count":<integer>}`;

  const user = `Year group: ${year_group}
Topic: ${chosenTopic}

Write a reading comprehension passage on this topic suitable for a ${year_group} pupil (age ${year_group === 'P6' ? '10-11' : '11-12'}).
The passage should be 180-220 words. Return ONLY the JSON object.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 800, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Passage generation failed');

  const raw = (data.content?.[0]?.text || '').replace(/^```json\s*/i, '').replace(/```[\s\S]*$/, '').trim();

  try { return { ...JSON.parse(raw), topic: chosenTopic }; } catch { /* fall through */ }
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) { try { return { ...JSON.parse(match[0]), topic: chosenTopic }; } catch { /* fall through */ } }
  throw new Error(`Could not parse passage JSON: ${raw.slice(0, 200)}`);
}

async function validatePassage(passageData, year_group, apiKey) {
  const { title, passage } = passageData;

  const system = `You are a specialist SEAG comprehension passage validator for Northern Ireland P6/P7 pupils (ages 10-11).

Evaluate the passage on:
- Age-appropriate vocabulary and sentence complexity
- Sufficient detail to support 7 MC + 6 written comprehension questions
- Clear structure (beginning, middle, end or logical flow)
- Engagement and interest level for the year group
- UK English spelling and grammar
- Word count in range 180-220

Return ONLY a JSON object:
{"score":<number 1-10>,"reason":"<specific explanation>","verdict":"<pass|warn|fail>"}`;

  const user = `Year group: ${year_group}
Title: ${title}
Passage: ${passage}

Score 8+ = pass (ready for question generation), 6-7 = warn (usable but could be improved), 1-5 = fail (regenerate).`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({ model: SONNET_MODEL, max_tokens: 500, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Passage validation failed');
  const result = parseValidatorResponse(data.content?.[0]?.text || '');
  return { score: Number(result.score) || 0, reason: result.reason || '', verdict: result.verdict || 'warn' };
}

async function handleGeneratePassage(req, res) {
  const { year_group, topic } = req.body;

  if (!year_group) return res.status(400).json({ error: 'year_group is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI configuration error' });

  try {
    const passageData  = await generatePassage(year_group, topic || null, apiKey);
    const validation   = await validatePassage(passageData, year_group, apiKey);
    return res.status(200).json({ ...passageData, validation });
  } catch (err) {
    console.error('generate-passage error:', err.message);
    return res.status(500).json({ error: err.message || 'Passage generation failed' });
  }
}

// ══════════════════════════════════════════════════════
// ARITHMETIC QUESTION GENERATION (programmatic, no AI)
// ══════════════════════════════════════════════════════

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDistractors(answer) {
  const candidates = [
    answer + 1, answer - 1,
    answer + 10, answer - 10,
    answer + 11, answer - 11,
    answer + 9,  answer - 9,
    answer + 2,  answer - 2,
    answer + 100, answer - 100,
    Math.round(answer * 1.1),
    Math.round(answer * 0.9),
  ].filter(v => v > 0 && v !== answer);

  shuffle(candidates);
  const seen = new Set([answer]);
  const result = [];
  for (const c of candidates) {
    if (!seen.has(c)) { seen.add(c); result.push(c); }
    if (result.length === 4) break;
  }
  // Fallback if not enough candidates
  let filler = answer + 3;
  while (result.length < 4) {
    if (!seen.has(filler)) { seen.add(filler); result.push(filler); }
    filler++;
  }
  return result;
}

function buildOptions(answer) {
  const distractors = buildDistractors(answer);
  const all = shuffle([answer, ...distractors]);
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const options = {};
  let correct_answer = 'A';
  all.forEach((v, i) => {
    options[letters[i]] = String(v);
    if (v === answer) correct_answer = letters[i];
  });
  return { options, correct_answer };
}

function arithmeticWordProblemsP6() {
  return shuffle([
    () => { const n = randInt(3,8), p = randInt(5,15); return { answer: n*p, text: `Emma buys ${n} books. Each book costs £${p}. How much does she spend in total?`, explanation: `${n} × £${p} = £${n*p}` }; },
    () => { const d = randInt(3,6), q = randInt(4,12); const total = d*q; return { answer: q, text: `${total} sweets are shared equally among ${d} children. How many sweets does each child get?`, explanation: `${total} ÷ ${d} = ${q}` }; },
    () => { const start = randInt(60,200), spent = randInt(10, 50); return { answer: start-spent, text: `James has ${start}p. He spends ${spent}p on a snack. How much money does he have left?`, explanation: `${start}p − ${spent}p = ${start-spent}p` }; },
    () => { const rows = randInt(3,8), cols = randInt(3,9); return { answer: rows*cols, text: `A classroom has ${rows} rows of desks with ${cols} desks in each row. How many desks are there altogether?`, explanation: `${rows} × ${cols} = ${rows*cols}` }; },
    () => { const a = randInt(20,80), b = randInt(20,80); return { answer: a+b, text: `A baker makes ${a} buns in the morning and ${b} in the afternoon. How many buns does the baker make in total?`, explanation: `${a} + ${b} = ${a+b}` }; },
  ]);
}

function arithmeticWordProblemsP7() {
  return shuffle([
    () => { const p = randInt(15,40), n = randInt(6,15); return { answer: p*n, text: `A shop sells tickets for £${p} each. A school group buys ${n} tickets. How much do they spend in total?`, explanation: `${n} × £${p} = £${p*n}` }; },
    () => { const weeks = randInt(4,10), per = randInt(25,60); const total = weeks*per; return { answer: per, text: `A charity raises £${total} over ${weeks} weeks, the same amount each week. How much do they raise per week?`, explanation: `£${total} ÷ ${weeks} = £${per}` }; },
    () => { const speed = randInt(40,70), hours = randInt(2,5); return { answer: speed*hours, text: `A car travels at ${speed} miles per hour for ${hours} hours. How far does it travel in total?`, explanation: `${speed} × ${hours} = ${speed*hours} miles` }; },
    () => { const a = randInt(150,400), b = randInt(50,149); return { answer: a+b, text: `A factory makes ${a} items in the morning and ${b} items in the afternoon. How many items does it make altogether?`, explanation: `${a} + ${b} = ${a+b}` }; },
    () => { const classes = randInt(6,12), pupils = randInt(25,32), extra = randInt(5,20); return { answer: classes*pupils+extra, text: `A school has ${classes} classes with ${pupils} pupils in each class. ${extra} more pupils join the school. How many pupils are there altogether?`, explanation: `(${classes} × ${pupils}) + ${extra} = ${classes*pupils} + ${extra} = ${classes*pupils+extra}` }; },
  ]);
}

function generateArithmeticQuestion(year_group) {
  const isP7 = year_group === 'P7';
  const ops   = ['addition', 'subtraction', 'multiplication', 'division', 'word_problem'];
  if (isP7) ops.push('multi_step');
  const op = ops[randInt(0, ops.length - 1)];

  let question_text, answer, explanation, difficulty;

  switch (op) {
    case 'addition': {
      const [a, b] = isP7 ? [randInt(100,999), randInt(100,999)] : [randInt(10,99), randInt(10,99)];
      answer = a + b;
      question_text = `What is ${a} + ${b}?`;
      explanation   = `${a} + ${b} = ${answer}`;
      difficulty    = isP7 ? 2 : 1;
      break;
    }
    case 'subtraction': {
      const b = isP7 ? randInt(100,499) : randInt(10,49);
      const a = b + (isP7 ? randInt(100,500) : randInt(10,50));
      answer = a - b;
      question_text = `What is ${a} − ${b}?`;
      explanation   = `${a} − ${b} = ${answer}`;
      difficulty    = isP7 ? 2 : 1;
      break;
    }
    case 'multiplication': {
      const [a, b] = isP7 ? [randInt(13,25), randInt(2,12)] : [randInt(2,12), randInt(2,12)];
      answer = a * b;
      question_text = `What is ${a} × ${b}?`;
      explanation   = `${a} × ${b} = ${answer}`;
      difficulty    = isP7 ? 2 : 1;
      break;
    }
    case 'division': {
      const divisor  = randInt(2, 12);
      const quotient = isP7 ? randInt(13,25) : randInt(2,12);
      const dividend = divisor * quotient;
      answer = quotient;
      question_text = `What is ${dividend} ÷ ${divisor}?`;
      explanation   = `${dividend} ÷ ${divisor} = ${answer}`;
      difficulty    = isP7 ? 2 : 1;
      break;
    }
    case 'word_problem': {
      const templates = isP7 ? arithmeticWordProblemsP7() : arithmeticWordProblemsP6();
      const t = templates[0]();
      answer        = t.answer;
      question_text = t.text;
      explanation   = t.explanation;
      difficulty    = 2;
      break;
    }
    case 'multi_step': {
      const classes = randInt(4,10), pupils = randInt(20,30), extra = randInt(5,25);
      answer        = classes * pupils + extra;
      question_text = `A school has ${classes} classes with ${pupils} pupils in each class. ${extra} more pupils join. How many pupils are there altogether?`;
      explanation   = `(${classes} × ${pupils}) + ${extra} = ${classes*pupils} + ${extra} = ${answer}`;
      difficulty    = 3;
      break;
    }
  }

  const { options, correct_answer } = buildOptions(answer);

  return {
    question_text,
    options,
    correct_answer,
    explanation,
    category:     'arithmetic',
    year_group,
    difficulty,
    needs_diagram: false,
  };
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
    case 'generate-passage':               return handleGeneratePassage(req, res);
    case 'generate-comprehension-questions': return handleGenerateComprehensionQuestions(req, res);
    case 'save-comprehension-set':           return await handleSaveComprehensionSet(req, res);
    case 'save-reference':      return handleSaveReference(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
