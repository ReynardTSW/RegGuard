import datetime
import math
import re
import io
import html
from typing import List, Tuple, Dict, Any

from app.schemas import RegulationItem

try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except Exception:
    WEASYPRINT_AVAILABLE = False

def _escape_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

# Stakeholder profiles for scoring relevance
STAKEHOLDER_PROFILES = [
    ("Compliance Analysts", ["shall", "must", "regulation", "obligation", "section", "chapter", "compliance"]),
    ("Data Protection Officers", ["personal data", "controller", "processor", "consent", "notice", "retention", "transfer", "data protection", "dpo"]),
    ("IT Auditors", ["security", "access", "audit", "log", "encryption", "system", "technical", "controls", "monitor"]),
    ("GRC Consultants", ["risk", "governance", "policy", "framework", "assessment", "control", "scope", "gap analysis"]),
]


def _compute_stakeholders(items: List[RegulationItem]) -> List[Tuple[str, int]]:
    corpus = " ".join([i.text for i in items]).lower()
    scores = []
    for name, keywords in STAKEHOLDER_PROFILES:
        score = 0
        for kw in keywords:
            score += corpus.count(kw.lower())
        scores.append((name, score))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores


def _percent(part: int, total: int) -> int:
    return int(round((part / total) * 100)) if total else 0


def _count_rule_hits(items: List[RegulationItem], rule: dict) -> int:
    keyword = (rule.get("keyword") or "").lower().strip()
    if not keyword:
        return 0
    match_type = (rule.get("match_type") or "contains").lower()
    cnt = 0
    for item in items:
        text = (item.text or "").lower()
        if match_type == "exact":
            if text.strip() == keyword:
                cnt += 1
        elif match_type == "startswith":
            if text.strip().startswith(keyword):
                cnt += 1
        elif match_type == "regex":
            try:
                if re.search(rule.get("keyword", ""), item.text or "", re.IGNORECASE):
                    cnt += 1
            except re.error:
                continue
        else:
            if keyword in text:
                cnt += 1
    return cnt


def _render_html(filename: str, items: List[RegulationItem], detection_rules: list = None, tasks_data: Dict[str, Any] = None) -> str:
    now = datetime.datetime.now().strftime("%d %B %Y, %I:%M %p")

    def count_by_sev(item_list: List[RegulationItem]):
        hi = med = lo = 0
        for i in item_list:
            sev = (i.severity or "").lower()
            cat = (i.category or "").upper()
            if sev == "high" or cat in ("HIGH", "CRITICAL"):
                hi += 1
            elif sev == "medium" or cat == "MEDIUM":
                med += 1
            elif sev == "low" or cat == "LOW":
                lo += 1
        return hi, med, lo

    total = len(items)
    high, medium, low = count_by_sev(items)
    high_pct = _percent(high, total)
    medium_pct = _percent(medium, total)
    low_pct = _percent(low, total)

    manual_hours_baseline = 8.8 if total >= 200 else 4.5
    manual_hours_calc = max(manual_hours_baseline, (total * 2.2) / 60)
    auto_minutes = max(1, min(5, math.ceil(total / 50)))
    time_saved_hours = max(0, manual_hours_calc - (auto_minutes / 60))
    hourly_rate = 100
    value_saved = int(time_saved_hours * hourly_rate)

    stakeholders = _compute_stakeholders(items)
    high_items = sorted(
        [i for i in items if (i.severity or "").lower() == "high" or (i.category or "").upper() == "CRITICAL"],
        key=lambda r: getattr(r, "score", 0),
        reverse=True,
    )
    sample_high = high_items[:3]

    medium_items = sorted(
        [i for i in items if (i.severity or "").lower() == "medium" or (i.category or "").upper() == "MEDIUM"],
        key=lambda r: getattr(r, "score", 0),
        reverse=True,
    )
    sample_medium = medium_items[:3]

    applied_rules = []
    for r in (detection_rules or []):
        if not r.get("enabled", True):
            continue
        hits = _count_rule_hits(items, r)
        applied_rules.append((html.escape(r.get("keyword") or "?"), html.escape(r.get("severity") or "Unknown"), hits))

    # Tasks / workflow extraction
    columns = (tasks_data or {}).get("columns") if tasks_data else {}
    steps_by_rule = (tasks_data or {}).get("steps") if tasks_data else {}

    def _collect_tasks(columns_dict, target_keys):
        collected = []
        if not isinstance(columns_dict, dict):
            return collected
        for key in target_keys:
            for rule in (columns_dict.get(key) or []):
                # rule can be dict or model; normalize
                rid = getattr(rule, "control_id", None) or (rule.get("control_id") if isinstance(rule, dict) else "")
                if isinstance(rule, dict):
                    rdict = dict(rule)
                elif hasattr(rule, "model_dump"):
                    rdict = rule.model_dump()
                elif hasattr(rule, "dict"):
                    rdict = rule.dict()
                else:
                    rdict = {}
                rdict["__steps"] = steps_by_rule.get(rid, []) if isinstance(steps_by_rule, dict) else []
                collected.append(rdict)
        return collected

    in_progress_rules = _collect_tasks(columns, ["in-progress"])
    later_rules = _collect_tasks(columns, ["completed-later"])

    def _render_steps(step_list):
        if not step_list:
            return "<div class='muted'>No tasks captured.</div>"
        priority_rank = {"high": 0, "medium": 1, "low": 2}
        status_rank = {"todo": 0, "later": 1, "done": 2, "cancelled": 3}
        status_label = {
            "todo": "To do",
            "later": "Later date",
            "done": "Done",
            "cancelled": "Cancelled",
        }
        ordered = sorted(
            step_list,
            key=lambda s: (
                status_rank.get((s.get("status") or "").lower(), 5),
                priority_rank.get((s.get("priority") or "").lower(), 3),
            ),
        )
        items_html = []
        for st in ordered:
            status_raw = (st.get("status") or "").lower()
            status = status_label.get(status_raw, (st.get("status") or "Todo").title())
            text = html.escape(st.get("text") or "")
            due = st.get("dueDate") or st.get("due_date") or ""
            prio = (st.get("priority") or "low").lower()
            assignee = html.escape(st.get("assignee") or "")
            comment = html.escape(st.get("comment") or "")
            is_done = status_raw == "done"
            if prio == "high":
                badge = "<span class='pill pill-high'>High</span>"
            elif prio == "medium":
                badge = "<span class='pill pill-medium'>Med</span>"
            else:
                badge = "<span class='pill pill-low'>Low</span>"
            if status_raw in ["todo", "later"]:
                status_badge = "<span class='pill pill-medium'>Todo/Later</span>"
            elif status_raw == "done":
                status_badge = "<span class='pill pill-low'>Done</span>"
            else:
                status_badge = f"<span class='pill pill-low'>{html.escape(status)}</span>"

            due_line = ""
            if due:
                try:
                    import datetime
                    d_due = datetime.date.fromisoformat(due)
                    near_due = (d_due - datetime.date.today()).days <= 7
                except Exception:
                    near_due = False
                due_line = f"<div style='color:{'#b91c1c' if near_due else '#6b7280'}; font-weight:{'700' if near_due else '500'};'>Deadline: {html.escape(due)}</div>"

            assignee_line = f"<div style='color:#6b7280;'>Assignee: {assignee}</div>" if assignee else ""
            comment_line = f"<div style='color:#6b7280;'>Comment: {comment}</div>" if comment else ""

            strike_style = "text-decoration: line-through; opacity: 0.75;" if is_done else ""
            items_html.append(
                f"<div style='margin-bottom:8px; display:flex; flex-direction:column; gap:4px; {strike_style}'>"
                f"<div style='display:flex; align-items:center; gap:6px; flex-wrap:wrap;'>&bull; {badge} {status_badge} <span class='rule-body' style='margin:0; padding:0; display:inline;'>{text}</span></div>"
                f"{assignee_line}{due_line}{comment_line}"
                "</div>"
            )
        return "".join(items_html)

    def _steps_for_rule(rid: str):
        if isinstance(steps_by_rule, dict):
            return steps_by_rule.get(rid, [])
        return []

    def _plain_action(text: str) -> str:
        if not text:
            return "Review and implement applicable controls."
        parts = re.split(r'(?<=[.!?])\s+', text.strip())
        return parts[0] if parts else text.strip()

    def _section_label(text: str) -> str:
        match = re.search(r"\b[Ss]ection\s+\d+[A-Za-z0-9()]*", text or "")
        return match.group(0) if match else ""

    def _format_rule_header(item) -> str:
        section = _section_label(getattr(item, "text", ""))
        section_part = f" | {html.escape(section)}" if section else ""
        return f"{html.escape(getattr(item, 'control_id', '') or '')}{section_part} | {html.escape(getattr(item, 'severity', '') or '')}"

    def _format_rule_header_dict(rule_dict: dict) -> str:
        section = _section_label(rule_dict.get("text") or "")
        section_part = f" | {html.escape(section)}" if section else ""
        return f"{html.escape(rule_dict.get('control_id') or '')}{section_part} | {html.escape(rule_dict.get('severity') or '')}"

    html_doc = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>ReguGuard Analysis Report</title>
      <style>
        @page {{
          size: A4;
          margin: 15mm 15mm 18mm 15mm;
        }}
        body {{
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #1f2937;
          background: #f8fafc;
          font-size: 13px;
        }}
        h1, h2, h3, h4 {{
          margin: 0;
          font-weight: 700;
        }}
        .header {{
          background: linear-gradient(135deg, #1e3a8a 0%, #312e81 100%);
          color: white;
          padding: 18px;
          border-radius: 12px;
          margin-bottom: 14px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.12);
        }}
        .header .title {{
          font-size: 20px;
          letter-spacing: 0.3px;
        }}
        .header .subtitle {{
          opacity: 0.9;
          font-size: 13px;
          margin-top: 4px;
        }}
        .tag {{
          display: inline-block;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          background: rgba(255,255,255,0.15);
          margin-left: 6px;
        }}
        .section {{
          background: #fff;
          border-radius: 10px;
          padding: 14px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          margin-bottom: 10px;
          border: 1px solid #e5e7eb;
        }}
        .section h3 {{
          margin-bottom: 8px;
          color: #111827;
          font-size: 15px;
          letter-spacing: 0.2px;
        }}
        .grid {{
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 8px;
        }}
        .card {{
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 12px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
        }}
        .label {{
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }}
        .value {{
          font-size: 22px;
          font-weight: 800;
          color: #1d4ed8;
        }}
        .pill {{
          display: inline-block;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          margin-left: 6px;
        }}
        .pill-high {{ background: #fee2e2; color: #b91c1c; }}
        .pill-medium {{ background: #fef9c3; color: #b45309; }}
        .pill-low {{ background: #dcfce7; color: #166534; }}
        .list {{
          margin: 6px 0 0 0;
          padding-left: 16px;
          color: #374151;
          font-size: 13px;
          line-height: 1.5;
        }}
        .rule {{
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 8px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }}
        .rule-title {{
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          margin-bottom: 6px;
          color: #111827;
        }}
        .rule-body {{
          font-size: 13px;
          color: #1f2937;
          line-height: 1.5;
          white-space: pre-wrap;
        }}
        .subhead {{
          font-weight: 700;
          margin-top: 8px;
          margin-bottom: 4px;
          color: #111827;
        }}
        .muted {{
          color: #6b7280;
          font-size: 12px;
        }}
        .spacer {{ margin-top: 8px; }}
        .footer-note {{
          font-size: 12px;
          color: #6b7280;
          margin-top: 8px;
        }}
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">COMPLIANCE ANALYSIS REPORT <span class="tag">PDPA</span></div>
        <div class="subtitle">{html.escape(filename)}</div>
        <div class="subtitle">Generated: {now} · Processing: {auto_minutes} minute(s)</div>
      </div>

      <div class="section">
        <h3>Executive Summary</h3>
        <div class="grid">
          <div class="card">
            <div class="label">Total Obligations</div>
            <div class="value">{total}</div>
            <div class="muted">Detected and categorized</div>
          </div>
          <div class="card">
            <div class="label">High Priority</div>
            <div class="value">{high} <span class="pill pill-high">{high_pct}%</span></div>
            <div class="muted">Critical/High actions</div>
          </div>
          <div class="card">
            <div class="label">Medium Priority</div>
            <div class="value">{medium} <span class="pill pill-medium">{medium_pct}%</span></div>
            <div class="muted">Advisory/Moderate</div>
          </div>
          <div class="card">
            <div class="label">Low Priority</div>
            <div class="value">{low} <span class="pill pill-low">{low_pct}%</span></div>
            <div class="muted">Low/Informational</div>
          </div>
        </div>
        <div class="spacer"></div>
        <div class="grid">
          <div class="card">
            <div class="label">Value Delivered</div>
            <div class="list">
              <div>Manual Process: {manual_hours_calc:.1f} hours</div>
              <div>ReguGuard Process: {auto_minutes} minutes</div>
              <div><strong>Time Saved: {time_saved_hours:.1f} hours</strong> (~${value_saved} at ${hourly_rate}/hr)</div>
            </div>
          </div>
          <div class="card">
            <div class="label">Recommended Action</div>
            <div class="list">
              <div>• Review {high} high-priority obligations immediately</div>
              <div>• Assign to compliance team for control mapping</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>High Priority Obligations ({high})</h3>
        {''.join([
          f"""
            <div class="rule">
            <div class="rule-title" style="gap:12px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;"></span>
              <span>{_format_rule_header(item)}</span>
              <span class="pill pill-high">Score {getattr(item, 'score', 0)}</span>
            </div>
            <div class="subhead">Legal Requirement:</div>
            <div class="rule-body">{html.escape(item.text)}</div>
            <div class="subhead">Plain-English Action:</div>
            <div class="rule-body">{html.escape(_plain_action(item.text))}</div>
            <div class="subhead">Recorded Tasks:</div>
            <div class="list">
              {_render_steps(_steps_for_rule(item.control_id))}
            </div>
            <div class="subhead">Scoring Breakdown:</div>
            <div class="list">
              {"".join([f"<div>• {html.escape(str(r))}</div>" for r in getattr(item, 'score_reasons', [])]) or "<div>• No breakdown available.</div>"}
            </div>
          </div>
          """ for item in sample_high
        ])}
      </div>

      <div class="section">
        <h3>Medium Priority Obligations ({medium})</h3>
        {''.join([
          f"""
          <div class="rule">
            <div class="rule-title" style="gap:12px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b;"></span>
              <span>{_format_rule_header(item)}</span>
              <span class="pill pill-medium">Score {getattr(item, 'score', 0)}</span>
            </div>
            <div class="subhead">Legal Requirement:</div>
            <div class="rule-body">{html.escape(item.text)}</div>
            <div class="subhead">Plain-English Action:</div>
            <div class="rule-body">{html.escape(_plain_action(item.text))}</div>
            <div class="subhead">Recorded Tasks:</div>
            <div class="list">
              {_render_steps(_steps_for_rule(item.control_id))}
            </div>
            <div class="subhead">Scoring Breakdown:</div>
            <div class="list">
              {"".join([f"<div>• {html.escape(str(r))}</div>" for r in getattr(item, 'score_reasons', [])]) or "<div>• No breakdown available.</div>"}
            </div>
          </div>
          """ for item in sample_medium
        ]) or "<div class='muted'>Not expanded in this report. Refer to application for full list.</div>"}
      </div>

      <div class="section">
        <h3>Low Priority Obligations ({low})</h3>
        <div class="muted">Not expanded in this report. Refer to application for full list.</div>
      </div>

      <div class="section">
        <h3>Appendix: Detection Methodology</h3>
        <div class="subhead">Detection Rules Applied</div>
        <div class="list">
          {''.join([f"<div>• {kw} ({sev} severity, {hits} matches)</div>" for kw, sev, hits in applied_rules]) or '<div>• defaults (shall, must, prohibited, required, should, may)</div>'}
        </div>
        <div class="subhead">Stakeholder Relevance Score</div>
        <div class="list">
          {''.join([f"<div>• {html.escape(name)}: {score}</div>" for name, score in stakeholders])}
        </div>
        <div class="footer-note">Generated by ReguGuard</div>
      </div>

      <div class="section">
        <h3>Open Workflow & Tasks</h3>
        <div class="subhead">In Progress</div>
        {''.join([
          f"""
          <div class="rule">
            <div class="rule-title" style="gap:12px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b;"></span>
              <span>{_format_rule_header_dict(r)}</span>
            </div>
            <div class="muted" style="margin-bottom:6px;">{html.escape(r.get('text') or '')}</div>
            <div class="subhead">Tasks:</div>
            <div class="list">{_render_steps(r.get('__steps') or [])}</div>
          </div>
          """ for r in in_progress_rules
        ]) or "<div class='muted'>No items in progress.</div>"}

        <div class="subhead" style="margin-top:10px;">Completed Later / Deferred</div>
        {''.join([
          f"""
          <div class="rule">
            <div class="rule-title" style="gap:12px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#6b7280;"></span>
              <span>{_format_rule_header_dict(r)}</span>
            </div>
            <div class="muted" style="margin-bottom:6px;">{html.escape(r.get('text') or '')}</div>
            <div class="subhead">Deferred Tasks:</div>
            <div class="list">{_render_steps(r.get('__steps') or [])}</div>
          </div>
          """ for r in later_rules
        ]) or "<div class='muted'>No deferred items.</div>"}
      </div>
    </body>
    </html>
    """
    return html_doc


def _build_plain_pdf(filename: str, items: List[RegulationItem], detection_rules: list = None) -> bytes:
    # Basic text-only PDF fallback (monospace), paginated.
    now = datetime.datetime.now().strftime("%d %B %Y, %I:%M %p")
    total = len(items)
    high = sum(1 for i in items if (i.severity or "").lower() == "high" or (i.category or "").upper() == "CRITICAL")
    medium = sum(1 for i in items if (i.severity or "").lower() == "medium")
    low = sum(1 for i in items if (i.severity or "").lower() == "low")
    high_pct = _percent(high, total)
    medium_pct = _percent(medium, total)
    low_pct = _percent(low, total)

    manual_hours_baseline = 8.8 if total >= 200 else 4.5
    manual_hours_calc = max(manual_hours_baseline, (total * 2.2) / 60)
    auto_minutes = max(1, min(5, math.ceil(total / 50)))
    time_saved_hours = max(0, manual_hours_calc - (auto_minutes / 60))
    hourly_rate = 100
    value_saved = int(time_saved_hours * hourly_rate)

    stakeholders = _compute_stakeholders(items)
    high_items = [i for i in items if (i.severity or "").lower() == "high" or (i.category or "").upper() == "CRITICAL"]
    sample_high = high_items[:3]

    applied_rules = []
    for r in (detection_rules or []):
        if not r.get("enabled", True):
            continue
        hits = _count_rule_hits(items, r)
        applied_rules.append((r.get("keyword") or "?", r.get("severity") or "Unknown", hits))

    def wrap(text: str, width: int = 70) -> List[str]:
        words = text.split()
        lines_local = []
        line = []
        length = 0
        for w in words:
            if length + len(w) + (1 if line else 0) > width:
                lines_local.append(" ".join(line))
                line = [w]
                length = len(w)
            else:
                if line:
                    line.append(w)
                    length += len(w) + 1
                else:
                    line = [w]
                    length = len(w)
        if line:
            lines_local.append(" ".join(line))
        return lines_local

    lines: List[str] = []
    lines.append("COMPLIANCE ANALYSIS REPORT")
    lines.append("-" * 30)
    lines.append(f"Document: {filename}")
    lines.append(f"Generated: {now}")
    lines.append(f"Processing Time: {auto_minutes} minute(s)")
    lines.append("")
    lines.append("EXECUTIVE SUMMARY")
    lines.append("-" * 30)
    lines.append(f"Total Obligations Identified: {total}")
    lines.append(f"- Critical/High Priority: {high} obligations ({high_pct}%)")
    lines.append(f"- Medium Priority:       {medium} obligations ({medium_pct}%)")
    lines.append(f"- Low/Advisory:          {low} obligations ({low_pct}%)")
    lines.append("")
    lines.append("Value Delivered")
    lines.append(f"- Manual Process:    {manual_hours_calc:.1f} hours")
    lines.append(f"- ReguGuard Process: {auto_minutes} minutes")
    lines.append(f"- Time Saved:        {time_saved_hours:.1f} hours (~${value_saved} at ${hourly_rate}/hr)")
    lines.append("")
    lines.append("Recommended Action")
    lines.append(f"- Review {high} high-priority obligations immediately")
    lines.append("- Assign to compliance team for control mapping")
    lines.append("")
    lines.append(f"HIGH PRIORITY OBLIGATIONS ({high})")
    lines.append("-" * 30)
    for item in sample_high:
        lines.append(f"{item.control_id} | {item.severity}")
        lines.append("-" * 60)
        lines.append("Legal Requirement:")
        lines.extend(wrap(item.text))
        lines.append("")
        lines.append("Plain-English Action:")
        lines.extend(wrap("Ensure compliance framework is active and operational."))
        lines.append("")
        lines.append("Recommended Tasks:")
        lines.append("- Review scope and applicability")
        lines.append("- Document required controls and owners")
        lines.append("- Track evidence and due dates")
        lines.append("")
    lines.append(f"MEDIUM PRIORITY OBLIGATIONS ({medium})")
    lines.append("-" * 30)
    lines.append("[Not expanded in this report. Refer to application for full list.]")
    lines.append("")
    lines.append(f"LOW PRIORITY OBLIGATIONS ({low})")
    lines.append("-" * 30)
    lines.append("[Not expanded in this report. Refer to application for full list.]")
    lines.append("")
    lines.append("APPENDIX: DETECTION METHODOLOGY")
    lines.append("-" * 30)
    if applied_rules:
        lines.append("Detection Rules Applied:")
        for kw, sev, hits in applied_rules:
            lines.append(f"- \"{kw}\" ({sev} severity, {hits} matches)")
    else:
        lines.append("Detection Rules Applied: defaults (shall, must, prohibited, required, should, may)")
    lines.append("")
    lines.append("Stakeholder Relevance Score:")
    for name, score in stakeholders:
        lines.append(f"- {name}: {score}")

    # paginate
    max_lines = 45
    pages = []
    cur = []
    for ln in lines:
        cur.append(ln)
        if len(cur) >= max_lines:
            pages.append(cur)
            cur = []
    if cur:
        pages.append(cur)

    buf = io.BytesIO()
    objs = []

    def add_obj(content: str):
        objs.append(content)
        return len(objs)

    font_obj = add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")
    page_ids = []
    for page_lines in pages:
        content_parts = ["BT", "/F1 11 Tf", "40 760 Td", "14 TL"]
        for line in page_lines:
            content_parts.append(f"({_escape_text(line)}) Tj")
            content_parts.append("T*")
        content_parts.append("ET")
        content_stream = "\n".join(content_parts)
        content_obj = add_obj(f"<< /Length {len(content_stream.encode('utf-8'))} >>\nstream\n{content_stream}\nendstream")
        page_obj = add_obj(f"<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Contents {content_obj} 0 R /Resources << /Font << /F1 {font_obj} 0 R >> >> >>")
        page_ids.append(page_obj)

    kids = " ".join([f"{pid} 0 R" for pid in page_ids])
    pages_obj = add_obj(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>")

    corrected = []
    for idx, obj in enumerate(objs, start=1):
        if idx in page_ids:
            corrected.append(obj.replace("/Parent 0 0 R", f"/Parent {pages_obj} 0 R"))
        else:
            corrected.append(obj)
    objs = corrected

    catalog_obj = add_obj(f"<< /Type /Catalog /Pages {pages_obj} 0 R >>")

    offsets = []
    buf.write(b"%PDF-1.4\n")
    for obj_id, obj in enumerate(objs, start=1):
        offsets.append(buf.tell())
        buf.write(f"{obj_id} 0 obj\n".encode("utf-8"))
        buf.write(obj.encode("utf-8"))
        buf.write(b"\nendobj\n")
    xref_offset = buf.tell()
    buf.write(f"xref\n0 {len(objs)+1}\n".encode("utf-8"))
    buf.write(b"0000000000 65535 f \n")
    for off in offsets:
        buf.write(f"{off:010d} 00000 n \n".encode("utf-8"))
    buf.write(b"trailer\n")
    buf.write(f"<< /Size {len(objs)+1} /Root {catalog_obj} 0 R >>\n".encode("utf-8"))
    buf.write(b"startxref\n")
    buf.write(f"{xref_offset}\n".encode("utf-8"))
    buf.write(b"%%EOF")
    return buf.getvalue()


def build_pdf_report(filename: str, items: List[RegulationItem], detection_rules: list = None, tasks_data: Dict[str, Any] = None) -> bytes:
    if WEASYPRINT_AVAILABLE:
        html = _render_html(filename, items, detection_rules, tasks_data=tasks_data)
        return HTML(string=html).write_pdf(stylesheets=[CSS(string="@page { size: A4; margin: 20mm; }")])
    # Fallback to plain PDF
    return _build_plain_pdf(filename, items, detection_rules)
