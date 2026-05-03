"""
STAR AI Tutor — SEAG-Style Answer Sheet / Parent Answer Key
Compact 3-page layout.

Page 1: Header + Practice + English Q1-28
Page 2: Maths MC Q29-50
Page 3: Maths Written Q51-56 + Score Summary

Public API:
  build_from_paper_data(paper_data, answer_key, path, paper_num, is_key=False)
      Called by seag_generator.py after build_test().
  build_answer_sheet(path, paper_num, is_key=False)
      Standalone call — generates blank sheet with default question numbers.
"""

import json
import os

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white

PAGE_W, PAGE_H = A4   # 595.27 x 841.89 pt

# ── Layout ────────────────────────────────────────────────────────────────────
BORDER_PAD  = 12
TEXT_L      = 22
TEXT_R      = PAGE_W - 22
TEXT_W      = TEXT_R - TEXT_L          # ≈ 551.27 pt
FOOTER_Y    = BORDER_PAD + 10          # ≈ 22 pt
CONTENT_TOP = PAGE_H - BORDER_PAD - 12 # ≈ 817.89 pt

# ── Colours ───────────────────────────────────────────────────────────────────
DARK_BAND  = HexColor('#2C5F7A')
NAVY       = HexColor('#1B3A6B')
LTBLUE     = HexColor('#D6EAF4')
BORDER_COL = HexColor('#888888')
BODY_DARK  = HexColor('#111111')
WHITE      = white
GREEN      = HexColor('#1A8A3C')
GREEN_BG   = HexColor('#D7F0E0')
KEY_RED    = HexColor('#8B0000')

BODY = 'Helvetica'
BOLD = 'Helvetica-Bold'

# ── Compact question dimensions ───────────────────────────────────────────────
BOX_W     = 10    # mark box width (pt)
BOX_H     =  8    # mark box height (pt)
BOX_PITCH = 15    # horizontal advance per option slot
QNUM_W    = 18    # pt reserved for question number
CQ_H      = 22    # total vertical advance per compact MC row
CW_H      = 32    # total vertical advance per compact written row
BAND_H    = 12    # section band height
COL_GAP   =  5    # gap between columns

# ── Standard option letter sets ───────────────────────────────────────────────
ABCDE = ['A', 'B', 'C', 'D', 'E']
ABCDN = ['A', 'B', 'C', 'D', 'N']


# ══════════════════════════════════════════════════════════════════════════════
# LOW-LEVEL PRIMITIVES
# ══════════════════════════════════════════════════════════════════════════════

def draw_border(c):
    c.setStrokeColor(BORDER_COL)
    c.setLineWidth(0.7)
    c.roundRect(BORDER_PAD, BORDER_PAD,
                PAGE_W - 2*BORDER_PAD, PAGE_H - 2*BORDER_PAD,
                radius=5, stroke=1, fill=0)


def draw_band(c, label, x, y, width):
    """Solid dark band with white label. Returns y below (including 2pt gap)."""
    c.setFillColor(DARK_BAND)
    c.rect(x, y - BAND_H, width, BAND_H, stroke=0, fill=1)
    c.setFont(BOLD, 7.5)
    c.setFillColor(WHITE)
    c.drawString(x + 4, y - BAND_H + 3, label)
    return y - BAND_H - 2


def draw_page_footer(c, paper_num, is_key, note=''):
    c.setStrokeColor(HexColor('#BBBBBB'))
    c.setLineWidth(0.4)
    c.line(TEXT_L, FOOTER_Y + 14, TEXT_R, FOOTER_Y + 14)
    c.setFont(BOLD, 7.5)
    c.setFillColor(DARK_BAND)
    prefix = 'PARENT ANSWER KEY' if is_key else f'STARPP{paper_num}'
    c.drawString(TEXT_L, FOOTER_Y,
                 f'{prefix}  {note}      © STAR AI Tutor — staraitutor.co.uk')


def col_widths(n):
    """Return (col_w, [x0, x1, ...]) for n equal columns across TEXT_W."""
    w = (TEXT_W - (n - 1) * COL_GAP) / n
    xs = [TEXT_L + i * (w + COL_GAP) for i in range(n)]
    return w, xs


# ══════════════════════════════════════════════════════════════════════════════
# COMPACT QUESTION DRAWERS
# ══════════════════════════════════════════════════════════════════════════════

def draw_cq_mc(c, qnum, letters, x, y, correct=None, opt_text=None):
    """
    Draw one compact MC question row.
    Boxes sit at the top of the CQ_H slot; letter labels appear below each box.
    Correct answer box is filled solid green with a white mark line (parent key).
    opt_text: optional answer text shown after the boxes (practice questions only).
    Returns y - CQ_H.
    """
    box_top = y - 2
    box_bot = box_top - BOX_H   # y - 10

    # Question number — right-aligned, vertically centred with box
    c.setFont(BOLD, 7)
    c.setFillColor(DARK_BAND)
    c.drawRightString(x + QNUM_W - 2, box_bot + 2, str(qnum))

    bx = x + QNUM_W
    for letter in letters:
        is_correct = (correct is not None and letter == correct)

        if is_correct:
            # Green filled box
            c.setFillColor(GREEN)
            c.setStrokeColor(GREEN)
            c.setLineWidth(0.5)
            c.rect(bx, box_bot, BOX_W, BOX_H, stroke=1, fill=1)
            # White horizontal mark line through the centre
            c.setStrokeColor(WHITE)
            c.setLineWidth(1.8)
            c.line(bx + 1.5, box_bot + BOX_H / 2, bx + BOX_W - 1.5, box_bot + BOX_H / 2)
            # Green bold letter below
            c.setFont(BOLD, 5.5)
            c.setFillColor(GREEN)
        else:
            c.setStrokeColor(BODY_DARK)
            c.setFillColor(WHITE)
            c.setLineWidth(0.5)
            c.rect(bx, box_bot, BOX_W, BOX_H, stroke=1, fill=1)
            c.setFont(BODY, 5.5)
            c.setFillColor(HexColor('#444444'))

        c.drawCentredString(bx + BOX_W / 2, box_bot - 5, letter)
        bx += BOX_PITCH

    # Optional answer text after last box — used for practice questions
    if opt_text:
        c.setFont(BOLD if correct else BODY, 6)
        c.setFillColor(GREEN if correct else HexColor('#444444'))
        c.drawString(bx + 3, box_bot + 1, str(opt_text))

    return y - CQ_H


def draw_cq_written(c, qnum, x, y, col_width, unit='', correct=None):
    """
    Draw one compact written-answer question.
    Answer box spans qnum_w to col_right; green fill + text on parent key.
    Returns y - CW_H.
    """
    box_top   = y - 2
    box_bot   = y - CW_H + 4
    box_left  = x + QNUM_W + 2
    box_right = x + col_width - 4

    # Question number
    c.setFont(BOLD, 7)
    c.setFillColor(DARK_BAND)
    c.drawRightString(x + QNUM_W - 2, box_top - 5, str(qnum))

    has_answer = bool(correct)
    c.setStrokeColor(GREEN if has_answer else BORDER_COL)
    c.setFillColor(GREEN_BG if has_answer else WHITE)
    c.setLineWidth(0.5)
    c.rect(box_left, box_bot, box_right - box_left, box_top - box_bot, stroke=1, fill=1)

    if has_answer:
        c.setFont(BOLD, 7)
        c.setFillColor(GREEN)
        ans = str(correct)
        max_w = box_right - box_left - 4
        while ans and c.stringWidth(ans, BOLD, 7) > max_w:
            ans = ans[:-1]
        c.drawString(box_left + 3, box_bot + 5, ans)

    if unit:
        c.setFont('Helvetica-Oblique', 5.5)
        c.setFillColor(HexColor('#888888'))
        c.drawRightString(box_right - 2, box_bot + 3, unit)

    return y - CW_H


def draw_col_entries(c, entries, x, y, col_width):
    """
    Draw a vertical stack of compact question entries.
    Each entry is a dict: qnum, kind ('mc'|'written'), letters, unit, correct.
    Returns y below the last entry.
    """
    for e in entries:
        if e['kind'] == 'mc':
            y = draw_cq_mc(c, e['qnum'], e['letters'], x, y,
                           correct=e.get('correct'), opt_text=e.get('opt_text'))
        else:
            y = draw_cq_written(c, e['qnum'], x, y, col_width,
                                unit=e.get('unit', ''), correct=e.get('correct'))
        y -= 2  # small inter-question gap
    return y


# ══════════════════════════════════════════════════════════════════════════════
# FIXED PRACTICE DATA  (same on every paper — from SEAG format)
# ══════════════════════════════════════════════════════════════════════════════

PRACTICE_ENG = [
    {'qnum': 'P1', 'kind': 'mc', 'letters': ABCDN, 'correct': 'B', 'opt_text': 'segment B'},
    {'qnum': 'P2', 'kind': 'mc', 'letters': ABCDE, 'correct': 'D', 'opt_text': 'quickly'},
    {'qnum': 'P3', 'kind': 'mc', 'letters': ABCDN, 'correct': 'A', 'opt_text': 'beleive'},
    {'qnum': 'P4', 'kind': 'mc', 'letters': ABCDE, 'correct': 'C', 'opt_text': 'however'},
    {'qnum': 'P5', 'kind': 'written', 'unit': '', 'correct': 'The cat sat on the mat.'},
]

PRACTICE_MATHS = [
    {'qnum': 'P6',  'kind': 'mc', 'letters': ABCDE, 'correct': 'B', 'opt_text': '24'},
    {'qnum': 'P7',  'kind': 'mc', 'letters': ABCDE, 'correct': 'D', 'opt_text': '5:15 pm'},
    {'qnum': 'P8',  'kind': 'mc', 'letters': ABCDE, 'correct': 'A', 'opt_text': '£1.05'},
    {'qnum': 'P9',  'kind': 'written', 'unit': 'days', 'correct': '14'},
    {'qnum': 'P10', 'kind': 'written', 'unit': 'cm',   'correct': '4.5'},
]


# ══════════════════════════════════════════════════════════════════════════════
# PAGE BUILDERS
# ══════════════════════════════════════════════════════════════════════════════

def _blank_answers(entries):
    """Strip correct/opt_text from practice entries for the pupil answer sheet."""
    return [{k: v for k, v in e.items() if k not in ('correct', 'opt_text')}
            for e in entries]


def build_page1(c, paper_num, main_punc, main_gram, main_spell,
                comp_mc, comp_wr, is_key):
    """Page 1: header, candidate fields, practice, English Q1–28."""
    draw_border(c)
    y = CONTENT_TOP

    # Header band
    HEADER_H = 36
    c.setFillColor(KEY_RED if is_key else DARK_BAND)
    c.rect(TEXT_L, y - HEADER_H, TEXT_W, HEADER_H, stroke=0, fill=1)
    c.setFont(BOLD, 11.5)
    c.setFillColor(WHITE)
    if is_key:
        c.drawString(TEXT_L + 8, y - 14,
                     f'PARENT ANSWER KEY  ★  Transfer Test — Practice Paper {paper_num}')
    else:
        c.drawString(TEXT_L + 8, y - 14,
                     f'STAR AI TUTOR  ★  Transfer Test — Practice Paper {paper_num}')
    c.setFont(BODY, 7.5)
    c.drawString(TEXT_L + 8, y - 27, 'staraitutor.co.uk')
    y -= HEADER_H + 4

    if is_key:
        WH = 13
        c.setFillColor(HexColor('#FFE5E5'))
        c.setStrokeColor(KEY_RED)
        c.setLineWidth(0.5)
        c.rect(TEXT_L, y - WH, TEXT_W, WH, stroke=1, fill=1)
        c.setFont(BOLD, 7.5)
        c.setFillColor(KEY_RED)
        c.drawCentredString(PAGE_W / 2, y - WH + 3,
                            'KEEP AWAY FROM THE PUPIL — Correct answers highlighted in green')
        y -= WH + 14   # extra gap so fields don't crowd the warning banner

    # Candidate fields — label row above, full-width underline row below
    field_defs = [('First Name', 0.27), ('Surname', 0.27), ('School', 0.30), ('Date', 0.16)]
    c.setFont(BOLD, 7)
    c.setFillColor(BODY_DARK)
    fx = TEXT_L
    for label, frac in field_defs:
        fw = TEXT_W * frac - 4
        c.drawString(fx, y, label)
        fx += fw + 5
    y -= 11
    fx = TEXT_L
    for _, frac in field_defs:
        fw = TEXT_W * frac - 4
        c.setStrokeColor(BORDER_COL)
        c.setLineWidth(0.7)
        c.line(fx, y, fx + fw, y)
        fx += fw + 5
    y -= 7

    # Date boxes
    c.setFont(BOLD, 7)
    c.setFillColor(BODY_DARK)
    for label, lx in [('DATE OF TEST', TEXT_L), ('DATE OF BIRTH', TEXT_L + TEXT_W * 0.5)]:
        c.drawString(lx, y, label)
        bx = lx + c.stringWidth(label, BOLD, 7) + 5
        for sub, sw in [('Day', 18), ('Month', 18), ('Year', 26)]:
            c.setFont(BODY, 6)
            c.drawString(bx, y, sub)
            c.setStrokeColor(BORDER_COL)
            c.setFillColor(WHITE)
            c.setLineWidth(0.5)
            c.rect(bx, y - 11, sw, 9, stroke=1, fill=1)
            bx += sw + 3
            c.setFillColor(BODY_DARK)
    y -= 18

    # Instruction strip
    c.setFillColor(LTBLUE)
    c.rect(TEXT_L, y - 12, TEXT_W, 12, stroke=0, fill=1)
    c.setFont(BOLD, 7)
    c.setFillColor(NAVY)
    instr = 'Mark each box with a thin horizontal line:  '
    c.drawString(TEXT_L + 5, y - 9, instr)
    ex_x = TEXT_L + 5 + c.stringWidth(instr, BOLD, 7)
    # Draw example box with mark
    c.setStrokeColor(BODY_DARK)
    c.setFillColor(WHITE)
    c.setLineWidth(0.5)
    c.rect(ex_x, y - 10, BOX_W, BOX_H, stroke=1, fill=1)
    c.setStrokeColor(BODY_DARK)
    c.setLineWidth(1.2)
    c.line(ex_x + 1.5, y - 10 + BOX_H / 2, ex_x + BOX_W - 1.5, y - 10 + BOX_H / 2)
    c.setFont(BOLD, 7)
    c.setFillColor(NAVY)
    c.drawString(ex_x + BOX_W + 5, y - 9,
                 '    Write written answers clearly in the answer box.')
    y -= 17

    # ── 3-col: Practice Eng | Practice Maths | Q1-5 Punc ──────────────────────
    cw3, cx3 = col_widths(3)
    hy = [y, y, y]

    prac_eng   = PRACTICE_ENG   if is_key else _blank_answers(PRACTICE_ENG)
    prac_maths = PRACTICE_MATHS if is_key else _blank_answers(PRACTICE_MATHS)

    hy[0] = draw_band(c, 'ENGLISH – PRACTICE', cx3[0], hy[0], cw3)
    hy[0] = draw_col_entries(c, prac_eng, cx3[0], hy[0], cw3)

    hy[1] = draw_band(c, 'MATHS – PRACTICE', cx3[1], hy[1], cw3)
    hy[1] = draw_col_entries(c, prac_maths, cx3[1], hy[1], cw3)

    hy[2] = draw_band(c, 'ENGLISH – MAIN TEST', cx3[2], hy[2], cw3)
    hy[2] = draw_band(c, 'Punctuation  Q1–5  (A B C D or N)', cx3[2], hy[2], cw3)
    hy[2] = draw_col_entries(c, main_punc, cx3[2], hy[2], cw3)

    y = min(hy) - 6

    # ── 2-col: Grammar Q6-10 | Spelling Q11-15 ────────────────────────────────
    cw2, cx2 = col_widths(2)
    hy = [y, y]

    hy[0] = draw_band(c, 'Grammar  Q6–10  (A B C D E)', cx2[0], hy[0], cw2)
    hy[0] = draw_col_entries(c, main_gram, cx2[0], hy[0], cw2)

    hy[1] = draw_band(c, 'Spelling  Q11–15  (A B C D or N)', cx2[1], hy[1], cw2)
    hy[1] = draw_col_entries(c, main_spell, cx2[1], hy[1], cw2)

    y = min(hy) - 6

    # ── Comprehension MC Q16-22 (3-col: 3 + 2 + 2) ───────────────────────────
    y = draw_band(c, 'Comprehension MC  Q16–22  (A B C D E)', TEXT_L, y, TEXT_W)
    hy = [y, y, y]
    for i, qs in enumerate([comp_mc[:3], comp_mc[3:5], comp_mc[5:7]]):
        hy[i] = draw_col_entries(c, qs, cx3[i], hy[i], cw3)
    y = min(hy) - 6

    # ── Comprehension Written Q23-28 (2-col: 3 + 3) ──────────────────────────
    y = draw_band(c, 'Comprehension Written  Q23–28', TEXT_L, y, TEXT_W)
    hy = [y, y]
    hy[0] = draw_col_entries(c, comp_wr[:3], cx2[0], hy[0], cw2)
    hy[1] = draw_col_entries(c, comp_wr[3:], cx2[1], hy[1], cw2)

    draw_page_footer(c, paper_num, is_key, 'PLEASE TURN OVER ▶')


def build_page2(c, paper_num, maths_mc, is_key):
    """Page 2: Maths MC Q29–50."""
    draw_border(c)
    y = CONTENT_TOP

    CH = 16
    c.setFillColor(KEY_RED if is_key else DARK_BAND)
    c.rect(TEXT_L, y - CH, TEXT_W, CH, stroke=0, fill=1)
    c.setFont(BOLD, 8.5)
    c.setFillColor(WHITE)
    if is_key:
        c.drawString(TEXT_L + 8, y - CH + 4,
                     f'PARENT ANSWER KEY — Practice Paper {paper_num}  (Page 2 of 3)')
    else:
        c.drawString(TEXT_L + 8, y - CH + 4,
                     f'STAR AI Tutor — Practice Paper {paper_num}  (Page 2 of 3)')
    y -= CH + 8

    y = draw_band(c, 'MATHS – MAIN TEST  MC Questions  Q29–50  (A B C D E)',
                  TEXT_L, y, TEXT_W)

    cw2, cx2 = col_widths(2)
    mid = (len(maths_mc) + 1) // 2
    hy = [y, y]
    hy[0] = draw_col_entries(c, maths_mc[:mid],  cx2[0], hy[0], cw2)
    hy[1] = draw_col_entries(c, maths_mc[mid:],  cx2[1], hy[1], cw2)

    draw_page_footer(c, paper_num, is_key, 'PLEASE TURN OVER ▶')


def build_page3(c, paper_num, maths_wr, is_key):
    """Page 3: Maths Written Q51–56 + Score Summary."""
    draw_border(c)
    y = CONTENT_TOP

    CH = 16
    c.setFillColor(KEY_RED if is_key else DARK_BAND)
    c.rect(TEXT_L, y - CH, TEXT_W, CH, stroke=0, fill=1)
    c.setFont(BOLD, 8.5)
    c.setFillColor(WHITE)
    if is_key:
        c.drawString(TEXT_L + 8, y - CH + 4,
                     f'PARENT ANSWER KEY — Practice Paper {paper_num}  (Page 3 of 3)')
    else:
        c.drawString(TEXT_L + 8, y - CH + 4,
                     f'STAR AI Tutor — Practice Paper {paper_num}  (Page 3 of 3)')
    y -= CH + 8

    # ── Maths Written Q51-56 (3-col: 2 + 2 + 2) ──────────────────────────────
    y = draw_band(c, 'MATHS – Written Answers  Q51–56', TEXT_L, y, TEXT_W)
    cw3, cx3 = col_widths(3)
    hy = [y, y, y]
    for i, qs in enumerate([maths_wr[:2], maths_wr[2:4], maths_wr[4:6]]):
        hy[i] = draw_col_entries(c, qs, cx3[i], hy[i], cw3)
    y = min(hy) - 16

    # ── Score Summary ──────────────────────────────────────────────────────────
    SUMM_H = 36
    c.setFillColor(HexColor('#EBF4FA'))
    c.setStrokeColor(HexColor('#BDD9EA'))
    c.setLineWidth(0.5)
    c.rect(TEXT_L, y - SUMM_H, TEXT_W, SUMM_H, stroke=1, fill=1)

    c.setFont(BOLD, 8)
    c.setFillColor(NAVY)
    c.drawString(TEXT_L + 6, y - 12, 'Score Summary:')

    sections = [
        ('Punc (5)', 5), ('Gram (5)', 5), ('Spell (5)', 5),
        ('Comp MC (7)', 7), ('Comp Wr (6)', 6),
        ('Maths MC (22)', 22), ('Maths Wr (6)', 6), ('TOTAL', 56),
    ]
    label_w = 80
    bw = (TEXT_W - label_w) / len(sections)
    bx = TEXT_L + label_w
    for lbl, tot in sections:
        c.setFont(BODY, 5.5)
        c.setFillColor(BODY_DARK)
        c.drawCentredString(bx + bw / 2, y - 10, lbl)
        c.setStrokeColor(BORDER_COL)
        c.setFillColor(WHITE)
        c.setLineWidth(0.4)
        c.rect(bx + 2, y - SUMM_H + 5, bw - 4, 14, stroke=1, fill=1)
        c.setFont(BODY, 5)
        c.setFillColor(HexColor('#888888'))
        c.drawCentredString(bx + bw / 2, y - SUMM_H + 8, f'/ {tot}')
        bx += bw

    draw_page_footer(c, paper_num, is_key, 'END OF TEST')


# ══════════════════════════════════════════════════════════════════════════════
# INTERNAL BUILD ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════════

def _build(path, paper_num, main_punc, main_gram, main_spell,
           comp_mc, comp_wr, maths_mc, maths_wr, is_key):
    c = canvas.Canvas(path, pagesize=A4)
    title = 'Parent Answer Key' if is_key else 'Answer Sheet'
    c.setTitle(f'STAR AI Tutor — {title} Paper {paper_num}')
    c.setAuthor('STAR AI Tutor')

    build_page1(c, paper_num, main_punc, main_gram, main_spell,
                comp_mc, comp_wr, is_key)
    c.showPage()
    build_page2(c, paper_num, maths_mc, is_key)
    c.showPage()
    build_page3(c, paper_num, maths_wr, is_key)
    c.save()
    print(f'Saved: {path}  ({title})')


# ══════════════════════════════════════════════════════════════════════════════
# DATA HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _parse_opts(q):
    opts = q.get('options') or {}
    if isinstance(opts, str):
        try:
            opts = json.loads(opts)
        except Exception:
            opts = {}
    return opts if isinstance(opts, dict) else {}


def _unit_for(q):
    t = ((q.get('question_text') or '') + ' ' + (q.get('passage') or '')).lower()
    # Money — £ before pence so '£6.75' → '£' not 'p'
    if '£' in t:
        return '£'
    if 'pence' in t or 'penny' in t or 'pennies' in t:
        return 'p'
    # Weight
    if 'kilogram' in t or ' kg' in t:
        return 'kg'
    if ' gram' in t or ' g ' in t or t.endswith(' g'):
        return 'g'
    # Distance / length — before time so 'km per hour' → 'km' not 'hours'
    if 'kilometre' in t or ' km' in t:
        return 'km'
    if 'centimetre' in t or ' cm' in t:
        return 'cm'
    if 'millimetre' in t or ' mm' in t:
        return 'mm'
    if 'metre' in t or 'perimeter' in t or 'length' in t:
        return 'm'
    # Volume / capacity
    if 'litre' in t or ' ml' in t:
        return 'ml'
    # Time (after distance)
    if 'minute' in t:
        return 'minutes'
    if 'hour' in t:
        return 'hours'
    if 'second' in t:
        return 'seconds'
    # Angles
    if 'degree' in t or '°' in t or 'angle' in t:
        return '°'
    # Area
    if 'area' in t or 'square centimetre' in t:
        return 'cm²'
    # Percentage
    if 'percent' in t or '% of' in t:
        return '%'
    return ''


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC API — called by seag_generator.py
# ══════════════════════════════════════════════════════════════════════════════

def build_from_paper_data(paper_data, answer_key, path, paper_num, is_key=False):
    """
    Build answer sheet or parent key driven by seag_generator data.

    paper_data  — dict returned by fetch_paper_data()
    answer_key  — {q_num_int: correct_letter_str} from build_test()
    is_key=True — fills correct answers green (parent answer key)
    """

    def mc_entry(qnum, letters):
        raw = answer_key.get(qnum) if is_key else None
        # Normalise: strip whitespace, uppercase, convert empty → None
        correct = (raw or '').strip().upper() or None
        return {
            'qnum': str(qnum),
            'kind': 'mc',
            'letters': letters,
            'correct': correct,
        }

    def wr_entry(qnum, q, force_unit=None):
        raw = (q.get('correct_answer') or '') if is_key else None
        correct = raw.strip() or None if raw is not None else None
        return {
            'qnum': str(qnum),
            'kind': 'written',
            'unit': force_unit if force_unit is not None else _unit_for(q),
            'correct': correct,
        }

    main_punc  = [mc_entry(i, ABCDN) for i, _ in enumerate(paper_data['punctuation'],  start=1)]
    main_gram  = [mc_entry(i, ABCDE) for i, _ in enumerate(paper_data['grammar'],      start=6)]
    main_spell = [mc_entry(i, ABCDN) for i, _ in enumerate(paper_data['spelling'],     start=11)]
    comp_mc    = [mc_entry(i, ABCDE) for i, _ in enumerate(paper_data['comp_mc'],      start=16)]
    comp_wr    = [wr_entry(i, q, force_unit='') for i, q in enumerate(paper_data['comp_written'], start=23)]

    maths_mc   = [mc_entry(i, ABCDE) for i, _ in enumerate(paper_data['maths_mc'],    start=29)]
    wr_start   = 29 + len(paper_data['maths_mc'])
    maths_wr   = [wr_entry(i, q)     for i, q in enumerate(paper_data['maths_written'], start=wr_start)]

    _build(path, paper_num, main_punc, main_gram, main_spell,
           comp_mc, comp_wr, maths_mc, maths_wr, is_key)


# ══════════════════════════════════════════════════════════════════════════════
# STANDALONE ENTRY POINT  — blank sheet for testing
# ══════════════════════════════════════════════════════════════════════════════

def build_answer_sheet(path, paper_num=1, is_key=False):
    """Generate blank answer sheet or answer key with default question numbers."""

    def blank_mc(nums, letters):
        return [
            {
                'qnum': str(n),
                'kind': 'mc',
                'letters': letters,
                # Sample correct answer cycles through the valid letters for this section
                'correct': letters[n % len(letters)] if is_key else None,
            }
            for n in nums
        ]

    def blank_wr(nums):
        return [
            {
                'qnum': str(n),
                'kind': 'written',
                'unit': '',
                'correct': f'{n * 2}' if is_key else None,
            }
            for n in nums
        ]

    _build(
        path, paper_num,
        main_punc  = blank_mc(range(1,  6),  ABCDN),
        main_gram  = blank_mc(range(6,  11), ABCDE),
        main_spell = blank_mc(range(11, 16), ABCDN),
        comp_mc    = blank_mc(range(16, 23), ABCDE),
        comp_wr    = blank_wr(range(23, 29)),
        maths_mc   = blank_mc(range(29, 51), ABCDE),
        maths_wr   = blank_wr(range(51, 57)),
        is_key     = is_key,
    )


if __name__ == '__main__':
    OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'output'))
    os.makedirs(OUT, exist_ok=True)
    build_answer_sheet(
        os.path.join(OUT, 'STAR_Answer_Sheet_Paper1.pdf'),
        paper_num=1, is_key=False,
    )
    build_answer_sheet(
        os.path.join(OUT, 'STAR_Answer_Key_Paper1.pdf'),
        paper_num=1, is_key=True,
    )
