/**
 * tour.js — STAR AI Tutor Onboarding Tour
 * ─────────────────────────────────────────
 * Drop-in 4-step walkthrough overlay. Include this file in dashboard.html
 * and call StarTour.init(supabaseClient) on page load.
 *
 * The tour shows when:
 *   1. URL contains ?tour=true  (set by onboarding.html on first signup)
 *   2. OR profiles.onboarding_tour_complete = false
 *
 * Usage in dashboard.html:
 *   <script src="tour.js"></script>
 *   <script>
 *     // After Supabase client is set up:
 *     StarTour.init(sb, userProfile);
 *   </script>
 */

const StarTour = (() => {
  'use strict';

  // ── Inject styles ────────────────────────────────────────────────────────
  const CSS = `
    #star-tour-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(10,14,30,0.88);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      animation: tourFadeIn 0.4s ease;
    }
    #star-tour-overlay.hidden { display: none; }

    #star-tour-card {
      background: #1a2540;
      border: 1px solid rgba(245,200,66,0.2);
      border-radius: 20px;
      padding: 36px 32px 28px;
      max-width: 520px; width: 100%;
      box-shadow: 0 32px 100px rgba(0,0,0,0.5);
      position: relative;
      overflow: hidden;
    }
    @media (max-width: 480px) {
      #star-tour-card { padding: 28px 20px 22px; border-radius: 16px; }
    }

    #star-tour-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, #f5c842, #38d9c0);
    }

    .tour-step { display: none; }
    .tour-step.active {
      display: block;
      animation: tourSlideIn 0.35s cubic-bezier(0.4,0,0.2,1);
    }

    .tour-progress {
      display: flex; gap: 6px; margin-bottom: 24px;
    }
    .tour-pip {
      height: 4px; border-radius: 2px; flex: 1;
      background: rgba(143,160,188,0.25);
      transition: background 0.35s ease;
    }
    .tour-pip.done    { background: #38d9c0; }
    .tour-pip.active  { background: #f5c842; }

    .tour-icon {
      font-size: 44px; margin-bottom: 16px; display: block;
      animation: tourBounce 0.6s 0.1s both;
    }

    .tour-title {
      font-family: 'Nunito', 'Nunito Sans', sans-serif;
      font-weight: 800; font-size: 24px;
      color: #ffffff; margin-bottom: 10px; line-height: 1.25;
    }
    .tour-title em { font-style: normal; color: #f5c842; }

    .tour-body {
      font-size: 15px; line-height: 1.65;
      color: #8fa0bc; margin-bottom: 24px;
    }
    .tour-body strong { color: #ffffff; font-weight: 700; }

    /* Mode cards (step 3) */
    .mode-cards {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
      margin: 16px 0;
    }
    @media (max-width: 380px) { .mode-cards { grid-template-columns: 1fr; } }

    .mode-card {
      background: rgba(245,200,66,0.06);
      border: 1px solid rgba(245,200,66,0.15);
      border-radius: 12px; padding: 14px 12px;
    }
    .mode-card .mc-icon { font-size: 22px; margin-bottom: 6px; }
    .mode-card .mc-name {
      font-family: 'Nunito', sans-serif;
      font-weight: 800; font-size: 13px;
      color: #ffffff; margin-bottom: 3px;
    }
    .mode-card .mc-desc { font-size: 12px; color: #8fa0bc; line-height: 1.4; }

    /* Study plan table (step 2) */
    .plan-table {
      background: rgba(255,255,255,0.04);
      border-radius: 12px; overflow: hidden;
      margin: 16px 0;
    }
    .plan-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 14px;
    }
    .plan-row:last-child { border-bottom: none; }
    .plan-row .pr-key { color: #8fa0bc; }
    .plan-row .pr-val { font-weight: 700; color: #ffffff; }

    /* Buttons */
    .tour-actions {
      display: flex; gap: 10px; align-items: center; margin-top: 4px;
    }
    .tour-btn-skip {
      background: none; border: none;
      color: #8fa0bc; font-size: 13px; cursor: pointer;
      padding: 4px; text-decoration: underline;
      font-family: 'Nunito Sans', sans-serif;
      transition: color 0.2s;
    }
    .tour-btn-skip:hover { color: #ffffff; }
    .tour-btn-next {
      margin-left: auto;
      background: #f5c842; border: none;
      border-radius: 10px; color: #0f1629;
      font-family: 'Nunito', sans-serif;
      font-size: 15px; font-weight: 800;
      padding: 12px 24px; cursor: pointer;
      transition: background 0.2s, transform 0.15s;
      display: flex; align-items: center; gap: 6px;
    }
    .tour-btn-next:hover { background: #ffd84a; transform: translateY(-1px); }
    .tour-btn-back {
      background: none;
      border: 2px solid rgba(143,160,188,0.25);
      border-radius: 10px; color: #8fa0bc;
      font-family: 'Nunito', sans-serif;
      font-size: 14px; font-weight: 700;
      padding: 11px 16px; cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
    }
    .tour-btn-back:hover { border-color: #8fa0bc; color: #ffffff; }

    @keyframes tourFadeIn  { from { opacity:0; } to { opacity:1; } }
    @keyframes tourSlideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }
    @keyframes tourBounce  { 0%{transform:scale(0.6);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
  `;

  function injectStyles() {
    if (document.getElementById('star-tour-styles')) return;
    const s = document.createElement('style');
    s.id = 'star-tour-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── Build step content ──────────────────────────────────────────────────
  function buildSteps(profile) {
    const name  = profile?.student_name || 'there';
    const year  = profile?.year_group   || 'P6/P7';
    const phase = profile?.study_phase  || 1;
    const weeks = profile?.weeks_to_exam;
    const sessions = profile?.sessions_per_week || 3;
    const examYear  = profile?.exam_year || 2026;

    const PHASE_LABELS = {
      1: { name:'Phase 1 — Discovery', colour:'#38d9c0',
           desc: 'Wide-ranging sprints to find your strengths and weaknesses.' },
      2: { name:'Phase 2 — Builder',   colour:'#f5c842',
           desc: 'Targeted practice on weaker topics with increasing difficulty.' },
      3: { name:'Phase 3 — Executor',  colour:'#ef6c5e',
           desc: 'Full mocks and timed conditions to get you exam-ready.' }
    };
    const p = PHASE_LABELS[phase] || PHASE_LABELS[1];

    return [
      // ── Step 1: Welcome ────────────────────────────────────────────────
      {
        icon: '⭐',
        title: `Welcome, <em>${name}!</em>`,
        body: `I'm <strong>STAR</strong> — your personal AI tutor for the SEAG Transfer Test. I know you're in <strong>${year}</strong> and I've already built a personalised study plan just for you.<br><br>I adapt to your progress every session, so the more you practise with me, the smarter your plan gets. Let me show you how it all works.`,
        nextLabel: 'Show me my plan →'
      },
      // ── Step 2: Study Plan ─────────────────────────────────────────────
      {
        icon: '📅',
        title: `Your <em>Study Plan</em>`,
        body: `Based on your answers, here's what STAR has set up for you:
          <div class="plan-table">
            <div class="plan-row"><span class="pr-key">Year group</span><span class="pr-val">${year}</span></div>
            <div class="plan-row"><span class="pr-key">Exam date</span><span class="pr-val">November ${examYear}</span></div>
            ${weeks > 0 ? `<div class="plan-row"><span class="pr-key">Weeks to go</span><span class="pr-val">${weeks} weeks</span></div>` : ''}
            <div class="plan-row"><span class="pr-key">Your target</span><span class="pr-val">${sessions} sessions/week</span></div>
            <div class="plan-row"><span class="pr-key">Current phase</span><span class="pr-val" style="color:${p.colour}">${p.name}</span></div>
          </div>
          ${p.desc}`,
        nextLabel: 'Got it! What can I do? →'
      },
      // ── Step 3: The 5 Modes ────────────────────────────────────────────
      {
        icon: '🎯',
        title: `Your <em>5 Learning Modes</em>`,
        body: `STAR has five different ways to practise — each one designed for a different situation:
          <div class="mode-cards">
            <div class="mode-card">
              <div class="mc-icon">⚡</div>
              <div class="mc-name">Mini Sprint</div>
              <div class="mc-desc">10 quick questions. Instant feedback. Great for a daily warm-up.</div>
            </div>
            <div class="mode-card">
              <div class="mc-icon">🎯</div>
              <div class="mc-name">Topic Sprint</div>
              <div class="mc-desc">Focus on one weak topic until you nail it.</div>
            </div>
            <div class="mode-card">
              <div class="mc-icon">📋</div>
              <div class="mc-name">Full Mock</div>
              <div class="mc-desc">56 questions. Real SEAG format. Full results analysis.</div>
            </div>
            <div class="mode-card">
              <div class="mc-icon">🖨️</div>
              <div class="mc-name">Real Life Test</div>
              <div class="mc-desc">A printable paper you sit at home with a guardian timing you.</div>
            </div>
            <div class="mode-card" style="grid-column:1/-1">
              <div class="mc-icon">💬</div>
              <div class="mc-name">STAR Chat</div>
              <div class="mc-desc">Ask me anything — why you got a question wrong, help with a topic, or just to say you're nervous. I'm always here.</div>
            </div>
          </div>`,
        nextLabel: "Let's go! →"
      },
      // ── Step 4: First Sprint CTA ───────────────────────────────────────
      {
        icon: '🚀',
        title: `Ready for your <em>first sprint?</em>`,
        body: `The best way to start is to just dive in! Your first <strong>Mini Sprint</strong> will take about 5 minutes and STAR will start learning what you know.<br><br>Every question you answer makes your plan smarter. Let's begin! 🌟`,
        nextLabel: '🚀 Start My First Sprint!',
        isFinal: true
      }
    ];
  }

  // ── Build DOM ───────────────────────────────────────────────────────────
  function buildOverlay(steps) {
    const overlay = document.createElement('div');
    overlay.id = 'star-tour-overlay';

    const card = document.createElement('div');
    card.id = 'star-tour-card';

    // Progress pips
    const progress = document.createElement('div');
    progress.className = 'tour-progress';
    steps.forEach((_, i) => {
      const pip = document.createElement('div');
      pip.className = 'tour-pip' + (i === 0 ? ' active' : '');
      pip.dataset.stepIdx = i;
      progress.appendChild(pip);
    });
    card.appendChild(progress);

    // Steps
    steps.forEach((step, i) => {
      const el = document.createElement('div');
      el.className = 'tour-step' + (i === 0 ? ' active' : '');
      el.dataset.idx = i;
      el.innerHTML = `
        <span class="tour-icon">${step.icon}</span>
        <div class="tour-title">${step.title}</div>
        <div class="tour-body">${step.body}</div>
        <div class="tour-actions">
          ${i === 0 ? `<button class="tour-btn-skip" data-action="skip">Skip tour</button>` : ''}
          ${i > 0 ? `<button class="tour-btn-back" data-action="back">← Back</button>` : ''}
          <button class="tour-btn-next" data-action="next" data-final="${!!step.isFinal}">
            ${step.nextLabel}
          </button>
        </div>`;
      card.appendChild(el);
    });

    overlay.appendChild(card);
    return overlay;
  }

  // ── Controller ──────────────────────────────────────────────────────────
  let _supabase, _userId, _currentStep = 0, _steps, _overlay;

  function updatePips() {
    document.querySelectorAll('.tour-pip').forEach((pip, i) => {
      pip.classList.remove('active', 'done');
      if (i < _currentStep) pip.classList.add('done');
      if (i === _currentStep) pip.classList.add('active');
    });
  }

  function showStep(n) {
    document.querySelectorAll('.tour-step').forEach(s => s.classList.remove('active'));
    document.querySelector(`.tour-step[data-idx="${n}"]`).classList.add('active');
    _currentStep = n;
    updatePips();
  }

  async function completeTour() {
    // Mark tour complete in Supabase
    if (_supabase && _userId) {
      await _supabase
        .from('profiles')
        .update({ onboarding_tour_complete: true })
        .eq('id', _userId);
    }
    _overlay.classList.add('hidden');
  }

  function attachEvents() {
    _overlay.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset?.action;
      if (!action) return;

      if (action === 'skip') {
        await completeTour();
      } else if (action === 'back') {
        if (_currentStep > 0) showStep(_currentStep - 1);
      } else if (action === 'next') {
        const isFinal = e.target.closest('[data-action="next"]')?.dataset?.final === 'true';
        if (isFinal) {
          await completeTour();
          // Navigate to the sprint page
          window.location.href = 'study.html';
        } else {
          showStep(_currentStep + 1);
        }
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────
  async function init(supabaseClient, profileData) {
    _supabase = supabaseClient;

    // Get user ID for persisting tour completion
    if (_supabase) {
      const { data: { user } } = await _supabase.auth.getUser();
      _userId = user?.id;
    }

    // Check if tour should show
    const urlParams = new URLSearchParams(window.location.search);
    const tourFromUrl = urlParams.get('tour') === 'true';
    const tourNotDone = profileData && profileData.onboarding_tour_complete === false;

    if (!tourFromUrl && !tourNotDone) return; // Tour already completed

    // Clean URL param without reload
    if (tourFromUrl) {
      const url = new URL(window.location.href);
      url.searchParams.delete('tour');
      window.history.replaceState({}, '', url.toString());
    }

    injectStyles();

    _steps   = buildSteps(profileData || {});
    _overlay = buildOverlay(_steps);
    document.body.appendChild(_overlay);
    attachEvents();
  }

  return { init };
})();
