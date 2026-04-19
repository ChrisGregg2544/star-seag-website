/* ══════════════════════════════════════════════════════
   /api/extract-paper.js
   Extracts questions from pasted paper content using
   Claude Haiku. Returns a JSON array of question objects.
══════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `You are an expert at analysing SEAG transfer test papers for Northern Ireland P6 and P7 pupils (ages 10-11). You will be given a question paper PDF and an official answer sheet. Extract every question and return a JSON array.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pdf_base64, pdf_filename, answer_sheet, year_group, paper_number } = req.body || {};

  if (!pdf_base64)    return res.status(400).json({ error: 'pdf_base64 is required' });
  if (!answer_sheet)  return res.status(400).json({ error: 'answer_sheet is required' });
  if (!year_group)    return res.status(400).json({ error: 'year_group is required' });
  if (!paper_number)  return res.status(400).json({ error: 'paper_number is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI configuration error' });

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

  const userContent = [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 },
    },
    { type: 'text', text: instruction },
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'pdfs-2024-09-25',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userContent }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data.error);
      return res.status(500).json({ error: data.error?.message || 'AI API error' });
    }

    const rawText = data.content?.[0]?.text || '';

    let questions;
    let truncated = false;

    // Helper: salvage a partial response by closing the array after the last complete object
    function salvagePartial(text) {
      // Find the opening bracket
      const start = text.indexOf('[');
      if (start === -1) return null;
      // Find the last complete object — last occurrence of }
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

    try {
      questions = JSON.parse(rawText);
    } catch {
      // Try to extract JSON array in case of stray whitespace or preamble
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          questions = JSON.parse(match[0]);
        } catch {
          // Response likely truncated — salvage complete objects up to the cutoff
          questions = salvagePartial(rawText);
          if (questions) {
            truncated = true;
            console.warn(`Truncated response salvaged: ${questions.length} questions recovered`);
          } else {
            console.error('JSON parse failed. Raw:', rawText.slice(0, 300));
            return res.status(500).json({ error: 'Could not parse AI response', raw: rawText.substring(0, 2000) });
          }
        }
      } else {
        // No array brackets found — still try to salvage
        questions = salvagePartial(rawText);
        if (questions) {
          truncated = true;
          console.warn(`Truncated response salvaged: ${questions.length} questions recovered`);
        } else {
          console.error('No JSON array found. Raw:', rawText.slice(0, 300));
          return res.status(500).json({ error: 'Could not parse AI response', raw: rawText.substring(0, 2000) });
        }
      }
    }

    if (!Array.isArray(questions)) {
      return res.status(500).json({ error: 'AI returned unexpected format' });
    }

    console.log(`Extracted ${questions.length} questions from ${year_group} paper ${paper_number}${truncated ? ' (truncated — partial salvage)' : ''}`);
    return res.status(200).json({ questions, truncated });

  } catch (err) {
    console.error('extract-paper error:', err.message);
    return res.status(500).json({ error: err.message || 'Extraction failed' });
  }
}
