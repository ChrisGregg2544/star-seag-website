/* ══════════════════════════════════════════════════════
   /api/send-weekly-emails.js
   Called every Sunday 18:00 UTC by Vercel Cron (vercel.json).
   Sends a weekly progress email to every parent whose child
   completed at least one session in the past 7 days.

   Required env vars:
     SUPABASE_SERVICE_ROLE_KEY
     RESEND_API_KEY
     CRON_SECRET
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 60 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const DASHBOARD_URL = 'https://star-seag-website.vercel.app/parent-dashboard.html';

const PARENT_TIPS = [
  'Try to keep each practice session to 20–30 minutes. Short, regular practice beats long, irregular sessions every time.',
  'After a session, ask your child to explain one question they found tricky. Teaching it back cements the understanding.',
  'Focus on one weak topic this week rather than trying to improve everything at once — small wins build confidence fast.',
  'Remind your child that mistakes are data, not failures. Every wrong answer tells you exactly what to work on next.',
  'Check in after sessions with "What did you find easy today?" before asking what was hard — it builds a positive habit.',
  'A quick 10-minute review of the previous session\'s wrong answers the next morning can double retention.',
  'If your child seems frustrated, take a break. Stressed brains don\'t retain information well — come back fresh.',
  'Celebrate consistency, not just scores. Turning up every day matters more than any single result.',
  'Try timing practice to match when your child is naturally alert — usually mid-morning or just after school.',
  'The SEAG exam rewards careful reading. Encourage your child to read each question twice before answering.',
];

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function sbGet(path, serviceKey) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!r.ok) {
    console.error(`[weekly-email] sbGet failed: ${path} → ${r.status}`);
    return [];
  }
  return r.json();
}

const FRIENDLY_TOPIC = {
  punctuation:             'Punctuation',
  grammar:                 'Grammar',
  spelling:                'Spelling',
  vocabulary:              'Vocabulary',
  comprehension_mc:        'Comprehension',
  comprehension_written:   'Comprehension (Written)',
  arithmetic:              'Arithmetic',
  geometry:                'Geometry',
  fractions_decimals:      'Fractions & Decimals',
  measurement:             'Measurement',
  statistics:              'Statistics',
  algebra_sequences:       'Algebra & Sequences',
};

function friendlyTopic(t) {
  return FRIENDLY_TOPIC[t] || t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildChildStats(childId, sessions, questionResults) {
  const childSessions = sessions.filter(s => s.user_id === childId);
  if (childSessions.length === 0) return null;

  const sessionIds = new Set(childSessions.map(s => s.id));
  const childQR    = questionResults.filter(qr => sessionIds.has(qr.session_id));

  const avgPct = Math.round(
    childSessions.reduce((sum, s) => {
      return sum + (s.total_questions > 0 ? (s.score / s.total_questions) * 100 : 0);
    }, 0) / childSessions.length
  );

  // Group by topic
  const topicMap = {};
  for (const qr of childQR) {
    const t = (qr.topic || 'other').toLowerCase();
    if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 };
    topicMap[t].total++;
    if (qr.correct) topicMap[t].correct++;
  }

  const weak   = [];
  const strong = [];
  for (const [topic, { correct, total }] of Object.entries(topicMap)) {
    if (total < 3) continue; // too few to be meaningful
    const pct = (correct / total) * 100;
    if (pct < 70)  weak.push(friendlyTopic(topic));
    if (pct >= 85) strong.push(friendlyTopic(topic));
  }

  return { sessionCount: childSessions.length, avgPct, weak, strong };
}

function buildEmailHtml(parentName, children, tip) {
  const childSections = children.map(child => {
    const { sessionCount, avgPct, weak, strong } = child.stats;
    const scoreEmoji = avgPct >= 80 ? '🌟' : avgPct >= 60 ? '⭐' : '💪';

    const weakBadges = weak.length > 0
      ? weak.map(t =>
          `<span style="display:inline-block;background:#FFF3E0;color:#E65100;border:1px solid #FFB74D;` +
          `border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700;margin:2px 3px 2px 0;">${t}</span>`
        ).join('')
      : `<span style="color:#6B7280;font-size:13px;">Nothing flagged this week 🎉</span>`;

    const strongSection = strong.length > 0
      ? `<div style="margin-top:12px;">
           <div style="font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">💪 Strong areas</div>
           <div>${strong.map(t =>
             `<span style="display:inline-block;background:#F0FDF4;color:#166534;border:1px solid #86EFAC;` +
             `border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700;margin:2px 3px 2px 0;">${t}</span>`
           ).join('')}</div>
         </div>`
      : '';

    return `
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#FFFFFF;border:2px solid #FFE0B2;border-radius:12px;margin-bottom:20px;">
        <tr><td style="padding:16px 20px 18px;">
          <div style="font-size:15px;font-weight:800;color:#1F2937;margin-bottom:12px;">
            ${child.name}
            <span style="font-size:12px;font-weight:600;color:#9CA3AF;background:#F3F4F6;
              padding:2px 8px;border-radius:99px;margin-left:6px;">${child.year_group}</span>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#FFF8F0;border-radius:10px;margin-bottom:14px;">
            <tr>
              <td align="center" style="padding:14px 0;border-right:1px solid #FFE0B2;width:50%;">
                <div style="font-size:24px;font-weight:900;color:#FF6D00;">${sessionCount}</div>
                <div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;
                  letter-spacing:.05em;margin-top:2px;">Session${sessionCount !== 1 ? 's' : ''}</div>
              </td>
              <td align="center" style="padding:14px 0;width:50%;">
                <div style="font-size:24px;font-weight:900;color:#FF6D00;">${scoreEmoji} ${avgPct}%</div>
                <div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;
                  letter-spacing:.05em;margin-top:2px;">Avg Score</div>
              </td>
            </tr>
          </table>

          <div>
            <div style="font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase;
              letter-spacing:.06em;margin-bottom:6px;">📚 Topics to practise</div>
            <div>${weakBadges}</div>
          </div>
          ${strongSection}
        </td></tr>
      </table>`;
  }).join('');

  const greeting = children.length === 1
    ? `how <strong>${children[0].name}</strong> got on this week`
    : `how your children got on this week`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Weekly STAR Progress Report</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#FF6D00 0%,#FF8F00 100%);
          border-radius:14px 14px 0 0;padding:24px 28px 22px;">
          <div style="font-size:24px;font-weight:900;color:#FFFFFF;letter-spacing:-.4px;">
            ⭐ STAR AI Tutor
          </div>
          <div style="font-size:14px;color:rgba(255,255,255,.85);margin-top:4px;font-weight:600;">
            Weekly Progress Report
          </div>
        </td></tr>

        <!-- Intro -->
        <tr><td style="background:#FFFFFF;padding:24px 28px 4px;
          border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.65;">
            Hi ${parentName},
          </p>
          <p style="margin:12px 0 20px;font-size:15px;color:#374151;line-height:1.65;">
            Here's ${greeting}.
          </p>
          ${childSections}
        </td></tr>

        <!-- Tip -->
        <tr><td style="background:#FFFBF5;padding:18px 28px;
          border:1px solid #E5E7EB;border-top:2px solid #FFE0B2;">
          <div style="font-size:11px;font-weight:800;color:#9CA3AF;text-transform:uppercase;
            letter-spacing:.06em;margin-bottom:8px;">💡 Tip for this week</div>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;font-style:italic;">
            "${tip}"
          </p>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="background:#FFFFFF;padding:24px 28px;
          border:1px solid #E5E7EB;border-top:none;">
          <a href="${DASHBOARD_URL}"
            style="display:inline-block;background:#FF6D00;color:#FFFFFF;text-decoration:none;
              font-weight:800;font-size:14px;padding:14px 36px;border-radius:12px;
              letter-spacing:.03em;box-shadow:0 4px 0 #C45000;">
            Go to Dashboard &rarr;
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F9FAFB;border-radius:0 0 14px 14px;padding:16px 28px;
          border:1px solid #E5E7EB;border-top:none;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.7;text-align:center;">
            STAR AI Tutor &middot;
            <a href="https://staraitutor.co.uk"
              style="color:#9CA3AF;text-decoration:underline;">staraitutor.co.uk</a><br>
            You're receiving this as a STAR subscriber.
            Log in to your dashboard to manage your preferences.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  // Auth — only Vercel Cron or a manual call with the correct secret
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const dry = req.query.dry === 'true';

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const resendKey = process.env.RESEND_API_KEY;
  if (!dry && !resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const tip = PARENT_TIPS[getISOWeek(new Date()) % PARENT_TIPS.length];

  // ── 1. Active / trialing subscriptions ───────────────────────────────────
  const subs = await sbGet(
    'parent_subscriptions?subscription_status=in.(active,trialing)&select=parent_id',
    serviceKey
  );
  if (subs.length === 0) {
    console.log('[weekly-email] No active subscribers — nothing to send');
    return res.status(200).json({ ok: true, sent: 0, skipped: 0 });
  }

  const parentIds = subs.map(s => s.parent_id).join(',');

  // ── 2. Parent profiles + children (parallel) ─────────────────────────────
  const [parents, allChildren] = await Promise.all([
    sbGet(`profiles?id=in.(${parentIds})&select=id,name,parent_email`, serviceKey),
    sbGet(`profiles?parent_id=in.(${parentIds})&select=id,name,year_group,parent_id`, serviceKey),
  ]);

  const childIds = allChildren.map(c => c.id);
  if (childIds.length === 0) {
    console.log('[weekly-email] No children found for subscribers');
    return res.status(200).json({ ok: true, sent: 0, skipped: subs.length });
  }

  // ── 3. This week's sessions ───────────────────────────────────────────────
  const weeklySessions = await sbGet(
    `sessions?user_id=in.(${childIds.join(',')})&completed_at=gte.${weekStart}` +
    `&select=id,user_id,score,total_questions`,
    serviceKey
  );

  // ── 4. Question results for those sessions ────────────────────────────────
  let questionResults = [];
  if (weeklySessions.length > 0) {
    const sessionIds = weeklySessions.map(s => s.id).join(',');
    questionResults = await sbGet(
      `question_results?session_id=in.(${sessionIds})&select=session_id,user_id,topic,correct`,
      serviceKey
    );
  }

  // ── 5. Build and send one email per parent ────────────────────────────────
  const parentMap       = Object.fromEntries(parents.map(p => [p.id, p]));
  const childrenByParent = {};
  for (const child of allChildren) {
    if (!childrenByParent[child.parent_id]) childrenByParent[child.parent_id] = [];
    childrenByParent[child.parent_id].push(child);
  }

  let sent = 0, skipped = 0;
  const dryResults = [];

  for (const sub of subs) {
    const parent = parentMap[sub.parent_id];
    if (!parent?.parent_email) {
      console.log(`[weekly-email] Skipping ${sub.parent_id} — no email on profile`);
      skipped++;
      continue;
    }

    const children       = childrenByParent[sub.parent_id] || [];
    const activeChildren = children
      .map(child => ({ ...child, stats: buildChildStats(child.id, weeklySessions, questionResults) }))
      .filter(child => child.stats !== null);

    if (activeChildren.length === 0) {
      console.log(`[weekly-email] Skipping ${parent.parent_email} — no sessions this week`);
      skipped++;
      continue;
    }

    const html      = buildEmailHtml(parent.name, activeChildren, tip);
    const dateLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const subject   = `Your weekly STAR progress report — ${dateLabel}`;

    if (dry) {
      console.log(`[weekly-email] DRY — would send to ${parent.parent_email}`);
      dryResults.push({
        to:       parent.parent_email,
        subject,
        children: activeChildren.map(c => ({ name: c.name, year_group: c.year_group, stats: c.stats })),
        html,
      });
      sent++;
      continue;
    }

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'STAR AI Tutor <no-reply@staraitutor.co.uk>',
          to:   [parent.parent_email],
          subject,
          html,
        }),
      });

      if (emailRes.ok) {
        sent++;
        console.log(
          `[weekly-email] ✅ Sent to ${parent.parent_email}` +
          ` (${activeChildren.length} child${activeChildren.length !== 1 ? 'ren' : ''})`
        );
      } else {
        const errText = await emailRes.text();
        console.error(`[weekly-email] ❌ Resend error for ${parent.parent_email}:`, errText.slice(0, 200));
        skipped++;
      }
    } catch (e) {
      console.error(`[weekly-email] ❌ Exception for ${parent.parent_email}:`, e.message);
      skipped++;
    }
  }

  console.log(`[weekly-email] Complete — sent:${sent} skipped:${skipped}${dry ? ' (DRY RUN)' : ''}`);

  if (dry) return res.status(200).json({ ok: true, dry: true, wouldSend: sent, skipped, emails: dryResults });
  return res.status(200).json({ ok: true, sent, skipped });
}
