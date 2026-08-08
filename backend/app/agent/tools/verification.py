import re
from typing import Set, List, Tuple, Optional

GENERIC_BOILERPLATE_WORDS = {
    "experience", "knowledge", "skills", "proficient", "proficiency", "expertise",
    "strong", "demonstrated", "proven", "ability", "understanding", "familiarity",
    "working", "background", "track", "record", "minimum", "years", "yrs", "yr",
    "plus", "must", "have", "nice", "qualitative", "skill", "hands-on", "solid",
    "excellent", "good", "deep", "practical", "advanced", "basic", "fundamental",
    "preferred", "required", "requirement", "requirements", "candidate", "role",
    "with", "and", "or", "the", "a", "an", "in", "for", "of", "to", "at", "on",
    "by", "from", "as", "is", "are", "be", "been", "being", "including", "such",
    "development", "engineering", "management", "administration", "operations",
    "analysis", "services", "system", "systems", "platform", "platforms",
    "solution", "solutions", "processing", "practices", "methods", "framework",
    "frameworks", "tools", "tooling", "architecture", "design", "implementation",
    "maintenance", "integration", "strategy", "support", "containerization"
}

def extract_dynamic_requirement_tokens(requirement_name: str, jd_quote: str = "") -> Set[str]:
    """
    Dynamically extract substantive requirement tokens and alternatives from requirement name & quote
    without hardcoding any industry/domain terms.

    E.g. 'Pediatric ICU Nursing (or Emergency Trauma)' -> {'pediatric', 'icu', 'nursing', 'emergency', 'trauma'}
         'GAAP Accounting & IFRS Standards' -> {'gaap', 'accounting', 'ifrs', 'standards'}
         'Containerization with Docker' -> {'containerization', 'docker'}
    """
    combined_text = f"{requirement_name or ''} {jd_quote or ''}".lower()
    if not combined_text.strip():
        return set()

    clean_tokens = set()

    # 1. Extract parenthetical and slashed alternatives (e.g. "(AWS / GCP)", "GAAP/IFRS", "(Pediatric/Trauma)")
    paren_matches = re.findall(r'\(([^)]+)\)', combined_text)
    for p_content in paren_matches:
        alts = [t.strip() for t in re.split(r'[/,|]', p_content)]
        for alt in alts:
            alt_words = re.findall(r'[a-zA-Z0-9+#/\-]+', alt)
            for w in alt_words:
                w_clean = w.strip(" -/,.")
                if w_clean and len(w_clean) >= 2 and w_clean not in GENERIC_BOILERPLATE_WORDS:
                    clean_tokens.add(w_clean)

    # 2. Extract words from overall requirement text
    raw_words = re.findall(r'[a-zA-Z0-9+#/\-]+', combined_text)
    for word in raw_words:
        w_clean = word.strip(" -/,.")
        if w_clean and len(w_clean) >= 2 and w_clean not in GENERIC_BOILERPLATE_WORDS:
            clean_tokens.add(w_clean)

    return clean_tokens

def check_dynamic_token_presence(req_tokens: Set[str], candidate_corpus: str) -> bool:
    """
    Check if at least one core substantive requirement token or root prefix is present
    in the candidate corpus (case-insensitive, word-bounded or root prefix matching).
    """
    if not req_tokens or not candidate_corpus:
        return False

    corpus_lower = candidate_corpus.lower()

    for token in req_tokens:
        # For short tokens (<= 3 chars e.g. 'aws', 'gcp', 'sql', 'icu', 'seo', 'rag', 'k8s'), use strict word boundary
        if len(token) <= 3 and not any(c in token for c in "+#/-."):
            pattern = rf"\b{re.escape(token)}\b"
            if re.search(pattern, corpus_lower):
                return True
        else:
            # Direct substring check
            if token in corpus_lower:
                return True

            # Morphological prefix check for tokens >= 5 chars (e.g. 'containeriz' for 'containerization'/'containerise')
            if len(token) >= 5:
                prefix = token[:5]
                if prefix in corpus_lower:
                    return True

    return False
