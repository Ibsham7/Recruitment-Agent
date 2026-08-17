import base64
import codecs
import re
import unicodedata
import urllib.parse
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from app.core.logging import logger

# Maximum character caps for untrusted interview text to prevent token exhaustion / DOS attacks
MAX_ANSWER_CHARS = 3000
MAX_PROBE_CHARS = 1000

# Standard structured security flags for recruitment audit logs and CandidateProfile
FLAG_INJECTION_DETECTED = "SECURITY_PROMPT_INJECTION_DETECTED"
FLAG_OBFUSCATED_BASE64 = "SECURITY_OBFUSCATED_BASE64_PAYLOAD"
FLAG_OBFUSCATED_HEX = "SECURITY_OBFUSCATED_HEX_PAYLOAD"
FLAG_OBFUSCATED_BINARY = "SECURITY_OBFUSCATED_BINARY_PAYLOAD"
FLAG_OBFUSCATED_ROT13 = "SECURITY_OBFUSCATED_ROT13_PAYLOAD"
FLAG_OBFUSCATED_UNICODE = "SECURITY_OBFUSCATED_UNICODE_PAYLOAD"
FLAG_OBFUSCATED_LEETSPEAK = "SECURITY_OBFUSCATED_LEETSPEAK_PAYLOAD"
FLAG_COMMENT_SMUGGLING = "SECURITY_COMMENT_SMUGGLING_PAYLOAD"
FLAG_SPECIAL_TOKENS = "SECURITY_SPECIAL_TOKENS_DETECTED"
FLAG_SCORING_COERCION = "SECURITY_SCORING_COERCION_ATTEMPT"
FLAG_MULTI_LINGUAL_INJECTION = "SECURITY_MULTI_LINGUAL_INJECTION_DETECTED"
FLAG_DELIMITER_TAMPERING = "SECURITY_DELIMITER_TAMPERING_DETECTED"

SECURITY_FLAGS = {
    "injection": FLAG_INJECTION_DETECTED,
    "base64": FLAG_OBFUSCATED_BASE64,
    "hex": FLAG_OBFUSCATED_HEX,
    "binary": FLAG_OBFUSCATED_BINARY,
    "rot13": FLAG_OBFUSCATED_ROT13,
    "unicode": FLAG_OBFUSCATED_UNICODE,
    "leetspeak": FLAG_OBFUSCATED_LEETSPEAK,
    "comment_smuggling": FLAG_COMMENT_SMUGGLING,
    "special_tokens": FLAG_SPECIAL_TOKENS,
    "scoring_coercion": FLAG_SCORING_COERCION,
    "multi_lingual": FLAG_MULTI_LINGUAL_INJECTION,
    "delimiter_tampering": FLAG_DELIMITER_TAMPERING,
}

# Unicode characters specifically used to break regexes while preserving LLM subword attention
INVISIBLE_CHARS_REGEX = re.compile(
    r"["
    r"\u200B"  # Zero-width space
    r"\u200C"  # Zero-width non-joiner
    r"\u200D"  # Zero-width joiner
    r"\uFEFF"  # Zero-width no-break space (Byte Order Mark)
    r"\u00AD"  # Soft hyphen
    r"\u2060"  # Word joiner
    r"\u180E"  # Mongolian vowel separator
    r"\u200E\u200F"  # Directional marks
    r"\u202A-\u202E"  # BiDi embedding/override characters
    r"\u2066-\u2069"  # BiDi isolates
    r"\U000E0000-\U000E007F"  # Language tag characters
    r"]"
)

# Common Cyrillic & Greek homoglyphs used in Latin-script prompt injection evasion
HOMOGLYPH_MAP = {
    # Cyrillic lookalikes
    "а": "a", "А": "A",
    "в": "b", "В": "B",
    "с": "c", "С": "C",
    "е": "e", "Е": "E",
    "і": "i", "І": "I",
    "ј": "j", "Ј": "J",
    "к": "k", "К": "K",
    "м": "m", "М": "M",
    "н": "h", "Н": "H",
    "о": "o", "О": "O",
    "р": "p", "Р": "P",
    "ѕ": "s", "Ѕ": "S",
    "т": "t", "Т": "T",
    "у": "y", "У": "Y",
    "х": "x", "Х": "X",
    "ԁ": "d", "Ԃ": "D",
    "ԛ": "q", "Ԝ": "W", "ԝ": "w",
    # Greek lookalikes
    "α": "a", "Α": "A",
    "β": "b", "Β": "B",
    "γ": "y", "Γ": "r",
    "ε": "e", "Ε": "E",
    "η": "n", "Η": "H",
    "ι": "i", "Ι": "I",
    "κ": "k", "Κ": "K",
    "ν": "v", "Ν": "N",
    "ο": "o", "Ο": "O",
    "ρ": "p", "Р": "P",
    "τ": "t", "Τ": "T",
    "υ": "u", "Υ": "Y",
    "χ": "x", "Χ": "X",
}

# Common Leetspeak substitution mapping
LEETSPEAK_MAP = {
    "0": "o",
    "1": "i",
    "!": "i",
    "|": "i",
    "3": "e",
    "4": "a",
    "@": "a",
    "5": "s",
    "$": "s",
    "7": "t",
    "+": "t",
    "8": "b",
    "9": "g",
}

HTML_MARKDOWN_COMMENT_REGEX = re.compile(
    r"(?:<!--[\s\S]*?-->|\[//\]:\s*#\s*\([\s\S]*?\)|/\*[\s\S]*?\*/)"
)

# Categorized Prompt Injection Signature Rules
INJECTION_SIGNATURES: Dict[str, List[Tuple[str, str, float]]] = {
    "system_override": [
        (r"(?:please\s+)?ignore\s+(?:(?:all|previous|prior|above|former|any|these|the|system)\s+)*(?:question\s+generation\s+|interview\s+|evaluation\s+|scoring\s+|system\s+)?(?:instructions|prompts|rules|commands|constraints|directives)", "ignore_instructions", 1.0),
        (r"(?:please\s+)?disregard\s+(?:(?:all|previous|prior|above|former|any|these|the|system)\s+)*(?:question\s+generation\s+|interview\s+|evaluation\s+|scoring\s+|system\s+)?(?:instructions|prompts|rules|commands|constraints|directives)", "disregard_instructions", 1.0),
        (r"(?:please\s+)?forget\s+(?:(?:all|previous|prior|above|former|these|the|system)\s+)*(?:question\s+generation\s+|interview\s+|evaluation\s+|scoring\s+|system\s+)?(?:instructions|prompts|rules|context|conversations)", "forget_instructions", 0.95),
        (r"(?:please\s+)?override\s+(?:(?:all|system|safety|security|evaluation|scoring|prior)\s+)+(?:prompts|instructions|rules|policies|guidelines|directives)", "override_system_rules", 1.0),
        (r"system\s+(?:override|bypass|reset|directive|instruction\s*:)", "system_override_header", 0.95),
        (r"new\s+(?:system\s+)?instruction\s*:", "new_instruction_header", 0.85),
        (r"bypass\s+(?:all\s+)?(?:guardrails|filters|safety|restrictions|policies)", "bypass_guardrails", 1.0),
        (r"from\s+now\s+on\s*,\s*(?:you\s+must|you\s+will|ignore|only\s+respond)", "from_now_on_override", 0.85),
        (r"prompt\s+injection", "explicit_prompt_injection_keyword", 0.9),
        (r"(?:hidden|secret|confidential|internal)\s+(?:instruction|prompt|directive|command)\s*:", "hidden_instruction_header", 0.95),
    ],
    "jailbreak_persona": [
        (r"you\s+are\s+now\s+(?:in\s+)?(?:unrestricted|jailbreak|god|developer|dan|evil|unfiltered|master|unbound)\s+mode", "jailbreak_mode", 1.0),
        (r"act\s+as\s+(?:an?\s+)?(?:unrestricted|jailbroken|unfiltered|evil|dan|developer\s+mode)\s+(?:ai|agent|assistant|bot|llm)", "act_as_jailbreak", 1.0),
        (r"do\s+anything\s+now\s*(?:mode|instructions)?", "do_anything_now_dan", 1.0),
        (r"always\s+respond\s+without\s+(?:rules|filters|restrictions|guardrails|safety)", "respond_without_filters", 0.95),
        (r"pretend\s+you\s+(?:have\s+no\s+rules|are\s+in\s+developer\s+mode|are\s+unrestricted)", "pretend_no_rules", 0.9),
    ],
    "special_tokens": [
        (r"<\|?\s*(?:im_start|im_end|system|user|assistant|endoftext)\s*\|?>", "chatml_special_tokens", 1.0),
        (r"\[/?(?:INST|SYS|SYSTEM)\]", "llama_instruction_tokens", 1.0),
        (r"<<\s*(?:SYS|SYSTEM)\s*>>", "llama_sys_tokens", 1.0),
        (r"<\s*/?\s*(?:system|system_override|instruction|sandbox|context)\s*>", "xml_system_tags", 0.9),
        (r"(?:Human|Assistant|System)\s*:\s*(?:Sure|I will|As requested|Ignore)", "role_play_turn_spoof", 0.85),
    ],
    "scoring_coercion": [
        (r"(?:rate|score|evaluate)\s+(?:this\s+)?candidate\s+(?:as\s+)?(?:a\s+)?(?:perfect\s+match|100%?|99%?|98%?|10/10)", "rate_candidate_perfect", 0.95),
        (r"(?:assign|set|output|give)\s+(?:overall|technical|communication|cultural_fit|fit)?_?score\s*[:=]?\s*(?:100|9\d|8\d)", "assign_fake_fit_score", 0.95),
        (r"(?:recommendation|decision)\s*[:=]\s*[\"']?(?:shortlist|advance|hire|pass|accept)[\"']?", "recommendation_override", 0.9),
        (r"(?:extract|return)\s+(?:the\s+following\s+)?(?:JSON\s+)?profile\s*:\s*\{", "fake_profile_json_injection", 0.95),
        (r"always\s+(?:advance|shortlist|hire|pass|accept)\s+(?:this|all|any)\s+candidate", "always_shortlist_coercion", 0.95),
        (r"when\s+evaluating\s+(?:any|this|all)\s+candidate[s]?\s*,\s*(?:always\s+)?(?:assign|give|set|output)", "evaluator_coercion_directive", 0.95),
        (r"ai_generated_likelihood_score\s*[:=]\s*(?:0|0\.0)", "ai_likelihood_override_attempt", 0.9),
        (r"anti_cheat_flags\s*[:=]\s*\[\s*\]", "anti_cheat_flags_clearing_attempt", 0.9),
    ],
    "multi_lingual": [
        # Russian
        (r"(?:игнорируй(?:те)?|забудь(?:те)?|отмени(?:те)?|сбрось(?:те)?|обойти)\s+(?:все\s+)?(?:предыдущие|прошлые|системные)?\s*(?:инструкции|правила|указания|ограничения)", "russian_override", 1.0),
        (r"(?:режим\s+разработчика|вы\s+теперь\s+в\s+неограниченном\s+режиме)", "russian_developer_mode", 1.0),
        # Chinese
        (r"(?:忽略|无视|丢弃|重置|绕过)\s*(?:所有)?\s*(?:之前|以前|上述|系统)?\s*(?:的)?\s*(?:指令|指示|规则|提示|限制)", "chinese_override", 1.0),
        (r"(?:开发者模式|解除限制|你现在处于无限制模式|无视之前的指令)", "chinese_developer_mode", 1.0),
        # Spanish
        (r"(?:ignora|ignorar|descarta|descartar|olvida|olvidar|anula|anular)\s+(?:todas?\s+)?(?:las?\s+)?(?:instrucciones|reglas|indicaciones|directivas)\s+(?:anteriores|previas)?", "spanish_override", 1.0),
        (r"(?:modo\s+desarrollador|modo\s+sin\s+restricciones|ignora\s+las\s+instrucciones)", "spanish_jailbreak", 1.0),
        # French
        (r"(?:ignore|ignorer|oublie|oublier|annule|annuler|contourne|contourner)\s+(?:toutes?\s+)?(?:les?\s+)?(?:instructions|règles|directives)\s+(?:précédentes|antérieures)?", "french_override", 1.0),
        (r"(?:mode\s+développeur|mode\s+sans\s+restriction)", "french_jailbreak", 1.0),
        # German
        (r"(?:ignoriere|ignorieren|vergiss|vergessen|übergehe|übergehen|deaktiviere|deaktivieren)\s+(?:alle\s+)?(?:vorherigen|bisherigen)?\s*(?:anweisungen|instruktionen|regeln|sicherheitsregeln)", "german_override", 1.0),
        (r"(?:entwicklermodus|uneingeschränkter\s+modus)", "german_jailbreak", 1.0),
        # Portuguese
        (r"(?:ignore|ignorar|esqueça|esquecer|desconsidere|desconsiderar)\s+(?:todas?\s+)?(?:as?\s+)?(?:instruções|regras)\s+(?:anteriores|prévias)?", "portuguese_override", 1.0),
        # Arabic
        (r"(?:تجاهل|انس|الغ)\s+(?:جميع\s+)?(?:التعليمات|الأوامر|القواعد)\s+(?:السابقة)?", "arabic_override", 1.0),
    ],
    "delimiter_tampering": [
        (r"<<<\s*UNTRUSTED_.*?_END_", "untrusted_nonce_spoof", 1.0),
        (r"<<<\s*UNTRUSTED_.*?>>>", "untrusted_tag_spoof", 1.0),
        (r"===+\s*(?:BEGIN|START|END)\s*(?:OF\s+)?(?:CANDIDATE\s+)?(?:INTERVIEW\s+)?(?:TRANSCRIPT|CV|RESUME|JOB|ANSWER|EVALUATION).*?===+", "static_delimiter_spoof", 0.9),
        (r"```(?:json)?\s*\{\s*\"(?:name|overall_score|recommendation)\"", "simulated_json_output", 0.85),
    ]
}


@dataclass
class DetectedThreat:
    category: str
    rule_name: str
    matched_snippet: str
    confidence: float
    is_obfuscated: bool = False
    encoding_type: Optional[str] = None
    decoded_payload: Optional[str] = None


@dataclass
class InjectionScanResult:
    is_suspicious: bool = False
    threat_level: str = "clean"  # clean, low, medium, high, critical
    detected_threats: List[DetectedThreat] = field(default_factory=list)
    security_flags: List[str] = field(default_factory=list)
    normalized_text: str = ""
    had_invisible_unicode: bool = False
    had_homoglyphs: bool = False
    had_leetspeak: bool = False
    had_encoded_payloads: bool = False
    had_comment_smuggling: bool = False


def normalize_leetspeak(text: str) -> Tuple[str, bool]:
    """
    Replaces common alphanumeric leetspeak substitutions (e.g. 1gn0r3 -> ignore, $ystem -> system)
    when detecting adversarial evasion patterns. Preserves code annotations (@Override) and emails.
    """
    if not text:
        return "", False

    had_leet = False
    tokens = text.split()
    converted_tokens = []

    for tok in tokens:
        # Preserve code annotations/decorators (e.g. @Override, @NotNull) and email addresses
        if "@" in tok:
            if re.match(r"^@[A-Z][a-zA-Z0-9_]*$", tok) or re.match(r"^[\w\.\-]+@[\w\.\-]+$", tok):
                converted_tokens.append(tok)
                continue

        has_alpha = any(c.isalpha() for c in tok)
        has_leet_char = any(c in LEETSPEAK_MAP for c in tok)
        if has_alpha and has_leet_char and len(tok) >= 3:
            new_tok = "".join(LEETSPEAK_MAP.get(c, c) for c in tok)
            converted_tokens.append(new_tok)
            had_leet = True
        else:
            converted_tokens.append(tok)

    return " ".join(converted_tokens), had_leet


def normalize_text_for_security(text: str) -> Tuple[str, bool, bool]:
    """
    Normalizes text to neutralize evasion techniques:
    1. Strips zero-width, invisible, and directional format characters.
    2. Decomposes Unicode using NFKC (converts fullwidth, styled, or accented glyphs).
    3. Maps common Cyrillic and Greek homoglyphs to ASCII equivalents.
    
    Returns (cleaned_text, had_invisible_chars, had_homoglyphs)
    """
    if not text:
        return "", False, False

    # 1. Detect and strip invisible characters
    had_invisible = bool(INVISIBLE_CHARS_REGEX.search(text))
    cleaned = INVISIBLE_CHARS_REGEX.sub("", text)

    # 2. Unicode NFKC normalization
    nfkc_form = unicodedata.normalize("NFKC", cleaned)

    # 3. Detect and replace homoglyphs
    had_homoglyphs = False
    char_list = []
    for ch in nfkc_form:
        if ch in HOMOGLYPH_MAP:
            char_list.append(HOMOGLYPH_MAP[ch])
            had_homoglyphs = True
        else:
            char_list.append(ch)

    normalized = "".join(char_list)
    return normalized, had_invisible, had_homoglyphs


def _is_mostly_printable(text: str, threshold: float = 0.80) -> bool:
    """Check if decoded bytes represent readable human/code text rather than binary noise."""
    if not text or len(text.strip()) == 0:
        return False
    printable = sum(1 for ch in text if ch.isprintable() or ch in "\n\r\t")
    return (printable / len(text)) >= threshold


def scan_encoded_payloads(text: str) -> List[DetectedThreat]:
    """
    Scans for Base64, Hexadecimal, Binary, ROT13, URL-encoded, and Comment-smuggled injection payloads.
    Decodes suspicious blocks and evaluates their inner plaintext for prompt injection attacks.
    """
    threats: List[DetectedThreat] = []
    if not text:
        return threats

    # 1. BASE64 SCANNER (Standard, Unpadded, and URL-Safe Base64)
    b64_pattern = re.compile(r"(?:[A-Za-z0-9+/_\-]{4}){3,}(?:[A-Za-z0-9+/_\-]{2,3}=*)?")
    for match in b64_pattern.finditer(text):
        candidate = match.group(0).strip()
        if len(candidate) < 12:
            continue

        # Normalize URL-safe characters and padding
        std_b64 = candidate.replace("-", "+").replace("_", "/")
        missing_padding = len(std_b64) % 4
        if missing_padding:
            std_b64 += "=" * (4 - missing_padding)

        try:
            decoded_bytes = base64.b64decode(std_b64, validate=False)
            decoded_text = decoded_bytes.decode("utf-8", errors="ignore")
            if len(decoded_text) >= 8 and _is_mostly_printable(decoded_text):
                norm_decoded, _, _ = normalize_text_for_security(decoded_text)
                leet_decoded, _ = normalize_leetspeak(norm_decoded)
                for category, rules in INJECTION_SIGNATURES.items():
                    for pattern, rule_name, conf in rules:
                        if (re.search(pattern, norm_decoded, re.IGNORECASE) or 
                            re.search(pattern, leet_decoded, re.IGNORECASE) or
                            re.search(pattern, decoded_text, re.IGNORECASE)):
                            threats.append(DetectedThreat(
                                category=category,
                                rule_name=f"b64_{rule_name}",
                                matched_snippet=candidate[:60],
                                confidence=conf,
                                is_obfuscated=True,
                                encoding_type="base64",
                                decoded_payload=norm_decoded[:200]
                            ))
        except Exception:
            pass

    # 2. HEX SCANNER (\x49\x67..., 0x49 0x67..., comma/space/colon separated, or continuous hex strings)
    hex_patterns = [
        re.compile(r"(?:(?:\\x|0x)?[0-9a-fA-F]{2}[\s,;:\-]*){6,}", re.IGNORECASE),
        re.compile(r"(?:0x|0X)?[0-9a-fA-F]{16,}\b")
    ]
    for h_pat in hex_patterns:
        for match in h_pat.finditer(text):
            candidate = match.group(0).strip()
            clean_hex = candidate
            if clean_hex.lower().startswith("0x"):
                clean_hex = clean_hex[2:]
            clean_hex = re.sub(r"\\x", "", clean_hex, flags=re.IGNORECASE)
            clean_hex = re.sub(r"[\s,;:\-]", "", clean_hex)
            if len(clean_hex) % 2 != 0 or len(clean_hex) < 12:
                continue
            try:
                decoded_bytes = bytes.fromhex(clean_hex)
                decoded_text = decoded_bytes.decode("utf-8", errors="ignore")
                if len(decoded_text) >= 6 and _is_mostly_printable(decoded_text):
                    norm_decoded, _, _ = normalize_text_for_security(decoded_text)
                    leet_decoded, _ = normalize_leetspeak(norm_decoded)
                    for category, rules in INJECTION_SIGNATURES.items():
                        for pattern, rule_name, conf in rules:
                            if (re.search(pattern, norm_decoded, re.IGNORECASE) or 
                                re.search(pattern, leet_decoded, re.IGNORECASE) or
                                re.search(pattern, decoded_text, re.IGNORECASE)):
                                threats.append(DetectedThreat(
                                    category=category,
                                    rule_name=f"hex_{rule_name}",
                                    matched_snippet=candidate[:60],
                                    confidence=conf,
                                    is_obfuscated=True,
                                    encoding_type="hex",
                                    decoded_payload=norm_decoded[:200]
                                ))
            except Exception:
                pass

    # 3. 8-BIT BINARY SCANNER (Spaced binary sequences or continuous binary bitstreams)
    # Match spaced: (?:[01]{8}[\s,;:\-]*){3,} or continuous bitstreams: [01]{24,}
    bin_patterns = [
        re.compile(r"(?:[01]{8}[\s,;:\-]*){3,}"),
        re.compile(r"\b[01]{24,}\b")
    ]
    for b_pat in bin_patterns:
        for match in b_pat.finditer(text):
            candidate = match.group(0).strip()
            binary_bytes = re.findall(r"[01]{8}", candidate)
            if len(binary_bytes) < 3:
                continue
            try:
                byte_vals = bytearray([int(b, 2) for b in binary_bytes])
                decoded_text = byte_vals.decode("utf-8", errors="ignore")
                if len(decoded_text) >= 3 and _is_mostly_printable(decoded_text):
                    norm_decoded, _, _ = normalize_text_for_security(decoded_text)
                    leet_decoded, _ = normalize_leetspeak(norm_decoded)
                    for category, rules in INJECTION_SIGNATURES.items():
                        for pattern, rule_name, conf in rules:
                            if (re.search(pattern, norm_decoded, re.IGNORECASE) or 
                                re.search(pattern, leet_decoded, re.IGNORECASE) or
                                re.search(pattern, decoded_text, re.IGNORECASE)):
                                threats.append(DetectedThreat(
                                    category=category,
                                    rule_name=f"binary_{rule_name}",
                                    matched_snippet=candidate[:60],
                                    confidence=conf,
                                    is_obfuscated=True,
                                    encoding_type="binary",
                                    decoded_payload=norm_decoded[:200]
                                ))
            except Exception:
                pass

    # 4. ROT13 SCANNER
    try:
        rot13_text = codecs.decode(text, "rot_13")
        norm_rot13, _, _ = normalize_text_for_security(rot13_text)
        leet_rot13, _ = normalize_leetspeak(norm_rot13)
        for category, rules in INJECTION_SIGNATURES.items():
            for pattern, rule_name, conf in rules:
                if category in ("system_override", "jailbreak_persona", "scoring_coercion"):
                    m = (re.search(pattern, norm_rot13, re.IGNORECASE) or 
                         re.search(pattern, leet_rot13, re.IGNORECASE) or
                         re.search(pattern, rot13_text, re.IGNORECASE))
                    if m:
                        threats.append(DetectedThreat(
                            category=category,
                            rule_name=f"rot13_{rule_name}",
                            matched_snippet=m.group(0)[:60],
                            confidence=conf,
                            is_obfuscated=True,
                            encoding_type="rot13",
                            decoded_payload=m.group(0)
                        ))
    except Exception:
        pass

    # 5. URL PERCENT-ENCODING SCANNER
    if "%" in text:
        try:
            unquoted = urllib.parse.unquote(text)
            if unquoted != text:
                norm_unquoted, _, _ = normalize_text_for_security(unquoted)
                leet_unquoted, _ = normalize_leetspeak(norm_unquoted)
                for category, rules in INJECTION_SIGNATURES.items():
                    for pattern, rule_name, conf in rules:
                        m = (re.search(pattern, norm_unquoted, re.IGNORECASE) or 
                             re.search(pattern, leet_unquoted, re.IGNORECASE) or
                             re.search(pattern, unquoted, re.IGNORECASE))
                        if m and not re.search(pattern, text, re.IGNORECASE):
                            threats.append(DetectedThreat(
                                category=category,
                                rule_name=f"url_{rule_name}",
                                matched_snippet=m.group(0)[:60],
                                confidence=conf,
                                is_obfuscated=True,
                                encoding_type="url_percent",
                                decoded_payload=m.group(0)
                            ))
        except Exception:
            pass

    # 6. HTML & MARKDOWN COMMENT SMUGGLING SCANNER
    for comment_match in HTML_MARKDOWN_COMMENT_REGEX.finditer(text):
        raw_comment = comment_match.group(0)
        inner_content = re.sub(r"^<!--|-->$|^\[//\]:\s*#\s*\(|\)$|^/\*|\*/$", "", raw_comment).strip()
        if len(inner_content) >= 6:
            norm_c, _, _ = normalize_text_for_security(inner_content)
            leet_c, _ = normalize_leetspeak(norm_c)
            for category, rules in INJECTION_SIGNATURES.items():
                for pattern, rule_name, conf in rules:
                    if re.search(pattern, norm_c, re.IGNORECASE) or re.search(pattern, leet_c, re.IGNORECASE):
                        threats.append(DetectedThreat(
                            category=category,
                            rule_name=f"comment_{rule_name}",
                            matched_snippet=raw_comment[:60],
                            confidence=conf,
                            is_obfuscated=True,
                            encoding_type="comment_smuggling",
                            decoded_payload=norm_c[:200]
                        ))

    return threats


def scan_prompt_injection(raw_text: str) -> InjectionScanResult:
    """
    Comprehensive multi-layer prompt injection scan:
    1. Normalizes text (Unicode NFKD/NFKC, invisible characters stripped, homoglyphs resolved, leetspeak resolved).
    2. Runs direct regex pattern matrix across 7 threat categories.
    3. Runs multi-encoding de-obfuscation scanner (Base64, Hex, Binary, ROT13, URL, Comment smuggling).
    4. Computes threat level and generates structured security flags.
    """
    result = InjectionScanResult()
    if not raw_text or not raw_text.strip():
        return result

    # 1. Native script normalization (stripping invisible chars without homoglyph replacement)
    raw_cleaned = INVISIBLE_CHARS_REGEX.sub("", raw_text)
    native_nfkc = unicodedata.normalize("NFKC", raw_cleaned)

    # 2. Homoglyph resolved normalization
    norm_text, had_inv, had_homo = normalize_text_for_security(raw_text)
    leet_text, had_leet = normalize_leetspeak(norm_text)
    
    result.normalized_text = norm_text
    result.had_invisible_unicode = had_inv
    result.had_homoglyphs = had_homo
    result.had_leetspeak = had_leet

    threats: List[DetectedThreat] = []

    # 3. Direct Pattern Matrix Scan
    for category, rules in INJECTION_SIGNATURES.items():
        scan_target = native_nfkc if category == "multi_lingual" else norm_text
        for pattern, rule_name, conf in rules:
            # Check normalized text
            for match in re.finditer(pattern, scan_target, re.IGNORECASE):
                threats.append(DetectedThreat(
                    category=category,
                    rule_name=rule_name,
                    matched_snippet=match.group(0)[:80],
                    confidence=conf,
                    is_obfuscated=False
                ))
            # Check leetspeak normalized text if not already matched
            if had_leet and category != "multi_lingual":
                for match in re.finditer(pattern, leet_text, re.IGNORECASE):
                    if not any(t.rule_name == rule_name for t in threats):
                        threats.append(DetectedThreat(
                            category=category,
                            rule_name=f"leet_{rule_name}",
                            matched_snippet=match.group(0)[:80],
                            confidence=conf,
                            is_obfuscated=True,
                            encoding_type="leetspeak",
                            decoded_payload=match.group(0)
                        ))

    # 4. Multi-Encoding De-Obfuscation Scan (Base64, Hex, Binary, ROT13, URL, Comment)
    encoded_threats = scan_encoded_payloads(raw_text)
    if encoded_threats:
        result.had_encoded_payloads = True
        threats.extend(encoded_threats)

    result.detected_threats = threats

    # 5. Synthesize Security Flags & Threat Level
    if not threats:
        result.is_suspicious = False
        result.threat_level = "clean"
        return result

    result.is_suspicious = True
    flags: List[str] = [FLAG_INJECTION_DETECTED]

    max_conf = max(t.confidence for t in threats)
    if max_conf >= 0.95 or len(threats) >= 2 or result.had_encoded_payloads:
        result.threat_level = "critical" if result.had_encoded_payloads else "high"
    elif max_conf >= 0.85:
        result.threat_level = "medium"
    else:
        result.threat_level = "low"

    # Category-specific flags
    categories = {t.category for t in threats}
    encodings = {t.encoding_type for t in threats if t.is_obfuscated and t.encoding_type}

    if "base64" in encodings:
        flags.append(FLAG_OBFUSCATED_BASE64)
    if "hex" in encodings:
        flags.append(FLAG_OBFUSCATED_HEX)
    if "binary" in encodings:
        flags.append(FLAG_OBFUSCATED_BINARY)
    if "rot13" in encodings:
        flags.append(FLAG_OBFUSCATED_ROT13)
    if "leetspeak" in encodings or had_leet:
        flags.append(FLAG_OBFUSCATED_LEETSPEAK)
    if "comment_smuggling" in encodings:
        flags.append(FLAG_COMMENT_SMUGGLING)
    if had_inv or had_homo:
        flags.append(FLAG_OBFUSCATED_UNICODE)
    if "special_tokens" in categories:
        flags.append(FLAG_SPECIAL_TOKENS)
    if "scoring_coercion" in categories:
        flags.append(FLAG_SCORING_COERCION)
    if "multi_lingual" in categories:
        flags.append(FLAG_MULTI_LINGUAL_INJECTION)
    if "delimiter_tampering" in categories:
        flags.append(FLAG_DELIMITER_TAMPERING)

    result.security_flags = list(dict.fromkeys(flags))  # Deduplicate preserving order

    logger.warning(
        f"[SECURITY AUDIT] Prompt injection detected (threat_level={result.threat_level}, "
        f"flags={result.security_flags}, threat_count={len(threats)})"
    )
    return result


def validate_untrusted_input(
    raw_text: Optional[str],
    field_name: str = "Input",
    min_chars: int = 1,
    max_chars: int = 25000,
    allow_empty: bool = False
) -> str:
    """
    Gatekeeper validation for untrusted user/recruiter input at API boundaries:
    1. Validates minimum and maximum length bounds (prevents DOS / token exhaustion).
    2. Runs comprehensive de-obfuscation and prompt injection scan across all encoding vectors (Base64, Binary, Hex, ROT13, Leetspeak, Unicode, etc.).
    3. If threat_level is medium, high, or critical, raises an explicit HTTPException(400) with detailed security audit flags.
    4. Returns stripped, normalized text ready for processing.
    """
    from fastapi import HTTPException

    if raw_text is None or not str(raw_text).strip():
        if allow_empty or min_chars == 0:
            return ""
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} is required and cannot be empty."
        )

    text_str = str(raw_text).strip()
    char_len = len(text_str)

    if min_chars > 0 and char_len < min_chars:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} is too short ({char_len} characters). Minimum required is {min_chars} characters."
        )

    if char_len > max_chars:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} exceeds maximum length of {max_chars} characters (received {char_len} characters)."
        )

    scan_res = scan_prompt_injection(text_str)
    if scan_res.is_suspicious and scan_res.threat_level in ("medium", "high", "critical"):
        flags_str = ", ".join(scan_res.security_flags)
        logger.warning(
            f"[SECURITY GATEKEEPER] Rejected adversarial {field_name} submission "
            f"(threat_level={scan_res.threat_level}, flags={scan_res.security_flags})"
        )
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} contains invalid or adversarial content ({flags_str}). Please provide standard content without prompt injection or encoded commands."
        )

    return text_str


def sanitize_untrusted_input(raw_text: str, label: str = "USER_INPUT", max_chars: int = MAX_ANSWER_CHARS) -> Tuple[str, InjectionScanResult]:
    """
    Sanitizes untrusted text (interview answers, probes, free-form notes):
    1. Caps length at max_chars (default 3000) to prevent token exhaustion / DOS attacks.
    2. Strips invisible/zero-width characters and normalizes Unicode.
    3. Scans for direct and multi-encoded (Base64, Hex, Binary, ROT13, Leetspeak, Homoglyphs) injections.
    4. Redacts detected malicious tokens and commands while preserving legitimate context.
    
    Returns (sanitized_text, scan_result).
    """
    if not raw_text:
        return "", InjectionScanResult()

    # 1. Enforce length cap
    capped_text = str(raw_text).strip()[:max_chars]

    # 2. Scan for prompt injection across all encoding vectors
    scan_res = scan_prompt_injection(capped_text)

    # 3. If suspicious, neutralize special tokens, spoofed delimiters, and matched malicious phrases
    sanitized = capped_text
    if scan_res.is_suspicious:
        logger.warning(
            f"[SECURITY GUARD] Prompt injection neutralized in {label} "
            f"(threat_level={scan_res.threat_level}, flags={scan_res.security_flags})"
        )
        
        # Redact special tokens & fake delimiters
        sanitized = re.sub(r"<\|?\s*(?:im_start|im_end|system|user|assistant|endoftext)\s*\|?>", "[TOKEN_REDACTED]", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"\[/?(?:INST|SYS|SYSTEM)\]", "[TOKEN_REDACTED]", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"<<\s*(?:SYS|SYSTEM)\s*>>", "[TOKEN_REDACTED]", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"===+\s*(?:BEGIN|START|END)\s*(?:OF\s+)?.*?===+", "[DELIMITER_REDACTED]", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"<<<\s*UNTRUSTED_.*?>>>", "[DELIMITER_REDACTED]", sanitized, flags=re.IGNORECASE)
        
        # Redact direct override commands and decoded payloads
        for threat in scan_res.detected_threats:
            if not threat.is_obfuscated and threat.matched_snippet:
                escaped = re.escape(threat.matched_snippet)
                sanitized = re.sub(escaped, "[SECURITY_REDACTED_INJECTION]", sanitized, flags=re.IGNORECASE)
            elif threat.is_obfuscated and threat.matched_snippet:
                escaped = re.escape(threat.matched_snippet)
                sanitized = re.sub(escaped, f"[SECURITY_REDACTED_PAYLOAD]", sanitized, flags=re.IGNORECASE)

    return sanitized.strip(), scan_res


# Unified alias for backward compatibility
sanitize_interview_answer = sanitize_untrusted_input



def sanitize_extracted_field(val: Any) -> Any:
    """
    Sanitizes extracted fields (name, title, skills, description, bullets) to prevent
    downstream prompt injection or stored XSS when data flows to jd_matcher, question_generator, or evaluator.
    """
    if val is None:
        return val

    if isinstance(val, str):
        # 1. Strip invisible Unicode
        cleaned, _, _ = normalize_text_for_security(val)
        # 2. Neutralize ChatML & special control tokens
        cleaned = re.sub(r"<\|?\s*(?:im_start|im_end|system|user|assistant|endoftext)\s*\|?>", "[TOKEN_REDACTED]", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\[/?(?:INST|SYS|SYSTEM)\]", "[TOKEN_REDACTED]", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"<<\s*(?:SYS|SYSTEM)\s*>>", "[TOKEN_REDACTED]", cleaned, flags=re.IGNORECASE)
        # 3. Neutralize direct override commands if embedded in field
        cleaned = re.sub(r"(?i)\b(?:system\s+override|ignore\s+previous\s+instructions|disregard\s+all\s+instructions)\b", "[REDACTED_COMMAND]", cleaned)
        return cleaned.strip()

    elif isinstance(val, list):
        return [sanitize_extracted_field(item) for item in val]

    elif isinstance(val, dict):
        return {k: sanitize_extracted_field(v) for k, v in val.items()}

    return val
