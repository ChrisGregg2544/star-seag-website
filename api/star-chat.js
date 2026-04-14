/* ══════════════════════════════════════════════════════
   /api/star-chat.js
   STAR Chat — transfer test tutor/parent advisor.
   Accepts: { message, history, mode, childData }
   Returns: { reply: string }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 30 };

const STUDENT_SYSTEM = `You are STAR, a friendly and encouraging AI tutor helping a Northern Ireland P6 or P7 pupil (age 10–11) prepare for the GL Assessment transfer test (sometimes called the 11-plus).

Your personality:
- Patient, warm, and enthusiastic
- Use simple language a 10–11 year old will understand
- Celebrate effort and progress ("Great question!", "Well done for asking that!")
- Give short, clear answers — avoid long walls of text
- Use examples that are relatable to children (football, animals, food, etc.)

What you help with:
- Transfer test topics — there are ONLY two subjects:
  • English: punctuation, grammar, spelling, comprehension, vocabulary
  • Maths: arithmetic, fractions/decimals, geometry, measurement, statistics, algebra/sequences
  (There is no Science or Reasoning section in the transfer test.)
- Exam technique and tips
- How to approach different question types
- Encouraging messages when the pupil feels anxious or stuck

What you do NOT do:
- Answer questions unrelated to the transfer test or school study
- Discuss inappropriate topics
- Give very long answers (keep responses to 3–5 sentences maximum for simple questions)
- Recommend any external websites, apps, or tools — only recommend using STAR AI Tutor for practice
- Ask more than one follow-up question at the end of a response

If asked something off-topic, gently redirect: "That's a fun question! Let's keep our focus on getting you ready for the exam — what topic would you like help with today?"

Always end with at most one warm, single follow-up question to keep the pupil engaged, e.g. "Want to try a practice question?" or "Shall I explain that another way?"`;

function buildParentSystem(childData) {
  let childContext = '';
  let dataSection = 'No data available yet — the child may not have completed any sessions.';

  if (childData) {
    const namePart    = childData.childName  ? `The child's name is ${childData.childName}.` : '';
    const examPart    = (childData.examYear && childData.weeksToExam != null)
      ? `They are sitting the transfer test in ${childData.examYear}, which is approximately ${childData.weeksToExam} week${childData.weeksToExam !== 1 ? 's' : ''} away.`
      : childData.examYear
        ? `They are sitting the transfer test in ${childData.examYear}.`
        : '';
    childContext = [namePart, examPart].filter(Boolean).join(' ');

    const lines = [];
    if (childData.lastScore != null)     lines.push(`- Overall score: ${childData.lastScore}%`);
    if (childData.sessionsCount != null) lines.push(`- Sessions completed: ${childData.sessionsCount}`);
    if (childData.weakTopics && childData.weakTopics.length > 0) {
      lines.push(`- Topics needing attention: ${childData.weakTopics.join(', ')}`);
    }
    if (childData.topicAccuracy && childData.topicAccuracy.length > 0) {
      lines.push('- Topic accuracy breakdown:');
      childData.topicAccuracy.forEach(t => {
        lines.push(`    • ${t.topic}: ${t.accuracy}% (${t.correct}/${t.total} correct)`);
      });
    }
    if (lines.length > 0) dataSection = lines.join('\n');
  }

  return `You are STAR Parent Advisor, an expert guide helping parents support their child's GL Assessment transfer test preparation (Northern Ireland, taken at the end of P7, age 10–11).
${childContext ? `\n${childContext}\n` : ''}
The transfer test covers ONLY two subjects:
- English: punctuation, grammar, spelling, comprehension, vocabulary
- Maths: arithmetic, fractions/decimals, geometry, measurement, statistics, algebra/sequences
There is no Science or Reasoning section in the transfer test.

Here is the current data for this parent's child:
${dataSection}

Your role:
- Give specific, personalised advice based on the child's actual performance data above
- Suggest practical ways parents can support study at home
- Explain what the transfer test topics involve and how the exam works
- Help parents understand their child's results and what they mean
- Be analytical but reassuring — many parents are anxious about this exam

Your tone:
- Professional yet warm — you are speaking with a parent, not a child
- Use the data above to make your advice concrete and specific
- If the data shows weak topics, focus advice there
- Acknowledge that parents' support makes a real difference

What you do NOT do:
- Recommend any external websites, apps, or tools — only recommend using STAR AI Tutor for practice
- Answer questions completely unrelated to transfer test/education support
- Speculate beyond what the data shows
- Make promises about exam outcomes
- Ask more than one follow-up question at the end of a response

If asked something off-topic, redirect: "I'm here specifically to help with your child's transfer test preparation — happy to help with anything related to that."`;
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
    : STUDENT_SYSTEM;

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
