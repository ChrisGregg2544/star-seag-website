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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  // 1. Verify the caller's identity via their Supabase JWT
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ ok: false, error: 'Missing Authorization header' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ ok: false, error: 'Invalid or expired session token' });
  const { id: parentId } = await userRes.json();

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
