#!/usr/bin/env python3
"""OutSkill new-joiner -> sales-ready user journey, as a multi-sheet Excel file."""

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ----------------------------------------------------------------- styles
NAVY   = "1F3864"
BLUE   = "2E75B6"
GREEN  = "E2EFDA"
ORANGE = "FCE4D6"
YELLOW = "FFF2CC"
GREY   = "F2F2F2"

TITLE_FILL  = PatternFill("solid", fgColor=NAVY)
HEAD_FILL   = PatternFill("solid", fgColor=BLUE)
fills = {"a": PatternFill("solid", fgColor=GREEN),
         "b": PatternFill("solid", fgColor=ORANGE),
         "g": PatternFill("solid", fgColor=GREY),
         "y": PatternFill("solid", fgColor=YELLOW)}

TITLE_FONT = Font(bold=True, color="FFFFFF", size=16)
SUB_FONT   = Font(italic=True, color="FFFFFF", size=10)
HEAD_FONT  = Font(bold=True, color="FFFFFF", size=11)
CELL_FONT  = Font(size=10)
BOLD_FONT  = Font(bold=True, size=10)

thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
WRAP = Alignment(wrap_text=True, vertical="top", horizontal="left")
CTR  = Alignment(wrap_text=True, vertical="center", horizontal="center")

wb = Workbook()


def title_block(ws, title, subtitle, ncols):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ncols)
    c = ws.cell(row=1, column=1, value=title)
    c.font, c.fill, c.alignment = TITLE_FONT, TITLE_FILL, CTR
    ws.row_dimensions[1].height = 30
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=ncols)
    c = ws.cell(row=2, column=1, value=subtitle)
    c.font, c.fill, c.alignment = SUB_FONT, TITLE_FILL, CTR
    ws.row_dimensions[2].height = 18


def header_row(ws, headers, row=4):
    for i, h in enumerate(headers, 1):
        c = ws.cell(row=row, column=i, value=h)
        c.font, c.fill, c.alignment, c.border = HEAD_FONT, HEAD_FILL, CTR, BORDER
    ws.row_dimensions[row].height = 28


def write_rows(ws, rows, start, bold_cols=(0,), heights=None):
    for r, row in enumerate(rows):
        rr = start + r
        tone = row[-1]
        data = row[:-1]
        for c, val in enumerate(data):
            cell = ws.cell(row=rr, column=c + 1, value=val)
            cell.fill = fills[tone]
            cell.border = BORDER
            cell.alignment = WRAP
            cell.font = BOLD_FONT if c in bold_cols else CELL_FONT
        ws.row_dimensions[rr].height = (heights[r] if heights else 60)


def widths(ws, ws_widths):
    for i, w in enumerate(ws_widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


# ================================================================ SHEET 1: SNAPSHOT
s1 = wb.active
s1.title = "1. Journey Snapshot"
title_block(s1, "OutSkill Training Journey — In Short",
            "Day 1 (new joiner)  ->  Sales Ready  ->  On-ground real work | one line per stage", 5)
header_row(s1, ["Stage", "Stage Name", "When (Timeline)", "In Short", "App Section"])

snap = [
    ["Stage 0", "Sign up / Log in", "Day 1 (first 10 min)",
     "Joiner logs in with company email; profile created; personalised dashboard shows the locked journey map.",
     "cover + auth", "g"],
    ["Stage 1", "Company Foundations", "Day 1",
     "What is OutSkill (edtech selling AI courses) + the 3-tier funnel (TOFU/MOFU/BOFU) + the two mastermind tracks.",
     "(new)", "a"],
    ["Stage 2", "Mastermind Immersion", "Days 2-5",
     "Watch the recent Generalist + Engineering mastermind recordings to learn HOW we pitch the Accelerator.",
     "(new)", "a"],
    ["Stage 3", "Department Overview", "Day 5-6",
     "See what Sales / Marketing / Operations do, then pick your track (Inside Sales).",
     "dept", "a"],
    ["Stage 4", "Sales Knowledge", "Week 1-2",
     "Everything a rep must KNOW: accelerator details, pricing & EMI, how we get data, the pitch framework, tools.",
     "home / salesuccess", "b"],
    ["Stage 5", "Mock-Call Ladder", "Week 2+ (until ready)",
     "Unlimited practice calls, gated by score: Peer -> Senior -> Utmost Senior -> Manager -> Management -> Director.",
     "practice", "b"],
    ["Stage 6", "Sales Ready -> Real Work", "On certification",
     "Pass the Director round -> 'Sales Ready' badge -> unlock real calls, reports & follow-ups (on-ground work).",
     "salesuccess + realcall/reports/followups", "y"],
]
write_rows(s1, snap, 5, bold_cols=(0, 1),
           heights=[40, 48, 40, 40, 48, 48, 48])
widths(s1, [10, 22, 18, 60, 30])
s1.freeze_panes = "A5"


# ================================================================ SHEET 2: STEP BY STEP (DETAILED)
s2 = wb.create_sheet("2. Step-by-Step (Detailed)")
title_block(s2, "OutSkill Training Journey — Step by Step (Full Explanation)",
            "Every step from Day 1 to on-ground work: what the joiner does, the detailed why, and what unlocks next", 7)
header_row(s2, ["Stage", "Step", "Timeline", "What the Joiner Does",
                "Detailed Explanation", "Unlocks Next When", "App Section"])

steps = [
    # Stage 0
    ["Stage 0\nAccess & Identity", "0.1 Landing / Cover", "Day 1",
     "Opens the platform; sees what it is; clicks 'Start onboarding'.",
     "The cover page introduces the platform as the self-serve replacement for the day-1 senior presentations and training calls.",
     "Clicks Start.", "cover", "g"],
    ["Stage 0\nAccess & Identity", "0.2 Sign up / Log in", "Day 1",
     "Signs up / logs in with COMPANY email (@outskill.com only).",
     "Restricting to the company domain keeps it internal. Captures name, joining date and role (New Joiner / Senior-Trainer / Manager / Admin). Roles matter later: seniors/managers can play the customer in higher mock-call rounds and view scorecards.",
     "Email verified.", "auth (new)", "g"],
    ["Stage 0\nAccess & Identity", "0.3 Personalised Dashboard", "Day 1",
     "Lands on a dashboard = the journey map, everything locked except Stage 1.",
     "The dashboard always surfaces the SINGLE next action and remembers progress, so a returning joiner resumes exactly where they left off.",
     "Account ready -> Stage 1 opens.", "dashboard (new)", "g"],
    # Stage 1
    ["Stage 1\nCompany Foundations", "1.1 What is OutSkill", "Day 1",
     "Reads/watches: who we are.",
     "OutSkill is an edtech company that SELLS AI courses. This is the same 'what does this company do' intro seniors used to give live.",
     "—", "Foundations (new)", "a"],
    ["Stage 1\nCompany Foundations", "1.2 The Products", "Day 1",
     "Learns the product line.",
     "Bootcamp (low ticket), ACCELERATOR (14-day, high ticket, the MAIN product), and Fellowship & Catalyst (6-month programs).",
     "—", "Foundations (new)", "a"],
    ["Stage 1\nCompany Foundations", "1.3 The Funnel", "Day 1",
     "Learns the 3-tier funnel + the rules.",
     "TOFU = Mastermind + Bootcamp; MOFU = Accelerator (14-day); BOFU = Catalyst + Fellowship (6-month). Audience flows: Marketing campaigns -> TOFU -> Accelerator -> BOFU. Rules: Catalyst can't be joined directly (need Accelerator OR Fellowship first); both Accelerator & Fellowship are attendable straight after a mastermind (sometimes Mastermind -> Bootcamp -> Accelerator).",
     "—", "Foundations (new)", "a"],
    ["Stage 1\nCompany Foundations", "1.4 The two Masterminds", "Day 1",
     "Learns the two free weekend workshops.",
     "Generalist Mastermind (Sat/Sun, non-technical) vs Engineering Mastermind (Fri/Sat, technical / Python background). Each runs ~12-14 hrs and is where we pitch Bootcamp + Accelerator.",
     "Funnel knowledge check passed -> Stage 2.", "Foundations (new)", "a"],
    # Stage 2
    ["Stage 2\nMastermind Immersion", "2.1 Generalist recording", "Days 2-3",
     "Watches the recent Generalist mastermind recording (chunked into modules).",
     "The 12-14 hrs are split into watchable sections with key-takeaway notes and 'what was pitched / how it was framed' annotations, so the joiner learns the real pitch.",
     "Track watched + quick check.", "Mastermind player (new)", "a"],
    ["Stage 2\nMastermind Immersion", "2.2 Engineering recording", "Days 4-5",
     "Watches the Engineering mastermind recording (chunked).",
     "Same treatment for the technical track, so the joiner can recognise which prospect should be routed to Engineering vs Generalist.",
     "Both tracks + checks done -> Stage 3.", "Mastermind player (new)", "a"],
    # Stage 3
    ["Stage 3\nDepartment Overview", "3.1 Department presentations", "Day 5-6",
     "Watches short intros to Sales, Marketing, Operations.",
     "Replaces the one-by-one department presentations new joiners used to sit through, so they understand how the company fits together.",
     "—", "dept (new content)", "a"],
    ["Stage 3\nDepartment Overview", "3.2 Pick your track", "Day 6",
     "Selects Inside Sales.",
     "Enters the Sales department track. Marketing / Operations show as 'coming soon' for now.",
     "Department chosen -> Stage 4.", "dept (built)", "a"],
    # Stage 4
    ["Stage 4\nSales Knowledge", "4.1 The Sales role", "Week 1",
     "Learns who we call and the goal.",
     "We call mastermind attendees who did NOT pay in the workshop. The goal: understand their intent for attending, the outcomes they wanted, and WHY they didn't pay (money / time / doubt / no urgency) -> re-pitch the Accelerator.",
     "—", "home/salesuccess (new)", "b"],
    ["Stage 4\nSales Knowledge", "4.2 Accelerator deep dive", "Week 1",
     "Learns the product cold.",
     "14-day live program, the themes, the 48-hr buildathon, bonuses, mentors and outcomes — framed as ranges. COMPLIANCE hard-rule: never promise a job or a specific salary.",
     "—", "home/salesuccess (new)", "b"],
    ["Stage 4\nSales Knowledge", "4.3 Pricing, Payment & EMI", "Week 1",
     "Learns how learners pay.",
     "India one-time -> Razorpay; India EMI w/ credit card -> Pine Labs (zero-cost); India debit-card EMI -> Shopse (eligibility check); India NBFC route -> Fibe / Propel via Google form; International -> XP (+9% on installments). (Same as the payment-gateways sheet.)",
     "—", "home/salesuccess (new)", "b"],
    ["Stage 4\nSales Knowledge", "4.4 How we get the data", "Week 1",
     "Learns where leads come from.",
     "Mastermind attendee data (those who didn't pay) flows into the CRM and is assigned to reps.",
     "—", "home/salesuccess (new)", "b"],
    ["Stage 4\nSales Knowledge", "4.5 The Pitch Framework", "Week 1-2",
     "Learns the call structure.",
     "Open & build rapport -> discover goals -> diagnose the real blocker -> handle objections (empathy + one specific fact, confirm it landed) -> trial close -> secure a concrete next step.",
     "—", "home/salesuccess (new)", "b"],
    ["Stage 4\nSales Knowledge", "4.6 Tools & assets", "Week 1-2",
     "Learns the assets and flows.",
     "The brochure, the onboarding-call flow, and the follow-up templates the rep will use day to day.",
     "Sales knowledge check passed -> Stage 5.", "home/salesuccess (new)", "b"],
    # Stage 5
    ["Stage 5\nMock-Call Ladder", "5.1 Level 1 - Peer", "Week 2+",
     "Does mock calls vs warm/easy AI personas.",
     "Practice calls with the built-in AI customer. After each call: a 0-100 scorecard (rapport, discovery, objection-handling, close, next-step) + specific feedback + best next action.",
     "N calls at/above min score -> Level 2.", "practice (built)", "b"],
    ["Stage 5\nMock-Call Ladder", "5.2 Levels 2-5 - Senior/Manager", "Week 2+",
     "Climbs through Senior, Utmost-Senior, Manager and Management rounds.",
     "Difficulty escalates with each level (analytical, skeptical, overconfident, hidden blockers, high pressure). A real senior/manager can join in place of the AI via their role login.",
     "Each level: pass score to unlock the next.", "practice (built)", "b"],
    ["Stage 5\nMock-Call Ladder", "5.3 Level 6 - Director", "When ready",
     "Faces the hardest objections / Director round.",
     "Final and toughest round — the gate to certification.",
     "Pass Director round at threshold -> Stage 6.", "practice (built)", "b"],
    # Stage 6
    ["Stage 6\nSales Ready -> Real Work", "6.1 Certification", "On passing",
     "Earns the 'Sales Ready' badge.",
     "Logged for managers; this is a real gate, not just a page.",
     "Certified.", "salesuccess (built)", "y"],
    ["Stage 6\nSales Ready -> Real Work", "6.2 On-ground real work", "After certification",
     "Takes real calls; manages prospects.",
     "Unlocks: Real Call (live onboarding/pitch calls), Reports (scores & history), Follow-ups (share brochure, schedule next steps), Feedback wall. This is 'day on ground, ready to work'.",
     "— (journey complete)", "realcall / reports / followups (built)", "y"],
]
write_rows(s2, steps, 5, bold_cols=(0, 1),
           heights=[None] * len(steps))
widths(s2, [20, 26, 14, 34, 64, 30, 26])
s2.freeze_panes = "A5"


# ================================================================ SHEET 3: MOCK-CALL LADDER
s3 = wb.create_sheet("3. Mock-Call Ladder")
title_block(s3, "Stage 5 — Mock-Call Ladder (Score-Gated Levels)",
            "Mirrors the real-world rounds; built on the existing practice engine (10 AI personas + 0-100 scorecard)", 4)
header_row(s3, ["Level", "Real-World Round", "AI Customer Difficulty", "Example Personas"])
ladder = [
    ["Level 1", "Peer practice", "Warm / easy", "Priya, Karthik", "a"],
    ["Level 2", "Senior round", "Analytical / skeptical", "Suresh, Meera", "a"],
    ["Level 3", "Utmost senior", "Overconfident / noncommittal", "Aditya, Rahul", "a"],
    ["Level 4", "Manager round", "Hard, hidden blockers", "Vikram, Arjun", "b"],
    ["Level 5", "Management round", "Mixed, high pressure", "Custom + escalated", "b"],
    ["Level 6", "Director round", "Hardest objections", "Custom + escalated", "b"],
]
write_rows(s3, ladder, 5, bold_cols=(0,), heights=[26] * 6)
# note row
nr = 12
s3.merge_cells(start_row=nr, start_column=1, end_row=nr, end_column=4)
c = s3.cell(row=nr, column=1,
            value="Rule: each level requires N calls at or above a minimum score to unlock the next. "
                  "Passing the Director round = 'Sales Ready' certification.")
c.font, c.fill, c.alignment = CELL_FONT, fills["y"], WRAP
s3.row_dimensions[nr].height = 30
widths(s3, [12, 22, 30, 28])
s3.freeze_panes = "A5"


out = "/home/user/outskill-garvit-/OutSkill_User_Journey.xlsx"
wb.save(out)
print("Saved:", out)
