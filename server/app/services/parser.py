import re
from typing import List
from app.schemas import RegulationItem

class RegulatoryParser:
    DEFAULT_DETECTION_RULES = [
        {"id": "shall", "keyword": "shall", "severity": "High", "match_type": "contains", "enabled": True},
        {"id": "must", "keyword": "must", "severity": "High", "match_type": "contains", "enabled": True},
        {"id": "prohibited", "keyword": "prohibited", "severity": "High", "match_type": "contains", "enabled": True},
        {"id": "required", "keyword": "required", "severity": "Medium", "match_type": "contains", "enabled": True},
        {"id": "should", "keyword": "should", "severity": "Low", "match_type": "contains", "enabled": True},
        {"id": "may", "keyword": "may", "severity": "Low", "match_type": "contains", "enabled": True},
    ]

    def __init__(self, detection_rules=None):
        # Detection rules power the "Custom Detection Rules" concept shown in the mock:
        # defaults are pre-loaded, but callers can supply a new list to adapt to GDPR/HIPAA/ISO/custom frameworks.
        self.detection_rules = detection_rules or [rule.copy() for rule in self.DEFAULT_DETECTION_RULES]

        # Regex patterns for modal verbs
        self.high_risk_pattern = re.compile(r'\b(must|shall|required|prohibited|strictly)\b', re.IGNORECASE)
        self.medium_risk_pattern = re.compile(r'\b(should|ensure|monitor|verify)\b', re.IGNORECASE)
        self.low_risk_pattern = re.compile(r'\b(may|can|optional|recommend)\b', re.IGNORECASE)
        self.penalty_keywords = ["liable", "fine", "imprisonment", "penalty", "prosecution"]
        self.breach_keywords = [
            "breach",
            "incident",
            "unauthorized access",
            "unauthorised access",
            "data leak",
            "data loss",
            "security incident",
            "ransomware",
            "compromise",
        ]
        self.enforcement_cases = [
            "singhealth",
            "ihis",
            "grab",
            "lazada",
            "pdpc decision",
            "commission decision",
            "enforcement case",
        ]

    def is_default_rules(self, rules: list) -> bool:
        """
        Returns True when the provided detection_rules payload matches the built-in defaults
        (all default ids present, keywords/severities/match_types align, none disabled).
        Used by the API layer to decide whether to allow heuristic fallbacks.
        """
        if not isinstance(rules, list):
            return False
        if len(rules) != len(self.DEFAULT_DETECTION_RULES):
            return False
        defaults_by_id = {r["id"]: r for r in self.DEFAULT_DETECTION_RULES}
        for rule in rules:
            rid = rule.get("id")
            base = defaults_by_id.get(rid)
            if not base:
                return False
            if str(rule.get("keyword", "")).lower() != str(base.get("keyword", "")).lower():
                return False
            if str(rule.get("severity", "")).lower() != str(base.get("severity", "")).lower():
                return False
            if str(rule.get("match_type", "contains")).lower() != str(base.get("match_type", "contains")).lower():
                return False
            if rule.get("enabled", True) is False:
                return False
        return True

    @staticmethod
    def severity_rank(severity: str) -> int:
        order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Unknown": 4}
        return order.get(severity.title(), 4)

    def match_detection_rules(self, text: str, detection_rules=None) -> list:
        """
        Returns a list of detection rules that match the text, honoring match type and context requirements.
        """
        rules = detection_rules or self.detection_rules
        lower = text.lower()
        matches = []

        for rule in rules:
            if not rule.get("enabled", True):
                continue

            keyword = (rule.get("keyword") or "").lower()
            match_type = rule.get("match_type", "contains").lower()
            matched = False

            if match_type == "exact":
                matched = lower.strip() == keyword
            elif match_type == "startswith":
                matched = lower.strip().startswith(keyword)
            elif match_type == "regex":
                try:
                    matched = re.search(rule.get("keyword", ""), text, re.IGNORECASE) is not None
                except re.error:
                    matched = False
            else:  # contains (default)
                matched = keyword in lower

            if not matched:
                continue

            must_also = [v.lower() for v in rule.get("must_also_contain", []) if v]
            must_not = [v.lower() for v in rule.get("must_not_contain", []) if v]

            if must_also and not all(term in lower for term in must_also):
                continue
            if must_not and any(term in lower for term in must_not):
                continue

            matches.append(rule)

        return matches

    def classify_score(self, text: str, severity: str = "Unknown", matched_rules: list = None) -> (int, str, dict, list):
        """
        Return (score, category, flags, reasons) based on keyword presence.
        """
        lower = text.lower()
        matched_rules = matched_rules or []
        severity = severity.title()

        base_by_severity = {
            "Critical": 80,
            "High": 65,
            "Medium": 45,
            "Low": 25,
            "Unknown": 15,
        }

        score = base_by_severity.get(severity, 15)
        reasons = [f"+base severity ({severity})"]

        penalty_hit = any(kw in lower for kw in self.penalty_keywords)
        mandatory_hit = bool(re.search(r'\b(shall|must)\b', lower))
        breach_hit = any(kw in lower for kw in self.breach_keywords)
        enforcement_hit = any(case in lower for case in self.enforcement_cases)

        if matched_rules:
            # Surface which detection rules triggered the item.
            rule_descriptions = [f"{r.get('keyword')} [{r.get('severity', 'Unknown')}]" for r in matched_rules]
            reasons.append(f"Matched rules: {', '.join(rule_descriptions)}")

        if penalty_hit:
            score += 20
            reasons.append("+20 penalty keyword")

        if mandatory_hit:
            score += 15
            reasons.append("+15 mandatory (shall/must)")

        if breach_hit:
            score += 10
            reasons.append("+10 data/security breach")

        if enforcement_hit:
            score += 10
            reasons.append("+10 PDPC enforcement mention")

        score = min(score, 100)
        category = self.score_to_category(score)
        flags = {
            "penalty": penalty_hit,
            "mandatory": mandatory_hit,
            "breach": breach_hit,
            "enforcement": enforcement_hit,
        }
        return score, category, flags, reasons

    @staticmethod
    def score_to_category(score: int) -> str:
        if score >= 80:
            return "CRITICAL"
        if score >= 60:
            return "HIGH"
        if score >= 40:
            return "MEDIUM"
        return "LOW"

    def determine_severity(self, text: str, detection_rules=None, rules_only: bool = False) -> (str, str, list):
        """
        Returns (Severity, Detected Modal Verb, matched_rules)
        """
        matched_rules = self.match_detection_rules(text, detection_rules)
        if matched_rules:
            # Pick the highest severity rule; sorted by defined rank.
            matched_rules = sorted(
                matched_rules,
                key=lambda r: self.severity_rank(r.get("severity", "Unknown"))
            )
            top = matched_rules[0]
            severity_value = top.get("severity") or "Unknown"
            if severity_value.lower() == "any":
                severity_value = "Unknown"
            severity = severity_value.title()
            return severity, top.get("keyword", "").lower(), matched_rules

        if rules_only:
            # When user supplied custom rules, don't fall back to heuristics.
            return "Unknown", None, []

        # Fallback to heuristic patterns for cases without explicit rules
        if match := self.high_risk_pattern.search(text):
            return "High", match.group(0).lower(), []
        if match := self.medium_risk_pattern.search(text):
            return "Medium", match.group(0).lower(), []
        if match := self.low_risk_pattern.search(text):
            return "Low", match.group(0).lower(), []
        return "Unknown", None, []

    def has_minimum_obligation_signals(self, text: str) -> bool:
        lower = text.lower()
        signals = [
            "shall", "must", "required", "prohibited", "should", "may",
            "ensure", "comply", "adhere", "must ensure", "shall not", "must not"
        ]
        return any(sig in lower for sig in signals)

    def parse(self, text: str, detection_rules: list = None) -> List[RegulationItem]:
        items = []
        custom_rules_supplied = detection_rules is not None
        detection_rules = detection_rules or self.detection_rules
        
        # 1. Cleaning: Remove common PDF artifacts (page numbers, headers repetition if predictable)
        # This is hard to do perfectly generically, but we can normalize whitespace.
        text = re.sub(r'\s+', ' ', text).strip()

        # 2. Splitting Strategy:
        # First, split by major legal markers to respect document structure.
        # This prevents a rule from one section merging with the header of the next.
        
        split_pattern = r'(?=(\bPART\s+[IVX]+|\bDivision\s+\d+|\b\d+\.\s+[A-Z]|\(\d+\)))'
        
        # Note: We do NOT normalize whitespace globally yet, to preserve newlines for initial structure if needed.
        # But for robustness against formatting artifacts, we'll split by pattern first.
        
        # Pre-clean: replace non-breaking spaces
        text = text.replace('\xa0', ' ')
        text = text.replace('\u2014', '-').replace('\u2013', '-')
        
        major_chunks = re.split(split_pattern, text)
        merged_chunks = []
        list_item_pattern = re.compile(r'^\([a-z]{1,2}\)\b', re.IGNORECASE)
        roman_item_pattern = re.compile(r'^\([ivx]+\)\b', re.IGNORECASE)
        numeric_item_pattern = re.compile(r'^\(\d+\)\b')
        lead_in_pattern = re.compile(r'[:—–-]\s*$')
        lead_in_index = None

        for chunk in major_chunks:
            if not chunk or not chunk.strip():
                continue
            chunk_clean = chunk.strip()

            is_list_item = list_item_pattern.match(chunk_clean) or roman_item_pattern.match(chunk_clean)
            if is_list_item and lead_in_index is not None:
                merged_chunks[lead_in_index] = f"{merged_chunks[lead_in_index].rstrip()} {chunk_clean}"
                continue

            if numeric_item_pattern.match(chunk_clean) and lead_in_index is not None:
                merged_chunks[lead_in_index] = f"{merged_chunks[lead_in_index].rstrip()} {chunk_clean}"
                continue

            merged_chunks.append(chunk_clean)

            if lead_in_pattern.search(chunk_clean):
                lead_in_index = len(merged_chunks) - 1
                continue

            if re.search(r'\b(shall|must|may|is required to)\b.*\b(be|include|consist of)\b', chunk_clean, re.IGNORECASE):
                lead_in_index = len(merged_chunks) - 1
            else:
                lead_in_index = None
        
        items = []
        rule_counter = 0

        for chunk in merged_chunks:
            # Inside each major chunk (e.g. "13. Consent..."), we likely have multiple sentences.
            # We must split them to filter out headers/definitions effectively.
            
            # Normalize whitespace within the chunk (replace newlines with spaces)
            # This makes sentence splitting by punctuation easier.
            chunk_normalized = re.sub(r'\s+', ' ', chunk).strip()
            
            if not chunk_normalized:
                continue
            
            # If a lead-in with list items exists (e.g., "shall be — (a)... (b)..."),
            # keep the whole block together so list items stay with the actor/modal.
            has_list_items = len(re.findall(r'\([a-z]\)', chunk_normalized, re.IGNORECASE)) >= 2
            has_leadin = bool(re.search(r'—|:|-', chunk_normalized))
            if has_list_items and has_leadin:
                sentences = [chunk_normalized]
            else:
                # Split by sentence endings (. ! ?)
                # Lookbehind (?<=[.!?]) ensures we keep the punctuation.
                sentences = re.split(r'(?<=[.!?])\s+', chunk_normalized)
            
            for sentence in sentences:
                clean_sentence = sentence.strip()
                if not clean_sentence:
                    continue
                    
                # --- FILTER 1: IGNORE HEADERS & STRUCTURAL TEXT ---
                
                # Check for PART/Division/Schedule at start
                if re.match(r'^(PART|Division|SECTION|Schedule)\b', clean_sentence, re.IGNORECASE):
                    continue
                    
                # Check for fully uppercase (allow some symbols)
                if any(c.isalpha() for c in clean_sentence) and clean_sentence.isupper():
                    continue
                    
                # Check for short lines (titles/headers often < 5 words)
                # But be careful not to kill short valid rules? 
                # Valid rules with Actor+Modal are usually longer. "Commission may act." (3 words).
                # Let's trust the Actor+Modal check for short sentences, but filter generic short titles.
                word_count = len(clean_sentence.split())
                if word_count <= 4 and not re.search(r'\b(shall|must|may)\b', clean_sentence, re.IGNORECASE):
                    continue

                # --- FILTER 2: IGNORE DEFINITION CLAUSES ---
                
                # Pattern: "X" means ... or “X” means
                if re.search(r'("|“)[^"”]+("|”)\s+means\b', clean_sentence, re.IGNORECASE):
                    continue
                    
                # --- FILTER 3: OBLIGATION DETECTION (rules + generic signals) ---
                matches = self.match_detection_rules(clean_sentence, detection_rules)

                # Expanded actor/modal pattern for cross-framework applicability (GDPR/HIPAA/ISO/custom)
                actors = r'(organisation|organization|commission|individual|person|applicant|data intermediary|controller|processor|entity|provider|service|company|team|customer)'
                modals = r'(shall|must|is required to|may|should|required|prohibited)'
                actor_modal_pattern = fr'(?i)\b{actors}\b.*\b{modals}\b'
                has_actor_modal = re.search(actor_modal_pattern, clean_sentence) is not None

                # If user supplied custom rules (even empty), require matches only; otherwise allow fallbacks.
                if custom_rules_supplied:
                    if not matches:
                        continue
                else:
                    if not matches and not has_actor_modal and not self.has_minimum_obligation_signals(clean_sentence):
                        continue

                # If we get here, it's a valid rule.
                severity, modal_found, matched_rules = self.determine_severity(
                    clean_sentence,
                    detection_rules,
                    rules_only=custom_rules_supplied,
                )
                score, category, flags, reasons = self.classify_score(clean_sentence, severity, matched_rules)
                
                rule_counter += 1
                item = RegulationItem(
                    control_id=f"rule-{rule_counter:03d}",
                    text=clean_sentence,
                    modal_verb=modal_found,
                    severity=severity,
                    score=score,
                    category=category,
                    score_flags=flags,
                    score_reasons=reasons,
                    action="Immediate Action" if category in ("CRITICAL", "HIGH") or severity == "High" else "Review"
                )
                items.append(item)
            
        return items

parser = RegulatoryParser()
