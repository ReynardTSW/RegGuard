import re
from typing import List
from app.schemas import RegulationItem

class RegulatoryParser:
    def __init__(self):
        # Regex patterns for modal verbs
        self.high_risk_pattern = re.compile(r'\b(must|shall|required|prohibited|strictly)\b', re.IGNORECASE)
        self.medium_risk_pattern = re.compile(r'\b(should|ensure|monitor|verify)\b', re.IGNORECASE)
        self.low_risk_pattern = re.compile(r'\b(may|can|optional|recommend)\b', re.IGNORECASE)

    def determine_severity(self, text: str) -> (str, str):
        """
        Returns (Severity, Detected Modal Verb)
        """
        if match := self.high_risk_pattern.search(text):
            return "High", match.group(0).lower()
        if match := self.medium_risk_pattern.search(text):
            return "Medium", match.group(0).lower()
        if match := self.low_risk_pattern.search(text):
            return "Low", match.group(0).lower()
        return "Unknown", None

    def parse(self, text: str) -> List[RegulationItem]:
        items = []
        
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
                    
                # --- FILTER 3: ACTOR-BASED OBLIGATION DETECTION ---
                
                # Requirement: Explicit Actor + Modal Verb
                actors = r'(organisation|organization|commission|individual|person|applicant|data intermediary)'
                modals = r'(shall|must|is required to|may)'
                
                actor_modal_pattern = fr'(?i)\b{actors}\b.*\b{modals}\b'
                
                if not re.search(actor_modal_pattern, clean_sentence):
                    continue

                # If we get here, it's a valid rule.
                severity, modal_found = self.determine_severity(clean_sentence)
                
                rule_counter += 1
                item = RegulationItem(
                    control_id=f"rule-{rule_counter:03d}",
                    text=clean_sentence,
                    modal_verb=modal_found,
                    severity=severity,
                    action="Immediate Action" if severity == "High" else "Review"
                )
                items.append(item)
            
        return items

parser = RegulatoryParser()
