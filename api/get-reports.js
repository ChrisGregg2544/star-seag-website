export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'Service key not configured' });

  // 1. Fetch all reports
  const reportsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?select=question_id,reported_at,reviewed&order=reported_at.desc&limit=1000`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  if (!reportsRes.ok) {
    const text = await reportsRes.text();
    console.error('[get-reports] reports fetch error:', reportsRes.status, text.slice(0, 200));
    return res.status(500).json({ ok: false, error: `Supabase error ${reportsRes.status}` });
  }
  const rows = await reportsRes.json();

  // 2. Group by question_id to get counts and latest date
  const grouped = {};
  for (const row of rows) {
    const qid = row.question_id;
    if (!qid) continue;
    if (!grouped[qid]) {
      grouped[qid] = { question_id: qid, report_count: 0, latest_reported_at: row.reported_at };
    }
    grouped[qid].report_count++;
    if (row.reported_at > grouped[qid].latest_reported_at) {
      grouped[qid].latest_reported_at = row.reported_at;
    }
  }

  const uniqueIds = Object.keys(grouped);
  if (uniqueIds.length === 0) {
    return res.status(200).json({ ok: true, reports: [] });
  }

  // 3. Fetch question details for all reported question IDs
  const questionsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?id=in.(${uniqueIds.join(',')})&select=id,question_text,topic,validated`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  const questions = questionsRes.ok ? await questionsRes.json() : [];
  const qMap = Object.fromEntries((questions || []).map(q => [q.id, q]));

  // 4. Merge and sort by report count descending
  const result = uniqueIds.map(qid => {
    const q = qMap[qid] || {};
    return {
      ...grouped[qid],
      question_text: q.question_text || '(question not found)',
      topic:         q.topic         || '',
      validated:     q.validated     ?? true,
    };
  }).sort((a, b) => b.report_count - a.report_count);

  console.log(`[get-reports] Returning ${result.length} unique reported questions`);
  return res.status(200).json({ ok: true, reports: result });
}
