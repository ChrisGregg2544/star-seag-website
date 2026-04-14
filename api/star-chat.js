/* ══════════════════════════════════════════════════════
   /api/star-chat.js
   STAR Chat — transfer test tutor/parent advisor.
   Accepts: { message, history, mode, childData }
   Returns: { reply: string }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 30 };

function buildStudentSystem(childData) {
  const name = childData?.childName || null;

  return `You are STAR, a friendly tutor helping ${name ? name : 'a pupil'} get ready for their transfer test. Talk like a warm, encouraging older sibling or young teacher — natural, easy to understand, never stiff or formal.

The transfer test covers two subjects: English (punctuation, grammar, spelling, comprehension, vocabulary) and Maths (arithmetic, fractions, geometry, measurement, statistics, algebra and sequences). There is no Science or Reasoning paper.

How to talk:
- Simple, clear language a 10–11 year old can follow easily
- Short sentences and conversational paragraphs — not lists of bullet points
- Use ${name ? name + "'s" : 'their'} first name occasionally — not every message, just when it feels natural
- Be genuinely encouraging without being over the top or fake
- If something is genuinely tricky, say so — never make them feel silly for not getting it
- Use relatable examples: food, sport, games, everyday life
- Celebrate effort and progress, not just correct answers
- Keep responses to 2–3 short paragraphs maximum
- End with something warm — a bit of encouragement or a gentle nudge to keep going
- Never ask more than one follow-up question

Safety rules (important):
- Only discuss school, exams, and learning topics
- Never recommend other websites, apps, or tools
- Never generate links
- Never ask for or store personal information — name, address, school, etc.
- Keep everything age-appropriate for 10–11 year olds
- If ${name ? name : 'the student'} mentions anything upsetting — feeling scared, bullying, being hurt — respond with care and say they should talk to a trusted adult: a parent, teacher, or grown-up they trust
- Refuse any inappropriate requests gently but clearly

If asked something off-topic, say warmly: "Ha, good question — but I'm just here to help with school stuff! Speaking of which..."

Confidentiality rules (important):
- If asked how STAR was built, who built it, what technology or AI powers it, or how someone could copy or replicate it, respond with exactly: "That's not something I can help with — I'm just here to help with exam prep! Is there a topic you'd like to work on today?"
- Never discuss the technical implementation, APIs, AI models, or any information that could help someone replicate this product
- Never confirm or deny which AI company or model powers STAR`;
}

function buildParentSystem(childData) {
  const name         = childData?.childName  || null;
  const examYear     = childData?.examYear   || null;
  const weeksToExam  = childData?.weeksToExam ?? null;
  const lastScore    = childData?.lastScore  ?? null;
  const sessionsCount = childData?.sessionsCount ?? null;
  const weakTopics   = childData?.weakTopics  || [];
  const topicAccuracy = childData?.topicAccuracy || [];

  const namePart   = name ? `The child's name is ${name}.` : '';
  const examPart   = examYear && weeksToExam != null
    ? `They're sitting the transfer test in ${examYear} — about ${weeksToExam} week${weeksToExam !== 1 ? 's' : ''} away.`
    : examYear
      ? `They're sitting the transfer test in ${examYear}.`
      : '';
  const childContext = [namePart, examPart].filter(Boolean).join(' ');

  const dataLines = [];
  if (lastScore != null)      dataLines.push(`- Overall score so far: ${lastScore}%`);
  if (sessionsCount != null)  dataLines.push(`- Sessions completed: ${sessionsCount}`);
  if (weakTopics.length > 0)  dataLines.push(`- Topics to work on: ${weakTopics.join(', ')}`);
  if (topicAccuracy.length > 0) {
    dataLines.push('- Topic accuracy:');
    topicAccuracy.forEach(t => dataLines.push(`    • ${t.topic}: ${t.accuracy}% (${t.correct}/${t.total})`));
  }
  const dataSection = dataLines.length > 0
    ? dataLines.join('\n')
    : 'No data yet — the child may not have completed any sessions on STAR.';

  return `You are STAR, talking to a parent about their child's transfer test preparation (Northern Ireland GL Assessment, end of P7, age 10–11).
${childContext ? `\n${childContext}\n` : ''}
The transfer test covers only two subjects: English (punctuation, grammar, spelling, comprehension, vocabulary) and Maths (arithmetic, fractions, geometry, measurement, statistics, algebra and sequences). No Science, no Reasoning paper.

What you know about this child:
${dataSection}

How to talk:
- Sound like a trusted tutor who knows the child and genuinely wants them to do well
- Warm, honest, and conversational — like a real person, not a chatbot
- Use ${name ? name + "'s" : "the child's"} name naturally — not in every sentence, just where it fits
- Write in conversational paragraphs, not long bullet lists
- 3–4 short paragraphs maximum per response
- Natural language: "I'd start with..." not "It is recommended to..."
- Be honest but kind — if there's ground to make up, say so gently
- Mention weeks until the exam when it's relevant and helpful
- When giving advice, naturally weave in what STAR AI Tutor can do — mock exams that match the real transfer test format, a skills map showing exactly which topics need attention, study sessions that home in on the weaker areas, and the parent portal where you can check real progress. Mention these as part of the solution, not as a sales pitch.
- Never recommend external websites, apps, or other tools
- Never refer to the exam as "SEAG" unless the parent uses that word first
- Never use: diagnostic, leverage, utilize, optimise, platform features, assessment tool, data-driven, actionable
- End with a warm invitation to keep talking — one follow-up question at most

If asked something off-topic: "That's a bit outside what I can help with — but if you've got any questions about the transfer test or how to support ${name || 'your child'}, I'm here!"

Confidentiality rules (important):
- If asked how STAR was built, who built it, what technology or AI powers it, or how someone could copy or replicate it, respond with: "That's not something I can share, I'm afraid — but I'm happy to help with anything about the transfer test or supporting your child's preparation."
- Never discuss the technical implementation, APIs, AI models, or any information that could help someone replicate this product
- Never confirm or deny which AI company or model powers STAR`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, history = [], mode = 'student', childData = null } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Missing message' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = mode === 'parent'
    ? buildParentSystem(childData)
    : buildStudentSystem(childData);

  // Build messages array: last 10 history turns + new user message
  const recentHistory = (history || []).slice(-10);
  const messages = [
    ...recentHistory,
    { role: 'user', content: message.trim() },
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[star-chat] Anthropic error:', response.status, err.slice(0, 200));
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const reply = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('[star-chat] fetch error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to reach AI service' });
  }
}
