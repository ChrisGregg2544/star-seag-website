/**
 * question-contract.mjs — THE single source of truth for what a valid question is.
 *
 * Used by: scripts/lint-questions.mjs (audit/quarantine) and — going forward —
 * every seeding/generation script MUST import lintQuestion() and refuse to
 * insert any question that returns violations.
 *
 * lintQuestion(q) -> array of violation strings (empty = valid).
 * Deterministic, no AI, no network.
 */

const SEGMENT_TOPICS = new Set(['punctuation', 'spelling']);       // A/B/C/D segments + N
const ABCDE_TOPICS   = new Set(['grammar', 'vocabulary', 'comprehension_mc',
  'arithmetic', 'geometry', 'fractions_decimals', 'measurement', 'statistics', 'algebra_sequences']);
const WRITTEN_TOPICS = new Set(['comprehension_written']);
export const ALL_TOPICS = [...SEGMENT_TOPICS, ...ABCDE_TOPICS, ...WRITTEN_TOPICS];

const GAP_MARKER = /_{2,}/;

// Two segments overlap if one contains the other, or they share 3+ consecutive words.
function segmentsOverlap(a, b) {
  if (!a || !b) return false;
  if (a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a))) return true;
  const aw = a.split(/\s+/);
  for (let k = 0; k + 3 <= aw.length; k++) {
    const tri = aw.slice(k, k + 3).join(' ');
    if (tri.length > 8 && b.includes(tri)) return true;
  }
  return false;
}

export function lintQuestion(q) {
  const v = [];
  const topic = q.topic || '';
  const opts  = q.options;
  const ans   = String(q.correct_answer ?? '').trim();

  // ── Universal ────────────────────────────────────────────────
  if (!ALL_TOPICS.includes(topic))                       v.push('unknown-topic');
  if (!['P6', 'P7'].includes(q.year_group))              v.push('bad-year-group');
  if (!(q.difficulty >= 1 && q.difficulty <= 5))         v.push('bad-difficulty');
  if (!String(q.question_text || '').trim())             v.push('empty-question-text');
  if (!ans)                                              v.push('empty-correct-answer');

  // ── Written (free response) ──────────────────────────────────
  if (WRITTEN_TOPICS.has(topic)) {
    if (opts && Object.keys(opts).length > 0)            v.push('written-has-options');
    if (!String(q.passage || '').trim())                 v.push('missing-passage');
    if (!q.passage_id)                                   v.push('missing-passage-id');
    return v;
  }

  // ── All MC ───────────────────────────────────────────────────
  if (!opts || typeof opts !== 'object' || Object.keys(opts).length === 0) {
    v.push('mc-missing-options');
    return v; // nothing more checkable
  }
  const keys = Object.keys(opts).sort().join(',');
  const vals = Object.entries(opts).filter(([, x]) => x != null).map(([k, x]) => [k, String(x).trim()]);

  for (const [k, val] of vals) {
    if (!val)                                            v.push(`empty-option-${k}`);
    else if (GAP_MARKER.test(val))                       v.push(`gap-marker-in-option-${k}`);
  }
  // duplicate option values (identical answers offered twice)
  const seen = new Map();
  for (const [k, val] of vals) {
    if (!val) continue;
    const norm = val.toLowerCase();
    if (seen.has(norm))                                  v.push(`duplicate-options-${seen.get(norm)}-${k}`);
    else seen.set(norm, k);
  }
  if (!Object.prototype.hasOwnProperty.call(opts, ans))  v.push('answer-not-in-options');

  // ── Segment topics (punctuation / spelling) ──────────────────
  if (SEGMENT_TOPICS.has(topic)) {
    if (keys !== 'A,B,C,D,N')                            v.push('segment-keys-not-ABCDN');
    const nVal = String(opts.N || '').toLowerCase();
    if (opts.N != null && !nVal.startsWith('no mistake')) v.push('bad-N-label');
    const segs = ['A', 'B', 'C', 'D'].map(k => String(opts[k] || '').trim());
    outer:
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      if (segmentsOverlap(segs[i], segs[j])) { v.push('overlapping-segments'); break outer; }
    }
  }

  // ── A-E topics ───────────────────────────────────────────────
  if (ABCDE_TOPICS.has(topic)) {
    if (keys !== 'A,B,C,D,E')                            v.push('mc-keys-not-ABCDE');
    if (topic === 'grammar') {
      for (const [k, val] of vals) {
        if (k !== 'N' && val && val.split(/\s+/).length > 6) { v.push('grammar-option-too-long'); break; }
      }
    }
    if (topic === 'comprehension_mc') {
      if (!String(q.passage || '').trim())               v.push('missing-passage');
      if (!q.passage_id)                                 v.push('missing-passage-id');
    }
  }

  return v;
}
