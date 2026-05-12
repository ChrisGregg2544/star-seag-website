# STAR AI Tutor — Full Frontend Rebuild Spec
## Version 1.0 | May 2026

---

## WHAT STAYS (DO NOT TOUCH)
- All 12,796 questions in Supabase
- All /api/ serverless functions
- study.html (question engine)
- mock.html
- diagram-generator.js
- Stripe subscription setup
- Supabase auth (auth.users, parent_subscriptions, profiles tables)

---

## WHAT GETS DELETED
- All pages using dark navy (#0B1F3A) colour scheme
- child-selector.html
- topic-sprint.html
- Any orphaned HTML pages no longer in the flow
- After deletion: audit all internal links to confirm nothing is broken

---

## BRAND COLOURS (use throughout)
- Primary Orange: #F97316
- Background: #FEF3E2 (warm cream)
- White: #FFFFFF
- Dark text: #1A1A1A
- Gold accent: #F59E0B
- NO dark navy anywhere

---

## PAGE 1 — LANDING PAGE (index.html)

### Header
- STAR AI Tutor logo (top left)
- LOG IN button (top right)
- START FREE TRIAL button (top right, orange)

### Hero Section
- Headline: "The AI Tutor That Grows With Your Child"
- Sub: "Personalised Transfer Test Preparation from P6 Foundations to P7 Exam Mastery"
- Button 1 (primary, orange): "START FREE TRIAL — No Card Required"
- Button 2 (secondary, outline): "Try 2 Free Mini Mocks — No Sign Up Needed"
- Social proof: "★★★★★ Trusted by P6 & P7 families across Northern Ireland"

### How It Works Section
Three steps:
1. Take 3 Mini Mocks — STAR assesses your child
2. Get a personalised study plan
3. Practice daily and watch scores improve

### Pricing Section
- £15/month first child
- £10/month each additional child
- 7-day free trial, no card required

### Footer
- Support | Privacy Policy | Terms of Service | Facebook

---

## PAGE 2 — GUEST MINI MOCK FLOW (no account needed)

### Entry Point
- Clicking "Try 2 Free Mini Mocks" on landing page
- Goes to: guest-start.html

### guest-start.html
Simple one-screen form:
- "Before we start — tell us about your child"
- Child's first name (text input)
- Year group: P6 or P7 (two large buttons)
- "Start Mini Mock →" button
- Save to localStorage: { childName, yearGroup }
- Redirect to: study.html?mode=mini-mock&guest=true

### Mini Mock 1 (guest)
- study.html serves 10 mixed questions (English + Maths) matched to yearGroup from localStorage
- No login check for guest=true parameter
- Results saved to localStorage automatically (already built)
- On completion: show results screen

### Results Screen (after Mock 1 — guest)
- Score display
- Button 1: "Try Another Mini Mock" → study.html?mode=mini-mock&guest=true
- Button 2: "Sign Up Free to Save Your Results" → login.html?signup=1
- NO dashboard button for guests

### Mini Mock 2 (guest)
- Same as Mock 1
- Results saved to localStorage
- On completion: show SIGNUP PROMPT SCREEN

### Signup Prompt Screen (after Mock 2 — guest)
Full screen prompt:
- "🎉 Almost there! Sign up free and complete one final Mini Mock — STAR will build your personalised training plan in minutes."
- "7-day free trial · No card required"
- Button 1: "Continue with Google" → Google OAuth
- Button 2: "Sign up with email" → signup.html
- Small link: "Maybe later" → back to landing page

---

## PAGE 3 — SIGNUP / LOGIN

### signup.html
- Email + password fields
- "Create Account" button
- "Already have an account? Log in" link
- Google OAuth button
- On success: → onboarding.html

### login.html
- Email + password fields
- "Log In" button
- "Don't have an account? Sign up free" link
- Google OAuth button
- On success:
  - Check localStorage for guest sprint results
  - If found: sync to Supabase, clear localStorage, set star_needs_baseline flag
  - Redirect to: dashboard.html

---

## PAGE 4 — ONBOARDING (new accounts only)

### onboarding.html — 4 steps, one screen each

**Step 1 — Parent details:**
- "Hi! I'm STAR. What's your name?"
- Parent first name input
- NEXT button

**Step 2 — Child details:**
- "Tell us about your child"
- Child first name (pre-fill from localStorage if guest data exists)
- Year group: P6 or P7 (pre-fill from localStorage if guest data exists)
- NEXT button

**Step 3 — Exam awareness:**
- "When is the Transfer Test?"
- Show: "Paper 1 — Saturday 15th November, Paper 2 — Saturday 22nd November"
- Weeks to exam auto-calculated and displayed
- NEXT button

**Step 4 — All set:**
- "You're all set, [childName]! 🎉"
- Summary: Name, Year Group, Weeks to exam
- "Let's finish your baseline — 1 more Mini Mock and STAR will build your plan"
- "START MY FINAL MINI MOCK →" button → study.html?mode=mini-mock&baseline=true
- Save all details to Supabase profiles table

---

## PAGE 5 — DASHBOARD (dashboard.html)

### BASELINE LOCKED STATE (star_needs_baseline = true)
Shown after signup until 3 Mini Mocks are complete.

- Header: Hi [childName]! | Parent View | Sign Out
- Gold banner: "🎯 Complete your final Mini Mock — STAR will build your personalised training plan!"
- Large CTA card (full width, orange): "🎯 Complete Your Baseline Mini Mock → 10 mixed questions, takes 5 minutes"
- Progress indicator: "✅ 2 Mini Mocks done · 1 more to go"
- Everything else on dashboard greyed out / locked
- Lock message on locked items: "Unlocks after your baseline"

### FULL DASHBOARD STATE (baseline complete, trial active)
Shown after 3 Mini Mocks and after baseline report is generated.

**Top bar:**
- STAR logo
- "Hi [childName]!" 
- Parent View button
- Sign Out

**Hero card:**
- Child name + year group badge (P6 CHAMPION TRACK or P7 EXAM TRACK)
- Weeks to exam countdown
- Last score ring

**Baseline Report Card (shown once after baseline complete):**
- "📊 Your Personalised Training Plan"
- Strengths: top 2 topics
- Focus areas: bottom 2 topics
- Recommended starting point

**Today's Recommended Session:**
- AI-generated based on weakest topics from recent results
- Large clickable card

**Action Buttons:**
- TAKE A MOCK (orange)
- STUDY BY TOPIC (cream/outlined)

**Session Mode Grid (5 cards):**
1. MINI MOCK — available during trial and after
2. TOPIC SPRINT — locked until subscribed
3. FULL MOCK — locked until subscribed
4. GUARDIAN SUPERVISED TEST — locked until subscribed
5. STAR CHAT — locked until subscribed

**Progress Section:**
- Skills Map — unlocks after 1 completed session; shows partial data immediately to encourage engagement
- Topics to Master
- Weekly Schedule

### TRIAL ACTIVE STATE
- Mini Mock fully available
- Topic Sprint, Full Mock, Guardian Supervised Test, STAR Chat show lock icon
- Lock tooltip: "Unlock with a subscription"
- Subscribe CTA visible but not blocking

### SUBSCRIPTION EXPIRED STATE
- Banner: "Your free trial has ended"
- Subscribe button prominent
- All session modes locked

---

## PAGE 6 — PARENT PORTAL (parent-dashboard.html)

- Accessible via "Parent View" button on dashboard
- Shows all linked children with progress summaries
- Add child button
- Per-child: sessions completed, last score, AI insights (needs practice / improving / strong areas)
- Subscription management link

---

## ADD CHILD FLOW (add-child.html)

- Child name input
- Year group selector (P6 or P7)
- Pricing transparency: "£10/month added to your subscription"
- Confirm button → Stripe update → back to parent portal

---

## TECHNICAL RULES

### Guest Mode
- study.html accepts ?guest=true parameter
- When guest=true: skip all auth checks, allow questions to load
- After 2 guest mocks: show signup prompt, never show dashboard link
- localStorage keys: star_guest_name, star_guest_year, star_guest_sessions (count), star_toReview, star_last_score, star_mastery

### Baseline Flag
- star_needs_baseline set to '1' in localStorage after signup if guest sessions found
- Also set in profiles table: needs_baseline = true
- Cleared when 3rd Mini Mock completes via showBaselineReport()
- Dashboard checks BOTH localStorage and profiles table

### Question Serving
- Guest Mini Mocks: mixed mode, matched to localStorage yearGroup
- All Mini Mocks: 5 English + 5 Maths, mixed categories
- P6 questions served to P6 students, P7 to P7 students

### Subscription Check
- Always use /api/check-subscription endpoint
- Never read profiles.subscription_status (column does not exist)
- Valid statuses: 'active' and 'trialing'

### Colours
- Zero tolerance for #0B1F3A navy on any user-facing page
- All pages: orange (#F97316) primary, cream (#FEF3E2) background

---

## PAGES TO KEEP (confirmed)
- index.html (rebuilt)
- guest-start.html (new)
- login.html (rebuilt)
- signup.html (rebuilt)
- onboarding.html (rebuilt)
- dashboard.html (rebuilt)
- parent-dashboard.html (rebuilt)
- add-child.html (rebuilt)
- study.html (KEEP AS IS — question engine)
- mock.html (KEEP AS IS)
- pricing.html (keep, minor updates)
- admin/validate.html (keep)
- admin/review.html (keep)

## PAGES TO DELETE
- child-selector.html
- topic-sprint.html
- Any other navy pages found during audit

---

## PRINTABLE TESTS (launch with)

The printable PDF test generator exists at printable-tests/generator/
- seag_generator.py — generates question paper
- answer_sheet_v2.py — generates pupil answer sheet and parent answer key
- Built with Python + ReportLab
- Produces 3 linked documents per paper: question paper, pupil answer sheet, parent answer key
- Known bugs still to fix before launch (see PRINTABLE_TESTS_HANDOVER.md)
- This is a LAUNCH feature — must be working before go-live
- Accessible from dashboard as "Real Life Test" mode

---

## EMAIL TEMPLATES

STAR-branded email templates exist in supabase-email-templates.md for:
- Confirm signup
- Password reset  
- Magic link login

**PRE-LAUNCH ACTION:** Confirm these templates are loaded into Supabase Auth email settings — do not leave Supabase default emails going to users.

---

## DATABASE CLEANUP (CRITICAL PRE-LAUNCH)

**reference_questions table MUST be deleted before launch**
- Contains copyright GL Assessment / Catapult material
- Used only as generation templates during build phase
- Must not be present in production database
- Action: DELETE all rows OR drop table entirely before switching to live Stripe keys

---

## PUNCTUATION/SPELLING/GRAMMAR QUESTIONS

Current status:
- Phase 1 complete: 200 reference questions properly segmented with A/B/C/D/N options
- Phases 2–6 not started (template-based generation, specialist validator, learning loop)
- Thousands of questions already generated and validated during bulk generation

**Launch decision: Not a blocker**
- Check question counts per category before launch
- Need 500+ good passing questions per category minimum
- Phases 2–6 are post-launch quality improvements
- Do NOT delay launch for this

---

## POST-LAUNCH ROADMAP (from STAR_PRODUCT_ROADMAP.md)

4-stage learning journey to build out over time:
1. Foundation (P6 basics) — Mini Mocks and topic practice
2. Confidence (P6/P7 transition) — Topic Sprints and targeted practice
3. Exam Simulation (P7) — Full Mocks and timed practice
4. Exam Ready (P7 final prep) — Real Life Tests and exam technique

Post-launch improvements:
- Punctuation fix Phases 2–6 (template-based generation)
- Progress dashboard enhancements
- Admin monitoring tools
- GCSE English expansion (same system, different content)

---

## LAUNCH CHECKLIST (after rebuild)

**Frontend:**
- [ ] Full guest flow tested on mobile
- [ ] Full signup flow tested end to end
- [ ] Baseline lock works correctly
- [ ] Dashboard unlocks after 3rd Mini Mock
- [ ] Parent portal working
- [ ] Add child + Stripe update working
- [ ] Subscription expiry handled
- [ ] No dark navy (#0B1F3A) on any user-facing page
- [ ] No Anthropic/Claude branding on any user-facing page

**Database:**
- [ ] reference_questions table deleted (copyright material)
- [ ] Orphaned test user data cleaned up

**Email:**
- [ ] STAR-branded email templates loaded into Supabase Auth settings
- [ ] Test confirm signup email
- [ ] Test password reset email

**Payments:**
- [ ] Switch Stripe from TEST keys to LIVE keys
- [ ] Test live payment end to end

**Content:**
- [ ] 500+ passing questions confirmed per category
- [ ] Statistics diagrams verified correct
- [ ] Printable test PDF generator working

**Infrastructure:**
- [ ] DNS confirmed working (staraitutor.co.uk and www.staraitutor.co.uk)
- [ ] Vercel deployment stable
- [ ] Webhook error rate at 0%

---

## MINI MOCK QUESTION COUNTS

- P6 Mini Mock = 10 questions
- P7 Mini Mock = 15 questions

---

## SESSION REVIEW (after every Mini Mock or Topic Sprint)

- Show each wrong question with correct answer and one-line explanation
- Group wrong answers by topic so patterns are visible
- Keep review to 2-3 minutes maximum
- Applies to both P6 and P7

---

## WEEKLY SESSION TARGETS (flexible, not day-specific)

- P6 default = 3 sessions per week
- P7 default = 4 sessions per week
- Final 8 weeks before exam P7 = 5 sessions per week
- Parent can adjust weekly target in settings (1-7)
- No fixed days — student completes sessions any day they choose

---

## WEEKLY SESSION CHECKLIST — P6

- Mini Mock ×2, Topic Sprint ×1
- Full Mock available but not in default rotation
- Suggest Full Mock monthly: "Feeling confident? Try a full mock — no pressure!"
- Real Life Test not in default rotation until P7 but available if parent requests

---

## WEEKLY SESSION CHECKLIST — P7

**Weeks 20+ from exam:** Mini Mock ×2, Topic Sprint ×1, Full Mock ×1

**Weeks 8–20 from exam:** Mini Mock ×2, Topic Sprint ×1, Full Mock ×1, Real Life Test ×1

**Final 8 weeks:** 5 sessions — Full Mock ×2, Real Life Test ×1, Mini Mock ×1, Topic Sprint ×1

---

## SCHOOL ACTIVITY TRACKER

- Two daily tick options on dashboard: "📚 Did school homework today" and "📝 Did a school mock today"
- School mock ticked = suggest lighter STAR session
- School homework ticked = suggest shorter session
- Data stored per day in Supabase

---

## REVISION GUIDANCE

- Dashboard = one tip per session, changes each visit
- After baseline report = show recommended weekly schedule for year group
- Parent portal = full guidance document
- Key message: quality over quantity, short focused sessions beat long ones

---

## RESOLVED ITEMS (May 2026 — do not re-open)

The following were fixed in code or are fully captured in the rebuild spec above:
- ✅ Login email pre-fills from localStorage on return visit
- ✅ Repeat questions in same session — dedup Set added to study.html
- ✅ Forgot password link on login page
- ✅ Show/hide password toggle on login and signup
- ✅ Study Hall removed — Mini Mock only (captured in Session Mode Grid above)
- ✅ "Real Life Test" renamed to "Guardian Supervised Test" (captured in Session Mode Grid above)
- ✅ Guest mock 2 CTA wording (captured in PAGE 2 Signup Prompt Screen above)
- ✅ Trial locking — Mini Mock only during trial (captured in TRIAL ACTIVE STATE above)
- ✅ Skills Map unlocks after 1 session (captured in Progress Section above)
