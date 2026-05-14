/* ══════════════════════════════════════════════════════
   Save a completed mini-mock session server-side.
   Uses service role key to bypass RLS.
   Verifies the requesting parent owns the child before writing.

   Accepts POST with Authorization: Bearer <supabase_jwt>
   Body: { childId, session, questionResults, missedTopics, freeSprintsUsed }
   Returns: { ok: true, sessionId } or { ok: false, error: string }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 15 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

function sbFetch(path, method, body, serviceKey, extraHeaders = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ══════════════════════════════════════════════════════════════
// PAPER CODE HELPERS
// ══════════════════════════════════════════════════════════════
const PAPER_CODE_CHARS = 'ABCDEFGHJKMNPRSTUVWXYZ23456789'; // 30 chars — excludes O/I/L/Q/0/1

function generatePaperCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += PAPER_CODE_CHARS[Math.floor(Math.random() * 30)];
  return code;
}

async function getUniquePaperCode(serviceKey) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generatePaperCode();
    const res = await sbFetch(`guardian_papers?paper_code=eq.${code}&select=id`, 'GET', undefined, serviceKey);
    const rows = res.ok ? await res.json() : [{}];
    if (Array.isArray(rows) && rows.length === 0) return code;
  }
  throw new Error('Could not generate unique paper code');
}

// ══════════════════════════════════════════════════════════════
// ACTION: save-paper  (requires JWT — parent must be logged in)
// POST { action:'save-paper', childId, childName, yearGroup,
//        scoredQuestions[56], historyQuestionIds[66] }
// Returns { ok, paper_code, session_id }
// ══════════════════════════════════════════════════════════════
async function handleSavePaper(req, res, serviceKey, parentId) {
  const { childId, childName, yearGroup, scoredQuestions, historyQuestionIds } = req.body;

  if (!childId)   return res.status(400).json({ ok: false, error: 'childId required' });
  if (!childName) return res.status(400).json({ ok: false, error: 'childName required' });
  if (!yearGroup) return res.status(400).json({ ok: false, error: 'yearGroup required' });
  if (!Array.isArray(scoredQuestions) || scoredQuestions.length !== 56)
    return res.status(400).json({ ok: false, error: 'scoredQuestions must be an array of 56' });

  // Verify access: direct student or parent owns this child
  let authorized = childId === parentId;
  if (!authorized) {
    const ownerRes = await sbFetch(`profiles?id=eq.${childId}&parent_id=eq.${parentId}&select=id`, 'GET', undefined, serviceKey);
    const ownerRows = ownerRes.ok ? await ownerRes.json() : [];
    authorized = Array.isArray(ownerRows) && ownerRows.length > 0;
  }
  if (!authorized) return res.status(403).json({ ok: false, error: 'Not authorised for this child' });

  // 1. INSERT session row (score=null — filled in when results submitted)
  const sessionInsertRes = await sbFetch('sessions', 'POST', {
    user_id: childId, session_type: 'guardian_test',
    track: null, score: null, total_questions: 56,
    english_score: null, maths_score: null,
  }, serviceKey, { 'Prefer': 'return=representation' });

  if (!sessionInsertRes.ok) {
    const t = await sessionInsertRes.text();
    console.error('[save-paper] sessions insert error:', t.slice(0, 200));
    return res.status(500).json({ ok: false, error: 'Failed to create session' });
  }
  const [savedSession] = await sessionInsertRes.json();
  const sessionId = savedSession?.id;

  // 2. INSERT student_question_history (all 66 questions for dedup on future papers)
  const histIds = Array.isArray(historyQuestionIds) && historyQuestionIds.length
    ? historyQuestionIds : scoredQuestions.map(q => q.id);
  const seenAt = new Date().toISOString();
  const histRes = await sbFetch('student_question_history', 'POST',
    histIds.map(qid => ({ student_id: childId, user_id: childId, question_id: qid, seen_at: seenAt })),
    serviceKey, { 'Prefer': 'return=minimal' });
  if (!histRes.ok) console.warn('[save-paper] history insert warn:', (await histRes.text()).slice(0, 200));

  // 3. Generate unique paper code + INSERT guardian_papers
  let paper_code;
  try { paper_code = await getUniquePaperCode(serviceKey); }
  catch (e) { return res.status(500).json({ ok: false, error: e.message }); }

  const paperInsertRes = await sbFetch('guardian_papers', 'POST', {
    paper_code, child_id: childId, parent_id: parentId,
    child_name: childName, year_group: yearGroup,
    session_id: sessionId, questions: scoredQuestions,
  }, serviceKey, { 'Prefer': 'return=minimal' });

  if (!paperInsertRes.ok) {
    const t = await paperInsertRes.text();
    console.error('[save-paper] guardian_papers insert error:', t.slice(0, 200));
    return res.status(500).json({ ok: false, error: 'Failed to save paper record' });
  }

  console.log(`[save-paper] ✅ paper ${paper_code} saved for child ${childId}`);
  return res.status(200).json({ ok: true, paper_code, session_id: sessionId });
}

// ══════════════════════════════════════════════════════════════
// ACTION: get-paper  (no auth — paper_code is sufficient)
// GET  /api/save-session?action=get-paper&code=XK7R2P
// POST { action:'get-paper', code:'XK7R2P' }
// Returns paper metadata + question list (WITHOUT correct answers)
// ══════════════════════════════════════════════════════════════
async function handleGetPaper(req, res, serviceKey) {
  const raw  = req.method === 'GET' ? (req.query?.code || '') : (req.body?.code || '');
  const code = raw.toString().trim().toUpperCase();

  if (!code || !/^[A-Z2-9]{6}$/.test(code))
    return res.status(400).json({ ok: false, error: 'Invalid paper code' });

  const paperRes = await sbFetch(
    `guardian_papers?paper_code=eq.${code}&select=paper_code,child_name,year_group,generated_at,results_entered_at,questions`,
    'GET', undefined, serviceKey
  );
  if (!paperRes.ok) return res.status(500).json({ ok: false, error: 'Database error' });
  const rows = await paperRes.json();
  if (!Array.isArray(rows) || !rows.length)
    return res.status(404).json({ ok: false, error: 'Paper not found' });

  const p = rows[0];
  return res.status(200).json({
    ok:               true,
    paper_code:       p.paper_code,
    child_name:       p.child_name,
    year_group:       p.year_group,
    generated_at:     p.generated_at,
    already_submitted: !!p.results_entered_at,
    // Return topic + type per question so UI renders right option buttons — no correct answers
    questions: (p.questions || []).map(q => ({ n: q.n, topic: q.topic, type: q.type })),
  });
}

// ══════════════════════════════════════════════════════════════
// ACTION: submit-results  (no auth — paper_code is sufficient)
// POST { action:'submit-results', code:'XK7R2P',
//        answers:[{ n:1, answer:'C' }, ...] }
// Returns { ok, score, total, english_score, maths_score,
//           topics_to_review, results[] }
// ══════════════════════════════════════════════════════════════
async function handleSubmitResults(req, res, serviceKey) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST required' });

  const { code, answers } = req.body || {};
  if (!code || typeof code !== 'string') return res.status(400).json({ ok: false, error: 'code required' });
  if (!Array.isArray(answers))           return res.status(400).json({ ok: false, error: 'answers array required' });

  const cleanCode = code.trim().toUpperCase();

  // Fetch full paper row including correct answers (server-side only — never sent to browser)
  const paperRes = await sbFetch(
    `guardian_papers?paper_code=eq.${cleanCode}&select=child_id,session_id,questions`,
    'GET', undefined, serviceKey
  );
  if (!paperRes.ok) return res.status(500).json({ ok: false, error: 'Database error' });
  const rows = await paperRes.json();
  if (!Array.isArray(rows) || !rows.length)
    return res.status(404).json({ ok: false, error: 'Paper not found' });

  const { child_id, session_id, questions: paperQs } = rows[0];

  // Build answer lookup: question_number → submitted answer
  const answerMap = {};
  for (const a of answers) { if (a.n != null) answerMap[Number(a.n)] = (a.answer || '').trim().toUpperCase(); }

  // Mark each of the 56 scored questions
  let score = 0, englishScore = 0, mathsScore = 0;
  const topicCorrect = {}, topicTotal = {};
  const qrRows = [], resultDetails = [];

  for (const q of paperQs) {
    const submitted = answerMap[q.n] ?? null;
    const correct   = submitted !== null &&
      (q.type === 'written' ? submitted === 'CORRECT' : submitted === q.answer);
    const isEnglish = q.n <= 28;

    if (correct) { score++; if (isEnglish) englishScore++; else mathsScore++; }

    topicTotal[q.topic]   = (topicTotal[q.topic]   || 0) + 1;
    topicCorrect[q.topic] = (topicCorrect[q.topic] || 0) + (correct ? 1 : 0);

    qrRows.push({ session_id, user_id: child_id, question_id: q.id,
      topic: q.topic, question_type: q.type, correct });
    resultDetails.push({ n: q.n, correct, submitted, expected: q.answer });
  }

  const topicsToReview = Object.keys(topicTotal).filter(t =>
    (topicCorrect[t] || 0) / topicTotal[t] < 0.70
  );

  // 1. DELETE any existing question_results for this session (supports re-submission)
  if (session_id) {
    await sbFetch(`question_results?session_id=eq.${session_id}`, 'DELETE', undefined,
      serviceKey, { 'Prefer': 'return=minimal' });
  }

  // 2. INSERT question_results with correct/incorrect values
  if (session_id && qrRows.length) {
    const qrRes = await sbFetch('question_results', 'POST', qrRows, serviceKey, { 'Prefer': 'return=minimal' });
    if (!qrRes.ok) console.error('[submit-results] qr insert error:', (await qrRes.text()).slice(0, 200));
  }

  // 3. PATCH sessions row with final scores + completed_at
  if (session_id) {
    const patchRes = await sbFetch(`sessions?id=eq.${session_id}`, 'PATCH', {
      score, total_questions: 56, english_score: englishScore,
      maths_score: mathsScore, completed_at: new Date().toISOString(),
    }, serviceKey, { 'Prefer': 'return=minimal' });
    if (!patchRes.ok) console.error('[submit-results] session PATCH error:', (await patchRes.text()).slice(0, 200));
  }

  // 4. UPSERT progress_summary
  const psRes = await sbFetch('progress_summary', 'POST', {
    user_id: child_id, last_score: score, last_total: 56,
    topics_to_review: topicsToReview,
    last_session_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, serviceKey, { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
  if (!psRes.ok) console.error('[submit-results] progress_summary error:', (await psRes.text()).slice(0, 200));

  // 5. Stamp results_entered_at on guardian_papers
  await sbFetch(`guardian_papers?paper_code=eq.${cleanCode}`, 'PATCH',
    { results_entered_at: new Date().toISOString() }, serviceKey, { 'Prefer': 'return=minimal' });

  console.log(`[submit-results] ✅ paper ${cleanCode} — ${score}/56`);
  return res.status(200).json({
    ok: true, score, total: 56, english_score: englishScore,
    maths_score: mathsScore, topics_to_review: topicsToReview, results: resultDetails,
  });
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  // ── No-auth actions (paper_code is sufficient auth) ──────────
  const action = req.method === 'GET' ? req.query?.action : req.body?.action;
  if (action === 'get-paper')      return handleGetPaper(req, res, serviceKey);
  if (action === 'submit-results') return handleSubmitResults(req, res, serviceKey);

  // Remaining actions require POST + JWT ────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  // 1. Verify the caller's identity via their Supabase JWT
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ ok: false, error: 'Missing Authorization header' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ ok: false, error: 'Invalid or expired session token' });
  const { id: parentId } = await userRes.json();

  if (action === 'save-paper') return handleSavePaper(req, res, serviceKey, parentId);

  // 2. Validate payload
  const { childId, session, questionResults, missedTopics } = req.body || {};
  if (!childId || !session || !Array.isArray(questionResults)) {
    return res.status(400).json({ ok: false, error: 'Missing required fields: childId, session, questionResults' });
  }

  // 3. Verify access — direct student (childId === parentId) or parent owns this child
  let authorized = childId === parentId;
  if (!authorized) {
    const ownerRes = await sbFetch(
      `profiles?id=eq.${childId}&parent_id=eq.${parentId}&select=id`,
      'GET', undefined, serviceKey
    );
    const ownerRows = ownerRes.ok ? await ownerRes.json() : [];
    authorized = Array.isArray(ownerRows) && ownerRows.length > 0;
  }
  if (!authorized) {
    console.warn('[save-session] 403 — parentId:', parentId, 'tried to write childId:', childId);
    return res.status(403).json({ ok: false, error: 'Not authorised for this child' });
  }

  // 4. INSERT session row → need the generated id for subsequent rows
  const sessionRow = {
    user_id:         childId,
    session_type:    session.session_type,
    track:           session.track,
    score:           session.score,
    total_questions: session.total_questions,
    english_score:   session.english_score,
    maths_score:     session.maths_score,
  };
  const sessionInsertRes = await sbFetch('sessions', 'POST', sessionRow, serviceKey, {
    'Prefer': 'return=representation',
  });
  if (!sessionInsertRes.ok) {
    const text = await sessionInsertRes.text();
    console.error('[save-session] sessions insert error:', text.slice(0, 200));
    return res.status(500).json({ ok: false, error: 'Failed to insert session row' });
  }
  const [savedSession] = await sessionInsertRes.json();
  const sessionId = savedSession?.id;

  // 5. INSERT question_results
  if (sessionId && questionResults.length > 0) {
    const qrRows = questionResults.map(q => ({
      session_id:    sessionId,
      user_id:       childId,
      question_id:   q.question_id,
      topic:         q.topic,
      question_type: q.question_type,
      correct:       q.correct,
    }));
    const qrRes = await sbFetch('question_results', 'POST', qrRows, serviceKey, {
      'Prefer': 'return=minimal',
    });
    if (!qrRes.ok) {
      const text = await qrRes.text();
      console.error('[save-session] question_results insert error:', text.slice(0, 200));
    }
  }

  // 6. INSERT student_question_history
  if (sessionId && questionResults.length > 0) {
    const seenAt = new Date().toISOString();
    const histRows = questionResults.map(q => ({
      student_id:  childId,
      user_id:     childId,
      question_id: q.question_id,
      seen_at:     seenAt,
    }));
    const histRes = await sbFetch('student_question_history', 'POST', histRows, serviceKey, {
      'Prefer': 'return=minimal',
    });
    if (!histRes.ok) {
      const text = await histRes.text();
      console.error('[save-session] student_question_history insert error:', text.slice(0, 200));
    }
  }

  // 7. UPSERT progress_summary
  const progressRow = {
    user_id:          childId,
    last_score:       session.score,
    last_total:       session.total_questions,
    topics_to_review: missedTopics || [],
    last_session_at:  new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  };
  const psRes = await sbFetch('progress_summary', 'POST', progressRow, serviceKey, {
    'Prefer': 'resolution=merge-duplicates,return=minimal',
  });
  if (!psRes.ok) {
    const text = await psRes.text();
    console.error('[save-session] progress_summary upsert error:', text.slice(0, 200));
  }

  // 8. Server-side increment of free_sprints_used (not trusted from client)
  let newFreeSprintsUsed = null;
  try {
    const parentSubRes = await sbFetch(
      `parent_subscriptions?parent_id=eq.${parentId}&select=subscription_status`,
      'GET', undefined, serviceKey
    );
    const [parentSub] = parentSubRes.ok ? await parentSubRes.json() : [];
    const isSubscribed = ['active', 'trialing'].includes(parentSub?.subscription_status);

    if (!isSubscribed) {
      const profileRes = await sbFetch(
        `profiles?id=eq.${childId}&select=free_sprints_used`,
        'GET', undefined, serviceKey
      );
      const [childProfile] = profileRes.ok ? await profileRes.json() : [];
      const current = typeof childProfile?.free_sprints_used === 'number'
        ? childProfile.free_sprints_used : 0;
      newFreeSprintsUsed = current + 1;

      const fsuRes = await sbFetch(
        `profiles?id=eq.${childId}`,
        'PATCH',
        { free_sprints_used: newFreeSprintsUsed },
        serviceKey,
        { 'Prefer': 'return=minimal' }
      );
      if (!fsuRes.ok) {
        const text = await fsuRes.text();
        console.error('[save-session] free_sprints_used increment error:', text.slice(0, 200));
      } else {
        console.log(`[save-session] free_sprints_used incremented to ${newFreeSprintsUsed} for child ${childId}`);
      }
    }
  } catch (err) {
    console.error('[save-session] free_sprints increment failed (non-fatal):', err.message);
  }

  console.log('[save-session] ✅ session', sessionId, 'saved for child', childId);
  return res.status(200).json({ ok: true, sessionId, newFreeSprintsUsed });
}
