"""
STAR AI Tutor — SEAG-Style Practice Test Generator
Matches the official GL Assessment SEAG paper layout precisely.

Usage:
    python seag_generator.py [year_group] [paper_num] [seed]

    year_group  P6 or P7  (default: P7)
    paper_num   integer   (default: 1)
    seed        integer   for reproducible question selection (default: random)

Requires SUPABASE_SERVICE_ROLE_KEY in .env two directories above this file.
"""

import urllib.request
import urllib.error
import urllib.parse
import json
import os
import random as _random
from collections import defaultdict

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
import textwrap


# ── Page dimensions ────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4   # 595.27 × 841.89 pt

# ── Layout constants ───────────────────────────────────────────────────────────
BORDER_PAD   = 14       # pt from page edge to border box
TEXT_L       = 52       # left edge of text column
TEXT_R       = PAGE_W - 38
TEXT_W       = TEXT_R - TEXT_L
Q_NUM_X      = 38       # x centre of large question number
FOOTER_Y     = BORDER_PAD + 13   # baseline of footer text
CONTENT_TOP  = PAGE_H - BORDER_PAD - 48  # y of top of usable content area

# ── Colours ────────────────────────────────────────────────────────────────────
TEAL         = HexColor('#3B7EA1')   # section titles + answer letters
LIGHT_NUM    = HexColor('#CCCCCC')   # large question numbers
RULE_GREY    = HexColor('#BBBBBB')   # dotted dividers
BORDER_COL   = HexColor('#999999')   # page border
BODY_DARK    = HexColor('#1A1A1A')   # body text

# ── Fonts ──────────────────────────────────────────────────────────────────────
BODY   = 'Helvetica'
BOLD   = 'Helvetica-Bold'
OBLQ   = 'Helvetica-Oblique'


# ══════════════════════════════════════════════════════════════════════════════
# PAGE CHROME
# ══════════════════════════════════════════════════════════════════════════════

def draw_page_border(c):
    c.saveState()
    c.setStrokeColor(BORDER_COL)
    c.setLineWidth(0.8)
    c.roundRect(BORDER_PAD, BORDER_PAD,
                PAGE_W - 2*BORDER_PAD, PAGE_H - 2*BORDER_PAD,
                radius=6, stroke=1, fill=0)
    c.restoreState()

def draw_footer(c, page_num, last=False, end_label=''):
    c.saveState()
    c.setStrokeColor(RULE_GREY)
    c.setLineWidth(0.5)
    c.line(TEXT_L, FOOTER_Y + 16, TEXT_R, FOOTER_Y + 16)
    c.setFont(BODY, 9)
    c.setFillColor(BODY_DARK)
    c.drawString(TEXT_L, FOOTER_Y, f'Page {page_num}')
    c.setFont(BOLD, 9)
    c.setFillColor(TEAL)
    if last:
        c.drawRightString(TEXT_R, FOOTER_Y, f'END OF {end_label.upper()}')
        c.setFillColor(BODY_DARK)
        c.setFont(BOLD, 8.5)
        c.drawCentredString(PAGE_W/2, FOOTER_Y - 12,
                            'Do not turn over until you are told to do so!')
    else:
        c.drawRightString(TEXT_R, FOOTER_Y, 'Please go on to the next page >>>')
    c.restoreState()

def draw_section_title(c, title, y=None):
    """Draws the big bordered section-title box. Returns y below the box."""
    if y is None:
        y = CONTENT_TOP
    BOX_H = 54
    c.saveState()
    c.setStrokeColor(BORDER_COL)
    c.setLineWidth(0.8)
    c.roundRect(TEXT_L, y - BOX_H, TEXT_W, BOX_H, radius=5, stroke=1, fill=0)
    c.setFont(BOLD, 27)
    c.setFillColor(TEAL)
    c.drawCentredString(PAGE_W/2, y - BOX_H + 14, title)
    c.restoreState()
    return y - BOX_H - 22

def draw_dotted_rule(c, y):
    c.saveState()
    c.setStrokeColor(RULE_GREY)
    c.setLineWidth(0.4)
    c.setDash([1, 4])
    c.line(TEXT_L, y, TEXT_R, y)
    c.restoreState()

def draw_big_qnum(c, qnum, y):
    """Large light-grey question number on the left margin."""
    c.saveState()
    c.setFont(BOLD, 44)
    c.setFillColor(LIGHT_NUM)
    c.drawString(Q_NUM_X - 8, y - 38, str(qnum))
    c.restoreState()

def new_page(c, page_num_holder):
    """Finish current page, start new one, draw border."""
    c.showPage()
    page_num_holder[0] += 1
    draw_page_border(c)
    return CONTENT_TOP


# ══════════════════════════════════════════════════════════════════════════════
# TEXT HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def wrap_text(c, text, font, size, x, y, max_width, line_gap=14, colour=BODY_DARK):
    """Wraps and draws text. Returns y below last line."""
    c.setFont(font, size)
    c.setFillColor(colour)
    words = text.split()
    lines, current = [], ''
    for w in words:
        test = (current + ' ' + w).strip()
        if c.stringWidth(test, font, size) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    for ln in lines:
        c.drawString(x, y, ln)
        y -= line_gap
    return y

def text_height(c, text, font, size, max_width, line_gap=14):
    """Estimate height consumed by wrap_text."""
    words = text.split()
    lines, current = 0, ''
    for w in words:
        test = (current + ' ' + w).strip()
        if c.stringWidth(test, font, size) <= max_width:
            current = test
        else:
            lines += 1
            current = w
    lines += 1
    return lines * line_gap

def draw_mixed_bold(c, parts, x, y, size=10.5):
    """
    parts = list of (text, bold_flag)
    Renders inline text with bold/normal switching.
    """
    c.setFillColor(BODY_DARK)
    for text, bold in parts:
        font = BOLD if bold else BODY
        c.setFont(font, size)
        c.drawString(x, y, text)
        x += c.stringWidth(text, font, size)
    return x


# ══════════════════════════════════════════════════════════════════════════════
# INSTRUCTION BLOCKS
# ══════════════════════════════════════════════════════════════════════════════

def draw_instruction(c, parts, y, extra_bold_line=None):
    """
    Draws an instruction paragraph (mixed bold/normal) and optional extra bold line.
    parts = list of (text, bold) tuples forming one paragraph.
    Returns y below.
    """
    SIZE = 10.5
    LINE_H = 15
    c.setFillColor(BODY_DARK)

    word_list = []
    for seg_text, bold in parts:
        for w in seg_text.split():
            word_list.append((w, bold))
    word_list.append((' ', False))   # sentinel

    x = TEXT_L
    line_words = []
    for word, bold in word_list:
        font = BOLD if bold else BODY
        w_width = c.stringWidth(word + ' ', font, SIZE)
        if x + w_width > TEXT_R + 2 and line_words:
            cx = TEXT_L
            for (lw, lb) in line_words:
                lf = BOLD if lb else BODY
                c.setFont(lf, SIZE)
                c.drawString(cx, y, lw)
                cx += c.stringWidth(lw + ' ', lf, SIZE)
            y -= LINE_H
            x = TEXT_L
            line_words = []
        line_words.append((word, bold))
        x += w_width

    if line_words:
        cx = TEXT_L
        for (lw, lb) in line_words:
            lf = BOLD if lb else BODY
            c.setFont(lf, SIZE)
            c.setFillColor(BODY_DARK)
            c.drawString(cx, y, lw.strip())
            cx += c.stringWidth(lw + ' ', lf, SIZE)
        y -= LINE_H

    if extra_bold_line:
        c.setFont(BOLD, SIZE)
        c.setFillColor(BODY_DARK)
        c.drawString(TEXT_L, y, extra_bold_line)
        y -= LINE_H

    return y - 6


# ══════════════════════════════════════════════════════════════════════════════
# QUESTION TYPE RENDERERS
# ══════════════════════════════════════════════════════════════════════════════

def draw_mc_list(c, qnum, question_text, options, y, page_num_holder,
                 bold_q=True, answer_box=False):
    """
    Standard comprehension/maths MC: vertical A–E option list.
    Returns y below question.
    """
    SIZE     = 10.5
    LINE_H   = 15
    OPT_GAP  = 13       # 13pt gap keeps 7 comp-MC questions on one page
    Q_INDENT = TEXT_L + 28

    # Scale option font down until every option fits on one line
    opt_max_w = TEXT_R - Q_INDENT - 16
    OPT_SIZE = 10.5
    for sz in [10.5, 9.5, 9.0, 8.5]:
        if all(c.stringWidth(str(opt), BODY, sz) <= opt_max_w for opt in options):
            OPT_SIZE = sz
            break

    q_h = text_height(c, question_text, BOLD if bold_q else BODY, SIZE,
                       TEXT_W - 30, LINE_H)
    total_h = q_h + len(options) * OPT_GAP + 30
    if answer_box:
        total_h += 40

    if y - total_h < FOOTER_Y + 30:
        draw_footer(c, page_num_holder[0])
        y = new_page(c, page_num_holder)

    draw_big_qnum(c, qnum, y)

    qfont = BOLD if bold_q else BODY
    y = wrap_text(c, question_text, qfont, SIZE,
                  Q_INDENT, y, TEXT_W - 30, LINE_H)
    y -= 4

    if answer_box:
        BOX_H = 38
        c.setStrokeColor(BORDER_COL)
        c.setLineWidth(0.6)
        c.rect(Q_INDENT, y - BOX_H, TEXT_W - 30, BOX_H, stroke=1, fill=0)
        y -= BOX_H + 6
    else:
        for i, opt_text in enumerate(options):
            letter = chr(65 + i)
            c.setFont(BOLD, OPT_SIZE)
            c.setFillColor(TEAL)
            c.drawString(Q_INDENT, y, letter)
            # Truncate only if still too long after font scaling
            txt = str(opt_text)
            while txt and c.stringWidth(txt, BODY, OPT_SIZE) > opt_max_w:
                txt = txt[:-1]
            if txt != str(opt_text) and txt:
                txt = txt[:-1] + '…'
            c.setFont(BODY, OPT_SIZE)
            c.setFillColor(BODY_DARK)
            c.drawString(Q_INDENT + 16, y, txt)
            y -= OPT_GAP
        y -= 4

    draw_dotted_rule(c, y - 2)
    return y - 28


def _wrap_seg(c, text, font, size, max_w):
    """
    Split segment text into lines that each fit within max_w.
    Returns a list of 1 or 2 line strings (never truncates).
    """
    if c.stringWidth(text, font, size) <= max_w:
        return [text]
    words = text.split()
    # Try every split point and use the first that gives 2 fitting lines
    for i in range(1, len(words)):
        l1 = ' '.join(words[:i])
        l2 = ' '.join(words[i:])
        if (c.stringWidth(l1, font, size) <= max_w and
                c.stringWidth(l2, font, size) <= max_w):
            return [l1, l2]
    # Couldn't split cleanly — return as-is (will overflow slightly but not truncate)
    return [text]


def draw_segment_question(c, qnum, sentence, y, page_num_holder, has_n=True):
    """
    Punctuation / Spelling bracket-segment style.
    sentence is a list of strings, each being one A/B/C/D segment.
    Text word-wraps within each slot (up to 2 lines); never truncates.
    Returns y below.
    """
    Q_INDENT   = TEXT_L + 28
    N_SPACE    = 26
    AVAIL_W    = TEXT_R - Q_INDENT - N_SPACE
    SLOT_W     = AVAIL_W / 4
    MAX_TXT_W  = SLOT_W - 10
    TEXT_LINE_H = 12   # vertical spacing between wrapped lines

    # Prefer 1-line fit at the largest possible size
    SIZE = 7.5
    for sz in [10.5, 9.5, 8.5, 7.5]:
        if all(c.stringWidth(seg, BODY, sz) <= MAX_TXT_W for seg in sentence):
            SIZE = sz
            break

    # Word-wrap each segment — 1 or 2 lines
    seg_wrapped = [_wrap_seg(c, seg, BODY, SIZE, MAX_TXT_W) for seg in sentence]
    max_lines   = max(len(lines) for lines in seg_wrapped)

    text_area_h = max_lines * TEXT_LINE_H   # height of the text zone
    SEG_H       = text_area_h + 24          # + gap + bracket + letter label
    total_h     = 20 + SEG_H + 20

    if y - total_h < FOOTER_Y + 30:
        draw_footer(c, page_num_holder[0])
        y = new_page(c, page_num_holder)

    draw_big_qnum(c, qnum, y)

    BW       = SLOT_W - 6
    seg_x    = Q_INDENT
    text_top = y - 2   # baseline of the first text line

    for i, (seg, lines) in enumerate(zip(sentence, seg_wrapped)):
        letter = chr(65 + i)

        # Draw text lines (top-aligned within each slot)
        for li, ln in enumerate(lines):
            c.setFont(BODY, SIZE)
            c.setFillColor(BODY_DARK)
            c.drawString(seg_x + 5, text_top - li * TEXT_LINE_H, ln)

        # Bracket sits just below the text area
        bx = seg_x
        by = text_top - text_area_h - 4
        c.setStrokeColor(BODY_DARK)
        c.setLineWidth(0.7)
        c.line(bx + 4, by, bx + BW - 4, by)
        c.line(bx + 4, by, bx + 4,      by + 6)
        c.line(bx + BW - 4, by, bx + BW - 4, by + 6)

        c.setFont(BOLD, 9.5)
        c.setFillColor(TEAL)
        c.drawCentredString(bx + BW / 2, by - 12, letter)

        seg_x += SLOT_W

    if has_n:
        bracket_y = text_top - text_area_h - 4
        c.setFont(BOLD, 9)
        c.setFillColor(BODY_DARK)
        c.drawString(seg_x + 2, bracket_y, 'N')

    y = text_top - SEG_H
    draw_dotted_rule(c, y - 2)
    return y - 30


def draw_wordbox_question(c, qnum, sentence_before, words, sentence_after, y,
                          page_num_holder):
    """
    Grammar word-choice box style: partial sentence, row of word boxes labeled A–E.
    Returns y below.
    """
    SIZE = 10.5
    Q_INDENT = TEXT_L + 28
    BOX_H = 20
    BOX_PAD = 8

    total_h = 20 + BOX_H + 40
    if y - total_h < FOOTER_Y + 30:
        draw_footer(c, page_num_holder[0])
        y = new_page(c, page_num_holder)

    draw_big_qnum(c, qnum, y)

    if sentence_before:
        c.setFont(BODY, SIZE)
        c.setFillColor(BODY_DARK)
        c.drawString(Q_INDENT, y, sentence_before)
        y -= 18

    x = Q_INDENT
    box_y = y - BOX_H
    for i, word in enumerate(words):
        letter = chr(65 + i)
        ww = c.stringWidth(word, BODY, SIZE) + BOX_PAD * 2
        ww = max(ww, 36)

        c.setStrokeColor(BODY_DARK)
        c.setLineWidth(0.6)
        c.rect(x, box_y, ww, BOX_H, stroke=1, fill=0)
        c.setFont(BODY, SIZE)
        c.setFillColor(BODY_DARK)
        c.drawCentredString(x + ww/2, box_y + 5, word)
        c.setFont(BOLD, 9.5)
        c.setFillColor(TEAL)
        c.drawCentredString(x + ww/2, box_y - 11, letter)

        x += ww + 6

    y = box_y - 20

    if sentence_after:
        c.setFont(BODY, SIZE)
        c.setFillColor(BODY_DARK)
        c.drawString(Q_INDENT, y, sentence_after)
        y -= 16

    draw_dotted_rule(c, y - 4)
    return y - 30


def draw_horizontal_mc(c, qnum, context_text, question_text, options, y,
                       page_num_holder):
    """
    Maths-style single-line A–E options.
    """
    SIZE = 10.5
    Q_INDENT = TEXT_L + 28
    LINE_H = 15

    total_h = text_height(c, question_text, BOLD, SIZE, TEXT_W - 30, LINE_H) + 50
    if context_text:
        total_h += text_height(c, context_text, BODY, SIZE, TEXT_W - 30, LINE_H)
    if y - total_h < FOOTER_Y + 30:
        draw_footer(c, page_num_holder[0])
        y = new_page(c, page_num_holder)

    draw_big_qnum(c, qnum, y)

    if context_text:
        y = wrap_text(c, context_text, BODY, SIZE, Q_INDENT, y, TEXT_W - 30, LINE_H)
        y -= 4

    if question_text:
        y = wrap_text(c, question_text, BOLD, SIZE, Q_INDENT, y, TEXT_W - 30, LINE_H)
        y -= 4

    opt_x = Q_INDENT
    for i, opt in enumerate(options):
        letter = chr(65 + i)
        c.setFont(BOLD, SIZE)
        c.setFillColor(TEAL)
        c.drawString(opt_x, y, letter)
        opt_x += c.stringWidth(letter, BOLD, SIZE) + 4
        c.setFont(BODY, SIZE)
        c.setFillColor(BODY_DARK)
        c.drawString(opt_x, y, str(opt))
        opt_x += c.stringWidth(str(opt), BODY, SIZE) + 22

    y -= 18
    draw_dotted_rule(c, y - 2)
    return y - 28


def draw_written_question(c, qnum, question_text, y, page_num_holder, unit_hint=''):
    """Written answer question with empty box."""
    SIZE = 10.5
    Q_INDENT = TEXT_L + 28
    LINE_H = 15
    BOX_H = 62   # tall enough for 2–3 lines of handwriting

    total_h = text_height(c, question_text, BOLD, SIZE, TEXT_W - 30, LINE_H) + BOX_H + 30
    if y - total_h < FOOTER_Y + 30:
        draw_footer(c, page_num_holder[0])
        y = new_page(c, page_num_holder)

    draw_big_qnum(c, qnum, y)
    y = wrap_text(c, question_text, BOLD, SIZE, Q_INDENT, y, TEXT_W - 30, LINE_H)
    y -= 6

    if unit_hint:
        c.setFont(BODY, 9)
        c.setFillColor(HexColor('#555555'))
        c.drawRightString(TEXT_R, y + 2, unit_hint)

    c.setStrokeColor(BORDER_COL)
    c.setLineWidth(0.6)
    c.rect(Q_INDENT, y - BOX_H, TEXT_W - 30, BOX_H, stroke=1, fill=0)
    y -= BOX_H + 6

    draw_dotted_rule(c, y - 2)
    return y - 30


def draw_passage(c, title, lines_text, y, page_num_holder):
    """
    Numbered-line comprehension passage.
    lines_text = list of paragraph strings.
    Returns y below passage.
    """
    SIZE = 11.5
    LINE_H = 17
    Q_INDENT = TEXT_L + 28
    LINE_NUM_X = TEXT_L + 4

    c.setFont(BODY, 11)
    c.setFillColor(BODY_DARK)
    c.drawString(TEXT_L, y, 'Read the ')
    x = TEXT_L + c.stringWidth('Read the ', BODY, 11)
    c.setFont(BOLD, 11)
    c.drawString(x, y, 'whole')
    x += c.stringWidth('whole', BOLD, 11)
    c.setFont(BODY, 11)
    c.drawString(x, y, ' passage carefully, then answer the questions that follow.')
    y -= 24

    c.setFont(BOLD, 18)
    c.setFillColor(BODY_DARK)
    c.drawString(TEXT_L, y, title)
    y -= 26

    line_num = 1
    for para in lines_text:
        words = para.split()
        current_line = ''
        line_words_list = []

        for w in words:
            test = (current_line + ' ' + w).strip()
            if c.stringWidth(test, BODY, SIZE) <= TEXT_W - 30:
                current_line = test
            else:
                line_words_list.append(current_line)
                current_line = w
        if current_line:
            line_words_list.append(current_line)

        for ln in line_words_list:
            if y < FOOTER_Y + 30:
                draw_footer(c, page_num_holder[0])
                y = new_page(c, page_num_holder)

            c.setFont(BODY, 9)
            c.setFillColor(HexColor('#888888'))
            c.drawRightString(LINE_NUM_X + 18, y, str(line_num))
            c.setFont(BODY, SIZE)
            c.setFillColor(BODY_DARK)
            c.drawString(Q_INDENT, y, ln)
            y -= LINE_H
            line_num += 1

        y -= 6

    return y - 10


# ══════════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ══════════════════════════════════════════════════════════════════════════════

def draw_cover(c, paper_num=1, year_group='P7'):
    draw_page_border(c)

    c.setFont(OBLQ, 9)
    c.setFillColor(HexColor('#666666'))
    c.drawRightString(TEXT_R, PAGE_H - BORDER_PAD - 20, 'Practice Paper — For Pupil Use')

    c.setFont(BOLD, 11)
    c.setFillColor(TEAL)
    c.drawCentredString(PAGE_W/2, PAGE_H/2 + 110, '★  STAR AI TUTOR  ★')

    c.setFont(BOLD, 34)
    c.setFillColor(BODY_DARK)
    c.drawCentredString(PAGE_W/2, PAGE_H/2 + 60, 'Transfer Test')

    c.setFont(BOLD, 22)
    c.setFillColor(TEAL)
    c.drawCentredString(PAGE_W/2, PAGE_H/2 + 28, f'Practice Paper {paper_num}')

    c.setFont(BODY, 12)
    c.setFillColor(HexColor('#444444'))
    c.drawCentredString(PAGE_W/2, PAGE_H/2 - 4, 'English and Mathematics')

    c.setStrokeColor(TEAL)
    c.setLineWidth(1.5)
    c.line(PAGE_W/2 - 80, PAGE_H/2 - 22, PAGE_W/2 + 80, PAGE_H/2 - 22)

    box_x = TEXT_L
    box_y = PAGE_H/2 - 130
    box_w = TEXT_W
    box_h = 88
    c.setStrokeColor(BORDER_COL)
    c.setLineWidth(0.8)
    c.rect(box_x, box_y, box_w, box_h, stroke=1, fill=0)

    c.setFont(BOLD, 10)
    c.setFillColor(BODY_DARK)
    fields = [('First Name:', box_y + 64), ('Surname:', box_y + 46),
              ('School:', box_y + 28), ('Date:', box_y + 10)]
    for label, fy in fields:
        c.drawString(box_x + 10, fy, label)
        c.setStrokeColor(BORDER_COL)
        c.setLineWidth(0.5)
        c.line(box_x + 80, fy - 2, box_x + box_w - 10, fy - 2)

    c.setFont(BOLD, 10)
    c.setFillColor(BODY_DARK)
    c.drawString(TEXT_L, box_y - 28, 'Instructions:')
    instructions = [
        '• Do not open this paper until you are told to do so.',
        '• Read each question carefully.',
        '• Mark one answer only for each question.',
        '• If you make a mistake, rub it out and mark your new answer clearly.',
        '• You will have 50 minutes to complete this test.',
    ]
    c.setFont(BODY, 10)
    iy = box_y - 44
    for ins in instructions:
        c.drawString(TEXT_L + 10, iy, ins)
        iy -= 14

    # Practice question note
    note_y = iy - 10
    c.setFillColor(HexColor('#EEF4FF'))
    c.setStrokeColor(TEAL)
    c.setLineWidth(0.8)
    c.roundRect(TEXT_L, note_y - 34, TEXT_W, 34, radius=4, stroke=1, fill=1)
    c.setFont(BOLD, 9.5)
    c.setFillColor(TEAL)
    c.drawString(TEXT_L + 8, note_y - 12,
                 'Note: Questions P1–P10 are warm-up practice questions and do not count toward your score.')
    c.setFont(BODY, 9.5)
    c.setFillColor(BODY_DARK)
    c.drawString(TEXT_L + 8, note_y - 26,
                 'Do not start your 50-minute timer until Question 1 of the English Main Test.')

    c.setFont(BODY, 9)
    c.setFillColor(HexColor('#666666'))
    c.drawCentredString(PAGE_W/2, BORDER_PAD + 18, '56 questions  |  50 minutes')

    c.setFont(BODY, 8)
    c.setFillColor(HexColor('#999999'))
    c.drawCentredString(PAGE_W/2, BORDER_PAD + 8,
                        '© STAR AI Tutor — staraitutor.co.uk')


# ══════════════════════════════════════════════════════════════════════════════
# SUPABASE CONNECTION
# ══════════════════════════════════════════════════════════════════════════════

def load_env():
    """
    Load SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
    Checks .env two directories above this script, then environment variables.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.normpath(os.path.join(script_dir, '..', '..', '.env'))

    env = {}
    if os.path.exists(env_path):
        with open(env_path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, _, v = line.partition('=')
                    env[k.strip()] = v.strip().strip('"').strip("'")
    else:
        print(f'  [warn] .env not found at {env_path} — falling back to environment variables')

    url = (env.get('SUPABASE_URL')
           or os.environ.get('SUPABASE_URL')
           or 'https://iutcgogmxhaqgaxkznxu.supabase.co')

    key = (env.get('SUPABASE_SERVICE_ROLE_KEY')
           or env.get('SUPABASE_SERVICE_KEY')
           or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
           or os.environ.get('SUPABASE_SERVICE_KEY', ''))
    if not key:
        raise RuntimeError(
            'SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) not found.\n'
            f'  Looked in: {env_path}\n'
            '  Also checked SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_KEY environment variables.'
        )

    return url, key


def sb_get(supabase_url, service_key, table, params=''):
    """
    Fetch rows from a Supabase table via REST API.
    Returns a list of dicts. Raises RuntimeError on HTTP errors.
    """
    url = f'{supabase_url}/rest/v1/{table}?{params}'
    req = urllib.request.Request(url, headers={
        'apikey': service_key,
        'Authorization': f'Bearer {service_key}',
        'Accept': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'Supabase {e.code} on {table}: {body[:300]}')
    except urllib.error.URLError as e:
        raise RuntimeError(f'Network error fetching {table}: {e.reason}')


# ══════════════════════════════════════════════════════════════════════════════
# DATA MAPPING  (DB row → renderer format)
# ══════════════════════════════════════════════════════════════════════════════

def _parse_options(q):
    """Return the options field as a dict, handling str or dict."""
    opts = q.get('options') or {}
    if isinstance(opts, str):
        try:
            opts = json.loads(opts)
        except json.JSONDecodeError:
            opts = {}
    return opts if isinstance(opts, dict) else {}


def q_to_segments(q):
    """
    Punctuation / Spelling → [seg_A, seg_B, seg_C, seg_D]
    Options A/B/C/D hold the segment texts; N is handled by has_n=True.
    """
    opts = _parse_options(q)
    return [opts.get('A', ''), opts.get('B', ''), opts.get('C', ''), opts.get('D', '')]


def q_to_wordbox(q):
    """
    Grammar → (sentence_before, [word_A, word_B, word_C, word_D, word_E], sentence_after)
    Splits question_text on '___' to find the blank position.
    """
    opts = _parse_options(q)
    words = [opts.get(k, '') for k in ['A', 'B', 'C', 'D', 'E'] if opts.get(k)]

    text = (q.get('question_text') or '').strip()

    # Try common blank markers in order of likelihood
    for marker in ['___', '__', '[blank]', '[ ]', '........']:
        if marker in text:
            before, _, after = text.partition(marker)
            return before.rstrip(), words, after.lstrip()

    # No marker found — sentence goes entirely before the word boxes
    return text, words, ''


def q_to_comp_mc(q):
    """
    Comprehension MC → (question_text, [opt_A, opt_B, opt_C, opt_D, opt_E])
    """
    opts = _parse_options(q)
    options = [opts.get(k, '') for k in ['A', 'B', 'C', 'D', 'E'] if opts.get(k)]
    return q.get('question_text', ''), options


def q_to_maths_mc(q):
    """
    Maths MC → (context_text, question_text, [opt_A ... opt_E])
    Context comes from the 'passage' column (setup text above the bold question).
    """
    opts = _parse_options(q)
    options = [opts.get(k, '') for k in ['A', 'B', 'C', 'D', 'E'] if opts.get(k)]
    context = (q.get('passage') or '').strip()
    question = (q.get('question_text') or '').strip()
    return context, question, options


def q_to_maths_written(q):
    """
    Maths written → (context_text, question_text, unit_key)
    unit_key matches UNIT_HINTS keys: 'written_kg', 'written_mins', etc.
    """
    context = (q.get('passage') or '').strip()
    question = (q.get('question_text') or '').strip()
    lower = question.lower() + ' ' + context.lower()

    unit_key = 'written'
    if 'kg' in lower or 'kilogram' in lower:
        unit_key = 'written_kg'
    elif '£' in lower:
        unit_key = 'written_gbp'
    elif 'pence' in lower:
        unit_key = 'written_p'
    elif ' km' in lower or 'kilometre' in lower or 'kilometer' in lower:
        unit_key = 'written_km'
    elif 'metre' in lower or 'meter' in lower or 'perimeter' in lower or ' cm' in lower:
        unit_key = 'written_m'
    elif 'minute' in lower:
        unit_key = 'written_mins'

    return context, question, unit_key


def split_passage(text):
    """Split a passage string into paragraph list for draw_passage()."""
    if not text:
        return ['(No passage text available)']
    # Try double-newline paragraph split first
    paras = [p.strip() for p in text.split('\n\n') if p.strip()]
    if not paras:
        paras = [p.strip() for p in text.split('\n') if p.strip()]
    return paras or [text.strip()]


def get_passage_text(row):
    """
    Extract title and body text from a passages table row.
    Handles different possible column names robustly.
    """
    text = (row.get('content')
            or row.get('passage_text')
            or row.get('body')
            or row.get('text')
            or row.get('passage')
            or '')
    title = (row.get('title')
             or row.get('name')
             or row.get('heading')
             or 'Reading Passage')
    return title, text


# ══════════════════════════════════════════════════════════════════════════════
# HARDCODED WRITTEN MATHS QUESTIONS  (Q51–56)
# The DB has no written maths questions so these are defined here.
# Each uses a distinct real-world scenario at P7 SEAG level.
# ══════════════════════════════════════════════════════════════════════════════

HARDCODED_MATHS_WRITTEN = [
    {
        'question_text': (
            'A bakery bakes 24 trays of biscuits each day. '
            'Each tray holds 18 biscuits. '
            'How many biscuits does the bakery bake altogether in 5 days?'
        ),
        'passage': '',
        'correct_answer': '2,160',
        'topic': 'arithmetic',
    },
    {
        'question_text': (
            'A school raises money through a sponsored read. '
            'Each of the 425 pupils raises an average of £8. '
            'How much money is raised altogether?'
        ),
        'passage': '',
        'correct_answer': '£3,400',
        'topic': 'arithmetic',
    },
    {
        'question_text': (
            'A leisure centre swimming pool is 25 metres long. '
            'During one morning session, swimmers complete 520 lengths in total. '
            'What is the total distance swum?'
        ),
        'passage': '',
        'correct_answer': '13,000 m',
        'topic': 'measurement',
    },
    {
        'question_text': (
            'A train travels at 80 kilometres per hour. '
            'It sets off at 10:15 and arrives at its destination at 12:45. '
            'How far has the train travelled?'
        ),
        'passage': '',
        'correct_answer': '200 km',
        'topic': 'measurement',
    },
    {
        'question_text': (
            'At a school sports day, three teams compete. '
            'Team A scores 347 points, Team B scores 285 points '
            'and Team C scores 419 points. '
            'What is the total number of points scored altogether?'
        ),
        'passage': '',
        'correct_answer': '1,051',
        'topic': 'arithmetic',
    },
    {
        'question_text': (
            'A garden centre sells bags of compost. '
            'Each bag costs £6.75. '
            'A gardener buys 8 bags. '
            'How much does he pay in total?'
        ),
        'passage': '',
        'correct_answer': '£54',
        'topic': 'arithmetic',
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# PAPER ASSEMBLY  (fetch + select questions for one full paper)
# ══════════════════════════════════════════════════════════════════════════════

def fetch_paper_data(supabase_url, service_key, year_group='P7', paper_num=1, seed=None):
    """
    Fetch one complete paper's worth of questions from Supabase and return a
    structured dict ready for build_test().

    Sections pulled:
        punctuation  — 5 questions (segment style, A/B/C/D/N)
        grammar      — 5 questions (word-box style, A/B/C/D/E)
        spelling     — 5 questions (segment style, A/B/C/D/N)
        comp_mc      — 7 questions from one passage (MC, A/B/C/D/E)
        comp_written — 6 questions from same passage (written)
        maths_mc     — 22 questions across maths topics (MC)
        maths_written— 6 questions from maths topics (written)
    """
    rng = _random.Random(seed)

    def pick(rows, n, label):
        if len(rows) < n:
            raise ValueError(
                f'Not enough {label} questions for {year_group}.\n'
                f'  Need {n}, found {len(rows)}.\n'
                f'  Run the question seeder to add more.'
            )
        return rng.sample(rows, n)

    mc_base = (
        f'validated=eq.true'
        f'&year_group=eq.{year_group}'
        f'&question_type=in.(mc,Multiple_Choice)'
        f'&select=id,question_text,options,correct_answer,passage,passage_id,topic'
    )
    wr_base = (
        f'validated=eq.true'
        f'&year_group=eq.{year_group}'
        f'&question_type=eq.written'
        f'&select=id,question_text,correct_answer,passage,passage_id,topic'
    )

    other_yg = 'P6' if year_group == 'P7' else 'P7'

    def fetch_mc(topic, n_needed=1):
        rows = sb_get(supabase_url, service_key, 'questions', mc_base + f'&topic=eq.{topic}')
        if len(rows) < n_needed:
            alt = mc_base.replace(f'year_group=eq.{year_group}', f'year_group=eq.{other_yg}')
            extra = sb_get(supabase_url, service_key, 'questions', alt + f'&topic=eq.{topic}')
            seen = {r['id'] for r in rows}
            rows += [r for r in extra if r['id'] not in seen]
        return rows

    def fetch_wr(topic, n_needed=1):
        rows = sb_get(supabase_url, service_key, 'questions', wr_base + f'&topic=eq.{topic}')
        if len(rows) < n_needed:
            alt = wr_base.replace(f'year_group=eq.{year_group}', f'year_group=eq.{other_yg}')
            extra = sb_get(supabase_url, service_key, 'questions', alt + f'&topic=eq.{topic}')
            seen = {r['id'] for r in rows}
            rows += [r for r in extra if r['id'] not in seen]
        return rows

    print(f'  Fetching punctuation...')
    punc_rows  = fetch_mc('punctuation', 5)
    punc_qs    = pick(punc_rows, 5, 'punctuation')

    print(f'  Fetching grammar...')
    gram_rows  = fetch_mc('grammar', 5)
    gram_qs    = pick(gram_rows, 5, 'grammar')

    print(f'  Fetching spelling...')
    spell_rows = fetch_mc('spelling', 5)
    spell_qs   = pick(spell_rows, 5, 'spelling')

    # ── Comprehension ────────────────────────────────────────────────────────
    print(f'  Fetching comprehension questions...')
    comp_mc_rows = fetch_mc('comprehension_mc', 7)
    comp_wr_rows = fetch_wr('comprehension_written', 6)

    # Group by passage_id to find passages with enough questions
    mc_by_pid  = defaultdict(list)
    wr_by_pid  = defaultdict(list)
    for r in comp_mc_rows:
        if r.get('passage_id'):
            mc_by_pid[r['passage_id']].append(r)
    for r in comp_wr_rows:
        if r.get('passage_id'):
            wr_by_pid[r['passage_id']].append(r)

    valid_pids = [
        pid for pid in mc_by_pid
        if len(mc_by_pid[pid]) >= 7 and len(wr_by_pid.get(pid, [])) >= 6
    ]
    if not valid_pids:
        raise ValueError(
            f'No comprehension passage found with 7+ MC and 6+ written questions for {year_group}.\n'
            f'  MC passages: {dict((p, len(qs)) for p, qs in mc_by_pid.items())}\n'
            f'  Written passages: {dict((p, len(qs)) for p, qs in wr_by_pid.items())}'
        )

    passage_id   = rng.choice(valid_pids)
    comp_mc_qs   = rng.sample(mc_by_pid[passage_id], 7)
    comp_wr_qs   = rng.sample(wr_by_pid[passage_id], 6)

    # Fetch the passage text
    print(f'  Fetching passage text (id: {passage_id[:8]}...)...')
    passage_rows = sb_get(supabase_url, service_key, 'passages',
                          f'id=eq.{passage_id}&select=*')

    if passage_rows:
        passage_title, passage_text = get_passage_text(passage_rows[0])
    else:
        # Fall back: some rows may carry the passage text inline
        fallback = next((r for r in comp_mc_rows if r.get('passage_id') == passage_id), {})
        passage_text  = fallback.get('passage', '')
        passage_title = 'Reading Passage'
        print('  [warn] Passage not found in passages table — using inline passage field')

    # ── Maths MC (22 questions) ───────────────────────────────────────────────
    # Distribution mirrors the online mock format
    maths_mc_spec = [
        ('arithmetic',       7),
        ('geometry',         7),
        ('fractions_decimals', 4),
        ('measurement',      2),
        ('statistics',       2),
    ]
    maths_mc_qs = []
    for topic, count in maths_mc_spec:
        print(f'  Fetching maths MC: {topic} ({count})...')
        rows = fetch_mc(topic, count)
        maths_mc_qs.extend(pick(rows, count, f'{topic} MC'))

    # ── Maths Written (6 questions) — hardcoded varied real-world scenarios ────
    # Q51–56 use fixed questions since the DB has no written maths questions.
    # Shuffled by the paper seed so ordering varies across different papers.
    print(f'  Using hardcoded written maths questions (Q51–56)...')
    maths_wr_qs = list(HARDCODED_MATHS_WRITTEN)
    rng.shuffle(maths_wr_qs)

    return {
        'year_group':    year_group,
        'paper_num':     paper_num,
        'seed':          seed,
        'punctuation':   punc_qs,
        'grammar':       gram_qs,
        'spelling':      spell_qs,
        'passage_id':    passage_id,
        'passage_title': passage_title,
        'passage_text':  passage_text,
        'comp_mc':       comp_mc_qs,
        'comp_written':  comp_wr_qs,
        'maths_mc':      maths_mc_qs,
        'maths_written': maths_wr_qs,
    }


# ══════════════════════════════════════════════════════════════════════════════
# UNIT HINTS  (for written maths answer boxes)
# ══════════════════════════════════════════════════════════════════════════════

UNIT_HINTS = {
    'written_kg':   'kg',
    'written_mins': 'minutes',
    'written_m':    'm',
    'written_km':   'km',
    'written_p':    'p',
    'written_gbp':  '£',
    'written':      '',
}


# ══════════════════════════════════════════════════════════════════════════════
# MAIN BUILD
# ══════════════════════════════════════════════════════════════════════════════

def build_test(path, paper_data):
    """
    Build the question paper PDF from paper_data (returned by fetch_paper_data).
    """
    year_group = paper_data.get('year_group', 'P7')
    paper_num  = paper_data.get('paper_num', 1)

    # ── Convert DB rows to renderer formats ───────────────────────────────────
    punc_qs  = [q_to_segments(q) for q in paper_data['punctuation']]
    gram_qs  = [q_to_wordbox(q)  for q in paper_data['grammar']]
    spell_qs = [q_to_segments(q) for q in paper_data['spelling']]

    passage_title = paper_data['passage_title']
    passage_paras = split_passage(paper_data['passage_text'])

    comp_mc_qs = [q_to_comp_mc(q)  for q in paper_data['comp_mc']]
    comp_fr_qs = [(q.get('question_text') or '') for q in paper_data['comp_written']]

    maths_qs = []
    for q in paper_data['maths_mc']:
        ctx, quest, opts = q_to_maths_mc(q)
        # Prepend context to question text so draw_mc_list renders both
        full_q = (ctx + ' ' + quest).strip() if ctx else quest
        maths_qs.append((ctx, full_q, opts, 'mc'))
    for q in paper_data['maths_written']:
        ctx, quest, unit_key = q_to_maths_written(q)
        full_q = (ctx + ' ' + quest).strip() if ctx else quest
        maths_qs.append((ctx, full_q, None, unit_key))

    # ── Build PDF ─────────────────────────────────────────────────────────────
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle(f'STAR AI Tutor — Practice Paper {paper_num} ({year_group})')
    c.setAuthor('STAR AI Tutor')

    # ── Cover ─────────────────────────────────────────────────────────────────
    draw_cover(c, paper_num=paper_num, year_group=year_group)
    page = [1]

    # ── Practice Questions (P1–P10) ───────────────────────────────────────────
    c.showPage()
    page[0] += 1
    draw_page_border(c)
    y = draw_section_title(c, 'Practice Questions')

    y = draw_instruction(c,
        [("Work through P1–P10 to practise filling in your answers. ", False),
         ("These questions ", False), ("do not", True),
         (" count towards your score. ", False),
         ("Read each question carefully before answering.", False)],
        y)
    y -= 4

    # ── English Practice header ────────────────────────────────────────────────
    c.saveState()
    c.setFillColor(HexColor('#EEF4FF'))
    c.setStrokeColor(TEAL)
    c.setLineWidth(0.8)
    c.roundRect(TEXT_L, y - 20, TEXT_W, 20, radius=3, stroke=1, fill=1)
    c.setFont(BOLD, 11)
    c.setFillColor(TEAL)
    c.drawCentredString(PAGE_W / 2, y - 14, 'English Practice  (P1–P5)')
    c.restoreState()
    y -= 30

    # P1 — Punctuation
    y = wrap_text(c,
        'P1.  Each line is divided into four groups (A–D). Find the group with a '
        'capitalisation or punctuation mistake and mark its letter on your answer sheet. '
        'Mark N if there is no mistake.',
        BOLD, 9.5, TEXT_L, y, TEXT_W, 13)
    y -= 8
    y = draw_segment_question(c, 'P1',
        ['We went to', 'london for', 'the weekend', 'last July.'],
        y, page, has_n=True)

    # P2 — Grammar
    y = wrap_text(c,
        'P2.  Choose the best word to complete the sentence. Mark its letter.',
        BOLD, 9.5, TEXT_L, y, TEXT_W, 13)
    y -= 8
    y = draw_wordbox_question(c, 'P2',
        'She danced ___',
        ['slow', 'quiet', 'gentle', 'quickly', 'softer'],
        'across the stage.',
        y, page)

    # P3 — Spelling
    y = wrap_text(c,
        'P3.  Find the group that contains a spelling mistake. Mark N if there is no mistake.',
        BOLD, 9.5, TEXT_L, y, TEXT_W, 13)
    y -= 8
    y = draw_segment_question(c, 'P3',
        ['I beleive', 'that we', 'should try', 'our best.'],
        y, page, has_n=True)

    # P4 — Comprehension MC
    y = wrap_text(c,
        'P4.  Read the sentence below. Choose the best word to complete it and '
        'mark its letter.',
        BOLD, 9.5, TEXT_L, y, TEXT_W, 13)
    y -= 8
    y = draw_mc_list(c, 'P4',
        '"The story was exciting. The ending, _______, was disappointing." '
        'Which word best completes the sentence?',
        ['therefore', 'because', 'however', 'although', 'meanwhile'],
        y, page)

    # P5 — Written
    y = wrap_text(c,
        'P5.  Write your answer clearly in the box provided.',
        BOLD, 9.5, TEXT_L, y, TEXT_W, 13)
    y -= 8
    y = draw_written_question(c, 'P5',
        'Copy the sentence below, adding the missing capital letter: '
        '"the cat sat on the mat."',
        y, page)

    draw_footer(c, page[0])

    # ── Maths practice (P6–P10) ──────────────────────────────────────────────
    c.showPage()
    page[0] += 1
    draw_page_border(c)
    y = CONTENT_TOP

    c.saveState()
    c.setFillColor(HexColor('#EEF4FF'))
    c.setStrokeColor(TEAL)
    c.setLineWidth(0.8)
    c.roundRect(TEXT_L, y - 20, TEXT_W, 20, radius=3, stroke=1, fill=1)
    c.setFont(BOLD, 11)
    c.setFillColor(TEAL)
    c.drawCentredString(PAGE_W / 2, y - 14, 'Maths Practice  (P6–P10)')
    c.restoreState()
    y -= 30

    y = draw_instruction(c,
        [("For P6–P8, choose the correct answer and mark its letter. ", False),
         ("For P9–P10, write your answer in the box.", False)],
        y)
    y -= 4

    y = draw_mc_list(c, 'P6',
        'What is 4 × 6?',
        ['20', '24', '28', '30', '36'],
        y, page)

    y = draw_mc_list(c, 'P7',
        'A film starts at 3:45 pm and lasts 90 minutes. At what time does it end?',
        ['4:45 pm', '5:00 pm', '5:10 pm', '5:15 pm', '5:30 pm'],
        y, page)

    y = draw_mc_list(c, 'P8',
        'Tom has £2.00. He spends 95p. How much does he have left?',
        ['£1.05', '£1.10', '£1.15', '£1.00', '£0.95'],
        y, page)

    y = draw_written_question(c, 'P9',
        'How many days are there in a fortnight?',
        y, page, unit_hint='Answer in days')

    y = draw_written_question(c, 'P10',
        'A rectangle is 9 cm long and has a perimeter of 27 cm. What is its width?',
        y, page, unit_hint='Answer in cm')

    draw_footer(c, page[0])

    # ── English section title + Punctuation ───────────────────────────────────
    c.showPage()
    page[0] += 1
    draw_page_border(c)
    y = draw_section_title(c, 'English – Main Test')

    y = draw_instruction(c,
        [("In this exercise there are some mistakes with ", False),
         ("punctuation", True), (" or use of ", False),
         ("capital letters", True),
         (". On each numbered line there is either ", False),
         ("one", True), (" mistake or ", False), ("no", True),
         (" mistake. Find the group of words with the mistake in it and ", False),
         ("mark its letter on your answer sheet", True), (".", False)],
        y, extra_bold_line='If there is no mistake, mark N.')

    c.setFont(BOLD, 14)
    c.setFillColor(BODY_DARK)
    c.drawString(TEXT_L, y, 'Punctuation Exercise')
    y -= 20

    for i, segs in enumerate(punc_qs, start=1):
        y = draw_segment_question(c, i, segs, y, page, has_n=True)

    draw_footer(c, page[0])

    # ── Grammar ───────────────────────────────────────────────────────────────
    c.showPage()
    page[0] += 1
    draw_page_border(c)
    y = CONTENT_TOP

    y = draw_instruction(c,
        [("In this exercise you have to choose the ", False),
         ("best", True), (" word, or group of words, to complete each numbered line ", False),
         ("so that the passage makes sense and is written in correct English. ", False),
         ("Choose the best answer and ", False), ("mark its letter on your answer sheet", True),
         (".", False)],
        y)

    c.setFont(BOLD, 14)
    c.setFillColor(BODY_DARK)
    c.drawString(TEXT_L, y, 'Grammar Exercise')
    y -= 20

    for i, (before, words, after) in enumerate(gram_qs, start=6):
        y = draw_wordbox_question(c, i, before, words, after, y, page)

    draw_footer(c, page[0])

    # ── Spelling ──────────────────────────────────────────────────────────────
    c.showPage()
    page[0] += 1
    draw_page_border(c)
    y = CONTENT_TOP

    y = draw_instruction(c,
        [("In this exercise there are some ", False), ("spelling", True),
         (" mistakes. On each numbered line there is either ", False),
         ("one", True), (" mistake or ", False), ("no", True),
         (" mistake. Find the group of words with the mistake in it and ", False),
         ("mark its letter on your answer sheet", True), (". ", False),
         ("If there is no mistake, mark N.", True)],
        y)

    c.setFont(BOLD, 14)
    c.setFillColor(BODY_DARK)
    c.drawString(TEXT_L, y, 'Spelling Exercise')
    y -= 20

    for i, segs in enumerate(spell_qs, start=11):
        y = draw_segment_question(c, i, segs, y, page, has_n=True)

    draw_footer(c, page[0])

    # ── Comprehension passage ─────────────────────────────────────────────────
    c.showPage()
    page[0] += 1
    draw_page_border(c)
    y = CONTENT_TOP

    y = draw_passage(c, passage_title, passage_paras, y, page)

    if y < FOOTER_Y + 30:
        draw_footer(c, page[0])
        y = new_page(c, page)

    draw_footer(c, page[0])

    # ── Comprehension MC ──────────────────────────────────────────────────────
    c.showPage()
    page[0] += 1
    draw_page_border(c)
    y = CONTENT_TOP

    c.setFont(BODY, 10.5)
    c.setFillColor(BODY_DARK)
    draw_mixed_bold(c,
        [("Please answer these questions. (Look at the passage again if you need to.) ", False),
         ("You should choose the ", False), ("best", True),
         (" answer and mark its letter on your answer sheet.", False)],
        TEXT_L, y)
    y -= 22

    for i, (q, opts) in enumerate(comp_mc_qs, start=16):
        y = draw_mc_list(c, i, q, opts, y, page)

    draw_footer(c, page[0])

    # ── Comprehension Written ─────────────────────────────────────────────────
    c.showPage()
    page[0] += 1
    draw_page_border(c)
    y = CONTENT_TOP

    c.setFont(BODY, 10.5)
    c.setFillColor(BODY_DARK)
    c.drawString(TEXT_L, y,
        'For these questions, write your answers neatly in the boxes provided on your answer sheet.')
    y -= 22

    for i, q in enumerate(comp_fr_qs, start=23):
        y = draw_written_question(c, i, q, y, page)

    draw_footer(c, page[0], last=True, end_label='English Main Test')

    # ── Maths ─────────────────────────────────────────────────────────────────
    c.showPage()
    page[0] += 1
    draw_page_border(c)
    y = draw_section_title(c, 'Maths – Main Test')

    q_num = 29
    for ctx, q_text, opts, qtype in maths_qs:
        if qtype == 'mc':
            y = draw_mc_list(c, q_num, q_text, opts or [], y, page, bold_q=True)
        else:
            unit = UNIT_HINTS.get(qtype, '')
            unit_str = f'Answer in {unit}' if unit else ''
            y = draw_written_question(c, q_num, q_text, y, page, unit_hint=unit_str)
        q_num += 1
        if q_num > 56:
            break

    draw_footer(c, page[0], last=True, end_label='Maths Main Test')

    c.save()
    print(f'Saved: {path}  ({page[0]} pages)')

    # Return answer key data (correct_answer per question number) for the
    # answer sheet generator — maps q_num → correct_answer letter
    answer_key = {}
    for i, q in enumerate(paper_data['punctuation'],  start=1):  answer_key[i]    = q.get('correct_answer', '')
    for i, q in enumerate(paper_data['grammar'],      start=6):  answer_key[i]    = q.get('correct_answer', '')
    for i, q in enumerate(paper_data['spelling'],     start=11): answer_key[i]    = q.get('correct_answer', '')
    for i, q in enumerate(paper_data['comp_mc'],      start=16): answer_key[i]    = q.get('correct_answer', '')
    for i, q in enumerate(paper_data['comp_written'], start=23): answer_key[i]    = q.get('correct_answer', '')
    for i, q in enumerate(paper_data['maths_mc'] + paper_data['maths_written'], start=29):
        answer_key[i] = q.get('correct_answer', '')

    return answer_key


# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import sys

    # Allow sibling import regardless of working directory
    _here = os.path.dirname(os.path.abspath(__file__))
    if _here not in sys.path:
        sys.path.insert(0, _here)
    from answer_sheet_v2 import build_from_paper_data

    year_group = sys.argv[1] if len(sys.argv) > 1 else 'P7'
    paper_num  = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    seed       = int(sys.argv[3]) if len(sys.argv) > 3 else None

    if year_group not in ('P6', 'P7'):
        print(f'Error: year_group must be P6 or P7, got "{year_group}"')
        sys.exit(1)

    print(f'STAR AI Tutor — generating Practice Paper {paper_num} ({year_group})')
    if seed is not None:
        print(f'  Seed: {seed}  (reproducible selection)')

    supabase_url, service_key = load_env()
    print(f'  Supabase: {supabase_url}')

    print('Fetching questions from Supabase...')
    paper_data = fetch_paper_data(supabase_url, service_key, year_group, paper_num, seed)

    print(f'\nQuestion counts:')
    print(f'  Punctuation:         {len(paper_data["punctuation"])}')
    print(f'  Grammar:             {len(paper_data["grammar"])}')
    print(f'  Spelling:            {len(paper_data["spelling"])}')
    print(f'  Comprehension MC:    {len(paper_data["comp_mc"])}')
    print(f'  Comprehension Writ.: {len(paper_data["comp_written"])}')
    print(f'  Maths MC:            {len(paper_data["maths_mc"])}')
    print(f'  Maths Written:       {len(paper_data["maths_written"])}')
    print(f'  Passage:             {paper_data["passage_title"]}')
    print()

    out_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'output'))
    os.makedirs(out_dir, exist_ok=True)

    base      = f'STAR_Practice_Paper_{paper_num}_{year_group}'
    out_path  = os.path.join(out_dir, f'{base}.pdf')
    sheet_path = os.path.join(out_dir, f'{base}_AnswerSheet.pdf')
    key_path   = os.path.join(out_dir, f'{base}_AnswerKey.pdf')

    # 1. Question paper
    answer_key = build_test(out_path, paper_data)

    # 2. Blank pupil answer sheet
    print('\nGenerating answer sheet...')
    build_from_paper_data(paper_data, answer_key, sheet_path, paper_num, is_key=False)

    # 3. Parent answer key (correct answers in green)
    print('Generating parent answer key...')
    build_from_paper_data(paper_data, answer_key, key_path, paper_num, is_key=True)

    print(f'\nAll 3 files written to: {out_dir}')
    print(f'  {os.path.basename(out_path)}')
    print(f'  {os.path.basename(sheet_path)}')
    print(f'  {os.path.basename(key_path)}')

    print(f'\nAnswer key (Q1–56):')
    for qn in sorted(answer_key):
        ans = answer_key[qn]
        if ans:
            print(f'  Q{qn:02d}: {ans}')
