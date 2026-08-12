import re
from typing import Dict, Any, Tuple, Optional
from app.agent.schemas import (
    RequirementItemBreakdown,
    ExperienceBreakdown,
    TrajectoryBreakdown,
    PenaltyBreakdownItem,
)

from app.agent.tools.timeline import generate_experience_calculation_summary
from app.agent.tools.verification import (
    extract_dynamic_requirement_tokens,
    check_dynamic_token_presence,
    classify_evidence_source,
    SKILLS_LIST_PROSE_PATTERNS,
    normalize_text,
    _is_quote_in_text
)

TENURE_PATTERN = re.compile(
    r"(\b\d+\+?\s*(years?|yrs?|yr)\b|\byears?\s+of\s+(professional\s+)?(software\s+engineering\s+|development\s+)?experience\b|\bminimum\s+\d+\s+years?\b|\b\d+\+\s*years?\b)",
    re.IGNORECASE
)

GENERIC_TENURE_WORDS = {
    "software", "engineering", "experience", "professional", "development",
    "minimum", "years", "yrs", "year", "yr", "work", "industry", "field",
    "hands-on", "strong", "proven", "track", "record", "background", "overall",
    "total", "relevant", "domain", "in", "of", "with", "and", "for", "a", "an"
}

def _filter_tenure_requirements(items: list) -> list:
    """Sanitize requirement lists to ensure pure experience duration requirements are strictly owned by Experience Depth,
    while technical skills with embedded tenure quantifiers (e.g., 'Python and FastAPI (3+ years)') have the tenure phrase stripped
    and are retained in the qualitative skill list.
    """
    if not items:
        return []
    filtered = []
    for item in items:
        req_name = getattr(item, "requirement", item.get("requirement", "") if isinstance(item, dict) else str(item))
        req_type = getattr(item, "req_type", item.get("req_type", "") if isinstance(item, dict) else "")
        
        # Explicit tenure duration items are strictly owned by Experience Depth
        if req_type == "tenure_duration":
            continue

        # Bullets starting with a tenure quantifier (e.g. '5+ years...', 'Minimum 3 years...') are pure tenure requirements
        if re.match(r"^\s*(?:minimum\s+|at\s+least\s+)?\d+(?:\.\d+)?\+?\s*(?:years?|yrs?|yr)\b", req_name, re.IGNORECASE):
            continue

        is_tenure = (
            TENURE_PATTERN.search(req_name) is not None or
            bool(re.search(r"\b\d+\+?\s*(?:years?|yrs?|yr)\b", req_name, re.IGNORECASE))
        )
        if is_tenure:
            cleaned = re.sub(r"\s*\(\s*\d+(?:\.\d+)?\+?\s*(?:years?|yrs?|yr)\b[^\)]*\)", "", req_name, flags=re.IGNORECASE)
            cleaned = re.sub(r"\b(?:minimum\s+)?\d+(?:\.\d+)?\+?\s*(?:years?|yrs?|yr)\b(?:\s+of\s+(?:professional\s+)?(?:software\s+engineering\s+|development\s+)?experience)?", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"^\s*(?:experience\s+with|expertise\s+with|strong\s+hands-on\s+expertise\s+with|hands-on\s+experience\s+with|minimum\s+of)\s+", "", cleaned, flags=re.IGNORECASE)
            cleaned = cleaned.strip(" :-–—(),.")

            tokens = [w.lower() for w in re.findall(r"\w+", cleaned)]
            substantive_tokens = [w for w in tokens if w not in GENERIC_TENURE_WORDS]

            if not substantive_tokens:
                continue

            if hasattr(item, "requirement"):
                item.requirement = cleaned
            elif isinstance(item, dict) and "requirement" in item:
                item["requirement"] = cleaned

        filtered.append(item)
    return filtered

LOW_PROFICIENCY_KEYWORDS = (
    "some exposure", "limited exposure", "basic exposure", "basic knowledge",
    "familiarity with", "assisted with", "assisted", "supervised use", "introductory",
    "learning", "(learning)", "personal project", "personal projects",
    "beginner", "self-taught", "coursework", "academic use", "student"
)

NEGATIVE_EVIDENCE_PHRASES = (
    "no evidence", "no specific", "not mentioned", "no direct",
    "lack of", "absence of", "no explicit", "unmentioned", "not listed"
)

def _sanitize_match_val(req_name: str, match_val: str, evidence_val: str, item: Any = None, eval_mode: str = "default", candidate_profile: Any = None) -> Tuple[str, str]:
    """
    Domain-agnostic evidence guardrail to prevent evidence inflation/stretching:
    0. Zero Proficiency Signal Guardrail: If proficiency_signal is 'none', force match_val to 'none'.
    1. Proficiency Qualifier Cap: If evidence, proficiency signal, or profile raw skills contain low-proficiency keywords ('assisted', 'learning', 'basic exposure'), cap match_val at 'partial'.
    2. Parenthetical Alternatives Upgrade: If requirement lists alternatives in parentheses and evidence names one explicitly, upgrade partial -> full.
    3. Self-Contradiction Guardrail: If match is non-none, but evidence explicitly states absence of evidence, force match_val to 'none'.
    4. Soft / Unevidenced Skill Listing Guardrail: If evidence_type is 'skills_list_only', 'inferred', or 'absent', or text indicates merely listed in skills section, force match_val to 'none'.
    """
    req_lower = req_name.lower()
    ev_lower = evidence_val.lower()
    override_note = ""

    # Extract structured enum attributes if available on item
    ev_type = getattr(item, "evidence_type", None) if item else None
    if ev_type is None and isinstance(item, dict):
        ev_type = item.get("evidence_type")

    prof_signal = getattr(item, "proficiency_signal", None) if item else None
    if prof_signal is None and isinstance(item, dict):
        prof_signal = item.get("proficiency_signal")

    declared_in_skills = getattr(item, "declared_in_skills", False) or (isinstance(item, dict) and item.get("declared_in_skills", False)) or False
    is_declared_only = bool(
        declared_in_skills or
        ev_type == "skills_list_only" or
        "declared in skills" in ev_lower or
        "skills section" in ev_lower or
        "listed in skills" in ev_lower
    )

    raw_cv_text = str(getattr(candidate_profile, "raw_cv_text", "") or "").strip() if candidate_profile else ""
    struct_source = ev_type if ev_type else "inferred"

    # Rule 0: Zero Proficiency Signal Guardrail (only for unevidenced & non-declared skills)
    if match_val != "none" and prof_signal == "none" and not is_declared_only and not declared_in_skills:
        match_val = "none"
        override_note = " [Overridden to none: proficiency signal is none]"
        if item is not None:
            if hasattr(item, "match"):
                try:
                    item.match = match_val
                except AttributeError:
                    pass
            elif isinstance(item, dict):
                item["match"] = match_val
        return match_val, override_note

    # Rule 1: Low-proficiency / hedging qualifier cap
    has_hedge = (
        prof_signal in ("assisted", "learning") or
        any(k in ev_lower for k in LOW_PROFICIENCY_KEYWORDS)
    )
    if not has_hedge and candidate_profile and match_val == "full":
        cand_skills = getattr(candidate_profile, "skills", []) or []
        req_tokens_rule1 = extract_dynamic_requirement_tokens(req_name)
        for s in cand_skills:
            s_lower = str(s).lower()
            if any(tw in s_lower for tw in req_tokens_rule1) and any(k in s_lower for k in LOW_PROFICIENCY_KEYWORDS):
                has_hedge = True
                break

    # Scope raw CV hedging check to lines containing the evidence quote snippet or requirement tokens
    if not has_hedge and candidate_profile and match_val == "full":
        raw_cv = str(getattr(candidate_profile, "raw_cv_text", "") or "").lower()
        if raw_cv:
            # 1. Exact line check via evidence snippet
            ev_snippet = ev_lower[:40].strip() if ev_lower else ""
            if ev_snippet and ev_snippet in raw_cv:
                idx = raw_cv.find(ev_snippet)
                line_start = raw_cv.rfind('\n', 0, idx)
                line_end = raw_cv.find('\n', idx)
                line_start = 0 if line_start == -1 else line_start
                line_end = len(raw_cv) if line_end == -1 else line_end
                cv_line = raw_cv[line_start:line_end]
                if any(k in cv_line for k in LOW_PROFICIENCY_KEYWORDS):
                    has_hedge = True

            # 2. Token-based line check in raw CV if snippet match didn't find hedge
            if not has_hedge:
                req_tokens_hedge = extract_dynamic_requirement_tokens(req_name)
                if req_tokens_hedge:
                    for cv_line in raw_cv.splitlines():
                        if any(tw in cv_line for tw in req_tokens_hedge if len(tw) >= 3):
                            if any(k in cv_line for k in LOW_PROFICIENCY_KEYWORDS):
                                has_hedge = True
                                break

    if match_val == "full" and has_hedge:
        match_val = "partial"
        override_note = " [Capped to partial due to low-proficiency / hedging qualifier in evidence or profile]"

    # Rule 2: Parenthetical Alternatives Upgrade (Domain-Agnostic)
    if match_val == "partial" and not has_hedge:
        paren_match = re.search(r'\(([^)]+)\)', req_lower)
        if paren_match:
            raw_options = re.split(r'[/,|]|\b(?:or|and/or|and|e\.g\.|i\.e\.|such as)\b', paren_match.group(1), flags=re.IGNORECASE)
            alternatives = []
            for opt in raw_options:
                cleaned_opt = opt.strip(" ().-:,'\"`")
                if cleaned_opt and len(cleaned_opt) >= 2 and cleaned_opt.lower() not in {"or", "and", "etc", "e.g", "i.e"}:
                    alternatives.append(cleaned_opt.lower())

            # Detect negative, migration, or deprecation qualifiers in evidence
            migration_pattern = re.compile(
                r"\b(?:migrat\w*|moving\s+away|moved|transition\w*|replac\w*|deprecat\w*|decommission\w*|phased?\s+out|no\s+experience|evaluated\s+but|instead\s+of)\b",
                re.IGNORECASE
            )
            has_migration = migration_pattern.search(ev_lower) is not None

            if not has_migration:
                ignore_words = {"standards", "tools", "systems", "services", "solutions", "frameworks", "practices", "methods", "platform", "platforms"}
                for alt in alternatives:
                    # Match full option or core substantive words of option
                    sub_words = [w for w in re.findall(r'\b[a-zA-Z0-9+#/\-]+\b', alt) if w not in ignore_words and len(w) >= 2]
                    words_to_check = sub_words if sub_words else [alt]
                    for target_word in words_to_check:
                        pattern = rf"\b{re.escape(target_word)}\b" if not any(c in target_word for c in "+#/-.") else re.escape(target_word)
                        if re.search(pattern, ev_lower):
                            match_val = "full"
                            override_note = " [Upgraded to full: evidence names an exact alternative from requirement's listed options]"
                            break
                    if match_val == "full":
                        break

    # Rule 3: Self-Contradiction Guardrail (Evidence text explicitly states absence of requirement/evidence)
    has_negative_phrase = any(p in ev_lower for p in NEGATIVE_EVIDENCE_PHRASES)
    if match_val != "none" and (has_negative_phrase or (ev_type == "absent" and any(p in ev_lower for p in ("no direct evidence", "no evidence", "not mentioned", "absence of")))):
        match_val = "none"
        override_note = " [Overridden to none: evidence explicitly states absence of requirement or evidence]"

    # Rule 4: Soft / Unevidenced Skill Listing & Anti-Fabrication Guardrail
    if match_val != "none":
        # 1. Deterministic structural classification if profile and text evidence available
        if candidate_profile and raw_cv_text and evidence_val and not is_declared_only and not declared_in_skills:
            struct_source = classify_evidence_source(req_name, candidate_profile=candidate_profile, evidence_quote=evidence_val)
            if struct_source in ("skills_list_only", "absent") and ev_type != "unverified":
                ev_type = struct_source

        # 2. Quote Grounded Anti-Fabrication Check: If evidence quote is absent on CV and not fail-soft unverified or claim_only, force match to none
        if struct_source == "absent" and ev_type != "unverified" and not is_declared_only and not declared_in_skills and evidence_val and len(evidence_val.strip()) >= 5:
            match_val = "none"
            override_note = " [Overridden to none: unevidenced or absent quote on CV]"

        # 3. Check prose pattern matching & skills-list-only override (only if not declared_in_skills or claim_only)
        if match_val != "none":
            declared_in_skills = getattr(item, "declared_in_skills", False) or False
            is_skills_only = (
                ev_type == "skills_list_only" or
                any(pat.search(ev_lower) for pat in SKILLS_LIST_PROSE_PATTERNS) or
                "listed as a skill" in ev_lower or
                "listed in skills" in ev_lower or
                "skills list" in ev_lower or
                "declared in skills" in ev_lower
            )

            from app.agent.tools.verification import SUBSTANTIVE_EXECUTION_VERBS
            has_substantive_execution = any(v in ev_lower for v in SUBSTANTIVE_EXECUTION_VERBS)

            if is_skills_only and not has_substantive_execution:
                if declared_in_skills or "declared in skills" in ev_lower or "skills section" in ev_lower:
                    # Claim-Aware Scoring: Declared-only skills score partial credit + raised flag
                    match_val = "partial"
                    override_note = " [Claim-only skill: declared in skills section, partial credit assigned]"
                else:
                    substantive = re.sub(r"listed\s+['\"`]?\w+['\"`]?\s+as\s+a\s+skill", "", ev_lower, flags=re.IGNORECASE)
                    substantive = re.sub(r"listed\s+in\s+skills\s*(section)?", "", substantive, flags=re.IGNORECASE)
                    substantive = re.sub(r"skills?\s+list\s*(includes?)?", "", substantive, flags=re.IGNORECASE)
                    substantive = re.sub(r"used\s+in\s+(previous\s+)?role", "", substantive, flags=re.IGNORECASE)
                    substantive = re.sub(r"listed\s+in\s+(summary|cv|profile)", "", substantive, flags=re.IGNORECASE)
                    substantive = re.sub(r"participated\s+in\s+on-call\s+rotation", "", substantive, flags=re.IGNORECASE).strip(" ;,.-")
                    if len(substantive) < 5 or ev_type == "skills_list_only":
                        match_val = "none"
                        override_note = " [Overridden to none: unevidenced skill listing without substantive employment/project execution]"

    if item is not None and match_val != getattr(item, "match", None):
        if hasattr(item, "match"):
            item.match = match_val
        elif isinstance(item, dict):
            item["match"] = match_val

    return match_val, override_note

def classify_degree_relevance(education_list: list, jd_keywords: list = None, canonical_jd_spec: Any = None) -> Tuple[float, str, str]:
    """
    Evaluates education records dynamically against the Target Role Domain extracted from JD keywords/spec.
    Returns (points_earned, evidence_summary, relevance_status).

    Tiers across ALL domains (Tech, Healthcare, Finance, Mechanical/Civil Eng, Legal, Education, Quant):
    - Tier 1 Direct Domain Match: 20.0 - 25.0 pts ('full')
    - Tier 2 Adjacent STEM / Foundational Discipline: 10.0 - 14.0 pts ('partial')
    - Tier 3 Unrelated Degree: 5.0 pts ('partial' low)
    """
    if not education_list:
        return 0.0, "No formal degree or educational records found on CV.", "none"

    edu_strings = []
    for item in education_list:
        if isinstance(item, str):
            if item.strip():
                edu_strings.append(item.strip())
        elif isinstance(item, dict):
            deg = item.get("degree") or item.get("title") or ""
            inst = item.get("institution") or item.get("school") or ""
            if deg or inst:
                edu_strings.append(f"{deg} - {inst}".strip(" -"))

    if not edu_strings:
        return 0.0, "No formal degree or educational records found on CV.", "none"

    all_edu_text = " ".join(edu_strings).lower()

    # Gather JD text indicators from role title, must-have skills, and keywords
    jd_parts = []
    if jd_keywords:
        jd_parts.extend([str(k) for k in jd_keywords])
    if canonical_jd_spec:
        if hasattr(canonical_jd_spec, "role_title") and canonical_jd_spec.role_title:
            jd_parts.append(str(canonical_jd_spec.role_title))
        if hasattr(canonical_jd_spec, "must_have_skills") and canonical_jd_spec.must_have_skills:
            jd_parts.extend([r.requirement_name for r in canonical_jd_spec.must_have_skills if hasattr(r, "requirement_name")])

    jd_text = " ".join(jd_parts).lower()
    is_advanced = any(deg in all_edu_text for deg in ["master", "m.s.", "m.a.", "ph.d", "phd", "doctorate", "mba", "md", "jd", "msn", "dnp"])

    if not jd_parts:
        pts = 20.0 if (len(edu_strings) >= 2 or is_advanced) else 14.0
        return pts, f"Educational Credentials ({'; '.join(edu_strings)}).", "partial"

    # Extract domain tokens
    from app.agent.tools.timeline import extract_domain_tokens
    domain_tokens = extract_domain_tokens(jd_parts) if jd_parts else set()
    edu_tokens = set(re.findall(r'[a-zA-Z0-9+#/\-]+', all_edu_text))

    # --- 1. Tech / Computer Science & IT Domain ---
    tech_jd_patterns = [
        r"\bsoftware\b", r"\bdeveloper\b", r"\bprogrammer\b", r"\bcode\b", r"\bcoding\b",
        r"\bbackend\b", r"\bfrontend\b", r"\bfullstack\b", r"\bfull-stack\b", r"\bdevops\b",
        r"\bcloud\b", r"\baws\b", r"\bazure\b", r"\bgcp\b", r"\bpython\b", r"\bjava\b",
        r"\bjavascript\b", r"\btypescript\b", r"\breact\b", r"\bnode\b", r"\bapi\b",
        r"\bartificial\s+intelligence\b", r"\bmachine\s+learning\b", r"\bdata\s+science\b",
        r"\bdata\s+engineer\b", r"\bcybersecurity\b", r"\bsystem\s+architect\b", r"\bweb\b"
    ]
    is_tech_jd = any(re.search(pat, jd_text) for pat in tech_jd_patterns)

    tech_tier1_patterns = [
        r"\bcomputer\s+science\b", r"\bbs\s+cs\b", r"\bb\.s\.\s+cs\b", r"\bsoftware\s+engineering\b", r"\bbs\s+se\b", r"\bb\.s\.\s+se\b",
        r"\binformation\s+technology\b", r"\bbs\s+it\b", r"\bb\.s\.\s+it\b", r"\bartificial\s+intelligence\b", r"\bbs\s+ai\b", r"\bb\.s\.\s+ai\b",
        r"\bmachine\s+learning\b", r"\bdata\s+science\b", r"\bbs\s+ds\b", r"\bb\.s\.\s+ds\b", r"\bcomputer\s+engineering\b", r"\bcybersecurity\b"
    ]
    is_tech_tier1_deg = any(re.search(pat, all_edu_text) for pat in tech_tier1_patterns)

    # --- 2. Healthcare & Clinical Sciences Domain ---
    health_jd_patterns = [
        r"\bnurse\b", r"\bnursing\b", r"\bpatient\b", r"\bclinical\b", r"\bhospital\b", r"\btriage\b",
        r"\bicu\b", r"\bpediatric\b", r"\bphysician\b", r"\bdoctor\b", r"\bmedical\b", r"\bpharma\b",
        r"\bpharmacy\b", r"\bhealthcare\b", r"\bhealth\b", r"\banatomy\b"
    ]
    is_health_jd = any(re.search(pat, jd_text) for pat in health_jd_patterns)

    health_tier1_patterns = [
        r"\bnursing\b", r"\bbsn\b", r"\bmsn\b", r"\bdnp\b", r"\bmedicine\b", r"\bm\.d\.\b", r"\bmd\b",
        r"\bpharmacy\b", r"\bpharmd\b", r"\bmedical\b", r"\bclinical\b", r"\bphysical\s+therapy\b"
    ]
    is_health_tier1_deg = any(re.search(pat, all_edu_text) for pat in health_tier1_patterns)

    # --- 3. Business, Finance & Accounting Domain ---
    biz_jd_patterns = [
        r"\bfinance\b", r"\bfinancial\b", r"\baccounting\b", r"\baccountant\b", r"\bcpa\b", r"\bgaap\b",
        r"\bifrs\b", r"\baudit\b", r"\btax\b", r"\bbanking\b", r"\binvestment\b", r"\bvaluation\b",
        r"\btreasury\b", r"\bbookkeeping\b", r"\bcontroller\b"
    ]
    is_biz_jd = any(re.search(pat, jd_text) for pat in biz_jd_patterns)

    biz_tier1_patterns = [
        r"\bfinance\b", r"\baccounting\b", r"\bcpa\b", r"\bchartered\s+accountant\b", r"\bcommerce\b",
        r"\bfinancial\s+engineering\b", r"\bfinancial\s+risk\b"
    ]
    is_biz_tier1_deg = any(re.search(pat, all_edu_text) for pat in biz_tier1_patterns)

    # --- 4. Non-CS Engineering & Physical Sciences Domain ---
    mech_jd_patterns = [r"\bmechanical\b", r"\bcad\b", r"\bsolidworks\b", r"\bthermodynamics\b", r"\bhvac\b", r"\brobotics\b", r"\bfluid\b"]
    civ_jd_patterns = [r"\bcivil\b", r"\bstructural\b", r"\bautocad\b", r"\bstaad\b", r"\brevit\b", r"\bgeotechnical\b", r"\bconcrete\b", r"\bbridge\b", r"\bconstruction\b"]
    chem_jd_patterns = [r"\bchemical\b", r"\bprocess\s+engineer\b", r"\bpolymer\b", r"\bpetroleum\b", r"\brefinery\b", r"\bmaterials\b"]
    aero_jd_patterns = [r"\baerospace\b", r"\bavionics\b", r"\baeronautic\b"]
    elec_jd_patterns = [r"\belectrical\b", r"\bcircuit\b", r"\bsemiconductor\b", r"\bpower\s+grid\b"]

    is_mech_jd = any(re.search(pat, jd_text) for pat in mech_jd_patterns)
    is_civ_jd = any(re.search(pat, jd_text) for pat in civ_jd_patterns)
    is_chem_jd = any(re.search(pat, jd_text) for pat in chem_jd_patterns)
    is_aero_jd = any(re.search(pat, jd_text) for pat in aero_jd_patterns)
    is_elec_jd = any(re.search(pat, jd_text) for pat in elec_jd_patterns)

    is_non_cs_eng_jd = (is_mech_jd or is_civ_jd or is_chem_jd or is_aero_jd or is_elec_jd)

    is_mech_deg = any(re.search(r"\bmechanical\b", all_edu_text) for _ in [1])
    is_civ_deg = any(re.search(r"\bcivil\b|\bstructural\b", all_edu_text) for _ in [1])
    is_chem_deg = any(re.search(r"\bchemical\b|\bpetroleum\b", all_edu_text) for _ in [1])
    is_aero_deg = any(re.search(r"\baerospace\b|\baeronautic\b", all_edu_text) for _ in [1])
    is_elec_deg = any(re.search(r"\belectrical\b", all_edu_text) for _ in [1])

    is_non_cs_eng_tier1_deg = (
        (is_mech_jd and is_mech_deg) or
        (is_civ_jd and is_civ_deg) or
        (is_chem_jd and is_chem_deg) or
        (is_aero_jd and is_aero_deg) or
        (is_elec_jd and is_elec_deg)
    )

    # --- 5. Law & Legal Domain ---
    law_jd_patterns = [r"\blegal\b", r"\battorney\b", r"\bcounsel\b", r"\blawyer\b", r"\blitigation\b", r"\bparalegal\b", r"\bjuris\b"]
    is_law_jd = any(re.search(pat, jd_text) for pat in law_jd_patterns)
    is_law_tier1_deg = any(re.search(r"\blaw\b|\bll\.?b\b|\bj\.?d\b|\bjuris\b|\bparalegal\b", all_edu_text) for _ in [1])

    # --- EVALUATE TIER CLASSIFICATION ---
    is_tier1 = False
    if is_tech_jd and is_tech_tier1_deg:
        is_tier1 = True
    elif is_health_jd and is_health_tier1_deg:
        is_tier1 = True
    elif is_biz_jd and is_biz_tier1_deg:
        is_tier1 = True
    elif is_non_cs_eng_jd and is_non_cs_eng_tier1_deg:
        is_tier1 = True
    elif is_law_jd and is_law_tier1_deg:
        is_tier1 = True
    elif domain_tokens & edu_tokens:
        is_tier1 = True

    if is_tier1:
        pts = 25.0 if (len(edu_strings) >= 2 or is_advanced) else 20.0
        return pts, f"Domain-Relevant Degree ({'; '.join(edu_strings)}) matching target field.", "full"

    # Tier 2: Domain-Aware Adjacent Disciplines (10 - 14 pts)
    is_tier2 = False
    if is_health_jd:
        health_adjacent_pats = [
            r"\bbiolog\w*\b", r"\bchemist\w*\b", r"\bbiochem\w*\b", r"\bhealth\s+science\b",
            r"\blife\s+science\b", r"\bpre-med\b", r"\bpublic\s+health\b", r"\bkinesiolog\w*\b",
            r"\bbioengineer\w*\b", r"\bbiomed\w*\b"
        ]
        if any(re.search(pat, all_edu_text) for pat in health_adjacent_pats):
            is_tier2 = True
    elif is_law_jd:
        law_adjacent_pats = [
            r"\bpoliti\w*\b", r"\bjustice\b", r"\bcriminolog\w*\b", r"\bphilosoph\w*\b",
            r"\bpolicy\b", r"\bgovernment\b", r"\bhistory\b", r"\bbusiness\b"
        ]
        if any(re.search(pat, all_edu_text) for pat in law_adjacent_pats):
            is_tier2 = True
    elif is_biz_jd:
        biz_adjacent_pats = [
            r"\beconomic\w*\b", r"\bbusiness\b", r"\bmathematic\w*\b", r"\bmath\b",
            r"\bstatistics\b", r"\bdata\b", r"\bmanagement\b", r"\banalytics\b", r"\bcommerce\b"
        ]
        if any(re.search(pat, all_edu_text) for pat in biz_adjacent_pats):
            is_tier2 = True
    elif is_tech_jd or is_non_cs_eng_jd:
        tech_adjacent_pats = [
            r"\bengineering\b", r"\btechnology\b", r"\bmathematic\w*\b", r"\bmath\b",
            r"\bphysics\b", r"\bstatistics\b", r"\bdata\b", r"\belectrical\b",
            r"\bmechanical\b", r"\bcivil\b", r"\bindustrial\b", r"\baerospace\b",
            r"\bchemical\b", r"\bcomputer\b", r"\bscience\b"
        ]
        if any(re.search(pat, all_edu_text) for pat in tech_adjacent_pats):
            is_tier2 = True
    else:
        general_stem_pats = [
            r"\bengineering\b", r"\btechnology\b", r"\bmathematic\w*\b", r"\bphysics\b",
            r"\bchemistry\b", r"\bbiology\b", r"\beconomics\b", r"\bbusiness\b"
        ]
        if any(re.search(pat, all_edu_text) for pat in general_stem_pats):
            is_tier2 = True

    if is_tier2:
        pts = 14.0 if (len(edu_strings) >= 2 or is_advanced) else 10.0
        return pts, f"Adjacent STEM / Foundational Discipline ({'; '.join(edu_strings)}). Provides core quantitative or technical background.", "partial"

    # Tier 3: Unrelated Degree (5.0 pts)
    return 5.0, f"Unrelated Degree Completed ({'; '.join(edu_strings)}). Low direct relevance to target role domain.", "partial"

def _compute_evidence_trajectory(candidate_profile: Any, skills_score: float, eval_mode: str, jd_keywords: list = None, canonical_jd_spec: Any = None) -> Tuple[float, list, str]:
    """
    Domain-agnostic trajectory calculated from verifiable structural profile signals.
    Returns (score, sub_criteria_list, calculation_summary).
    """
    from app.agent.schemas import TrajectorySubCriterion

    if not candidate_profile:
        fallback_score = 40.0 if eval_mode == "strict" else 60.0
        return fallback_score, [], f"Default baseline trajectory ({fallback_score:.0f} pts)."

    sub_criteria = []

    # 1. Career Progression
    roles = getattr(candidate_profile, "previous_roles", []) or []
    unique_titles = []
    for r in roles:
        t = getattr(r, "title", "") if hasattr(r, "title") else (r.get("title", "") if isinstance(r, dict) else "")
        if t and str(t).strip() and str(t).strip() not in unique_titles:
            unique_titles.append(str(t).strip())

    if len(unique_titles) >= 3:
        p1 = 25.0
        s1 = "full"
        e1 = f"{len(unique_titles)} distinct roles showing career growth: " + ", ".join(unique_titles[:3])
    elif len(unique_titles) >= 2:
        p1 = 15.0
        s1 = "partial"
        e1 = f"{len(unique_titles)} distinct roles listed: " + ", ".join(unique_titles)
    elif len(unique_titles) >= 1:
        p1 = 7.0
        s1 = "partial"
        e1 = f"1 role listed on CV: {unique_titles[0]}"
    else:
        p1 = 0.0
        s1 = "none"
        e1 = "No prior work experience roles listed."

    sub_criteria.append(TrajectorySubCriterion(
        criterion_name="Career Title Progression",
        points_earned=p1,
        max_points=25.0,
        rubric_rule="≥3 distinct roles = 25 pts | 2 roles = 15 pts | 1 role = 7 pts",
        evidence=e1,
        status=s1
    ))

    # 2. Skill Portfolio Breadth (Universal Cross-Domain Verification)
    skills = getattr(candidate_profile, "skills", []) or []
    raw_skill_names = [str(s).strip() for s in skills if str(s).strip()]

    GENERIC_SOFT_SKILLS = {
        "communication", "teamwork", "leadership", "time management", "problem solving",
        "adaptability", "creativity", "organization", "work ethic", "punctuality",
        "interpersonal skills", "multitasking", "attention to detail", "critical thinking",
        "collaboration", "flexibility", "self-motivated", "analytical skills", "soft skills"
    }

    # Extract substantive profile corpus from previous_roles and projects (excluding isolated skills section)
    roles_corpus_parts = []
    for r in roles:
        if isinstance(r, str):
            roles_corpus_parts.append(r)
        elif isinstance(r, dict):
            title = r.get("title", "")
            desc = r.get("description", "")
            skills_used = " ".join([str(s) for s in (r.get("skills_used", []) or [])])
            roles_corpus_parts.append(f"{title} {desc} {skills_used}")
        else:
            title = getattr(r, "title", "")
            desc = getattr(r, "description", "")
            skills_used = " ".join([str(s) for s in (getattr(r, "skills_used", []) or [])])
            roles_corpus_parts.append(f"{title} {desc} {skills_used}")

    projects = getattr(candidate_profile, "projects", []) or []
    achievements = getattr(candidate_profile, "key_achievements", []) or []
    projects_corpus_parts = []
    for p in projects:
        if isinstance(p, str):
            projects_corpus_parts.append(p)
        elif isinstance(p, dict):
            projects_corpus_parts.append(f"{p.get('title', '')} {p.get('name', '')} {p.get('description', '')}")
        else:
            p_t = getattr(p, "title", None) or getattr(p, "name", None) or str(p)
            p_d = getattr(p, "description", "")
            projects_corpus_parts.append(f"{p_t} {p_d}")
    for a in achievements:
        projects_corpus_parts.append(str(a))

    raw_cv = str(getattr(candidate_profile, "raw_cv_text", "") or "").lower()

    substantive_corpus = (
        " ".join(roles_corpus_parts + projects_corpus_parts) + " " + raw_cv
    ).lower()

    verified_skills = []
    unverified_skills = []
    skills_corpus = normalize_text(" ".join([str(s) for s in raw_skill_names]))

    for skill in raw_skill_names:
        s_clean = skill.lower().strip()
        if s_clean in GENERIC_SOFT_SKILLS:
            continue

        s_norm = normalize_text(skill)
        if not s_norm:
            continue

        if _is_quote_in_text(s_norm, substantive_corpus) or _is_quote_in_text(s_norm, skills_corpus):
            verified_skills.append(skill)
        else:
            unverified_skills.append(skill)

    verified_count = len(verified_skills)
    total_listed = len(raw_skill_names)

    if verified_count >= 8:
        p2 = 25.0
        s2 = "full"
        e2 = f"{verified_count} verified domain skills across roles/projects out of {total_listed} listed: " + ", ".join(verified_skills[:10]) + ("..." if len(verified_skills) > 10 else "")
    elif verified_count >= 4:
        p2 = 15.0
        s2 = "partial"
        e2 = f"{verified_count} verified domain skills across roles/projects out of {total_listed} listed: " + ", ".join(verified_skills)
    elif verified_count >= 1:
        p2 = 7.0
        s2 = "partial"
        e2 = f"{verified_count} verified domain skill on CV: " + ", ".join(verified_skills) + (f" ({len(unverified_skills)} unverified/soft skills excluded)" if unverified_skills else "")
    else:
        p2 = 0.0
        s2 = "none"
        e2 = f"0 domain skills verified in employment/project history ({total_listed} unverified/soft skills listed)."

    sub_criteria.append(TrajectorySubCriterion(
        criterion_name="Skill Portfolio Breadth",
        points_earned=p2,
        max_points=25.0,
        rubric_rule="≥8 verified skills = 25 pts | 4-7 verified = 15 pts | 1-3 verified = 7 pts",
        evidence=e2,
        status=s2
    ))

    # 3. Proven Deliverables & Projects
    proj_names = []
    for p in projects:
        if isinstance(p, str):
            proj_names.append(p)
        elif isinstance(p, dict):
            proj_names.append(str(p.get("title") or p.get("name") or str(p)))
        else:
            t = getattr(p, "title", None) or getattr(p, "name", None)
            proj_names.append(str(t) if t and not callable(t) else str(p))

    achieve_names = [str(a) for a in achievements if a]

    GENERIC_DUTY_PATTERNS = [
        r"^participated\s+in", r"^attended\s+", r"^assisted\s+with", r"^responsible\s+for",
        r"^helped\s+with", r"^monitored\s+", r"^on-call\s+rotation"
    ]
    raw_evidence = proj_names + achieve_names
    evidence_items = []
    for item_str in raw_evidence:
        item_lower = item_str.lower().strip()
        if any(re.search(pat, item_lower) for pat in GENERIC_DUTY_PATTERNS) and not any(char.isdigit() for char in item_str):
            continue
        evidence_items.append(item_str)

    if len(evidence_items) >= 3:
        p3 = 25.0
        s3 = "full"
        e3 = f"{len(evidence_items)} projects/achievements documented: " + "; ".join(evidence_items[:3])
    elif len(evidence_items) >= 1:
        p3 = 12.0
        s3 = "partial"
        e3 = f"{len(evidence_items)} project/achievement documented: " + "; ".join(evidence_items[:2])
    else:
        p3 = 0.0
        s3 = "none"
        e3 = "No independent projects or key achievements documented."

    sub_criteria.append(TrajectorySubCriterion(
        criterion_name="Proven Deliverables & Projects",
        points_earned=p3,
        max_points=25.0,
        rubric_rule="≥3 projects/achievements = 25 pts | 1-2 projects = 12 pts",
        evidence=e3,
        status=s3
    ))

    # 4. Educational Attainment & Degree Relevance
    education = getattr(candidate_profile, "education", []) or []
    p4, e4, s4 = classify_degree_relevance(education, jd_keywords, canonical_jd_spec=canonical_jd_spec)

    sub_criteria.append(TrajectorySubCriterion(
        criterion_name="Educational Relevance & Credentials",
        points_earned=p4,
        max_points=25.0,
        rubric_rule="Relevant Degree = 20-25 pts | Adjacent STEM/Foundational = 10-14 pts | Unrelated = 5 pts",
        evidence=e4,
        status=s4
    ))

    total_score = min(100.0, p1 + p2 + p3 + p4)
    calc_summary = f"Career Progression ({p1:.0f}/25) + Skill Breadth ({p2:.0f}/25) + Deliverables ({p3:.0f}/25) + Education ({p4:.0f}/25) = {total_score:.0f}/100 pts"

    return total_score, sub_criteria, calc_summary

MATCH_MULTIPLIERS = {
    # Lenient: partial credit is generous (75%), rewarding adjacent/transferable skills
    "lenient":  {"full": 1.00, "partial": 0.75, "none": 0.00},
    # Moderate/Default: balanced 50% partial credit
    "moderate": {"full": 1.00, "partial": 0.50, "none": 0.00},
    "default":  {"full": 1.00, "partial": 0.50, "none": 0.00},
    # Strict: partial credit is minimal (25%), penalising non-exact matches
    "strict":   {"full": 1.00, "partial": 0.25, "none": 0.00},
}

# IDENTICAL weights across all modes — monotonicity is guaranteed structurally, not
# by weight tweaking. Differentiation comes from:
#   1. MATCH_MULTIPLIERS (partial=75% lenient / 50% moderate / 25% strict)
#      → skills_score and nice_score are inherently L >= M >= S for any candidate
#   2. Trajectory defaults (80 lenient / 60 moderate / 40 strict)
#      → traj contribution is inherently L >= M >= S
#   3. Exp domain bounds (lenient/moderate floor=25, strict floor=0)
#      → exp contribution is inherently L >= M >= S
#   Using different weights breaks monotonicity for near-perfect candidates because
#   strict's 55% skills weight gives MORE pts than lenient's 45% when skills=100%.
WEIGHTS_CONFIG = {
    "lenient":  {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
    "default":  {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
    "moderate": {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
    "strict":   {"skills": 0.50, "exp": 0.25, "nice": 0.15, "traj": 0.10},
}

# Score ceiling per mode.
SCORE_CEILING = {
    "lenient":  100.0,
    "default":  100.0,
    "moderate": 100.0,
    "strict":   100.0,
}

# Lenient mode bonus: a modest flat bonus to reward trajectory & transferable skills
# for candidates with partial-but-real domain overlap (skills_score >= 15).
# Withheld for near-zero domain candidates (Jake Sullivan class) to avoid inflation.
LENIENT_BONUS = 4.0

def calculate_weighted_fit_score(
    score_breakdown: Any,
    eval_mode: str = "default",
    penalties: list = None,
    must_have: list = None,
    nice_to_have: list = None,
    experience_assessment: str = "",
    candidate_profile: Any = None,
    required_years: Optional[float] = None,
    canonical_jd_spec: Any = None,
) -> Tuple[int, str, str]:
    """
    Deterministic scoring engine that computes weighted scores, applies hard-filter penalties,
    assigns decisions ('advance', 'hold', 'reject') with zero LLM math drift,
    and constructs a fully transparent XAI breakdown for every requirement, tenure metric, and penalty.
    """
    eval_mode_key = (eval_mode or "default").lower().strip()
    if eval_mode_key not in WEIGHTS_CONFIG:
        eval_mode_key = "default"

    weights = WEIGHTS_CONFIG[eval_mode_key]
    multipliers = MATCH_MULTIPLIERS[eval_mode_key]
    
    # 1. Itemized Must-Have Skills Breakdown (Sanitized to prevent double scoring of tenure)
    must_have_list = _filter_tenure_requirements(must_have or [])
    must_have_breakdown_items = []
    max_skills_pts = weights["skills"] * 100.0
    num_must = len(must_have_list)
    claim_only_count = 0

    if num_must > 0:
        pts_per_must = max_skills_pts / num_must
        for item in must_have_list:
            req_name = getattr(item, "requirement", item.get("requirement", "") if isinstance(item, dict) else str(item))
            raw_match_val = getattr(item, "match", item.get("match", "none") if isinstance(item, dict) else "none")
            evidence_val = getattr(item, "evidence", item.get("evidence", "") if isinstance(item, dict) else "")
            
            declared_in_skills = getattr(item, "declared_in_skills", False) or (isinstance(item, dict) and item.get("declared_in_skills", False)) or False
            ev_bullet_ids = getattr(item, "evidence_bullet_ids", []) or (item.get("evidence_bullet_ids", []) if isinstance(item, dict) else []) or []
            ev_scope = getattr(item, "scope", None) or (item.get("scope") if isinstance(item, dict) else None)

            match_val, override_note = _sanitize_match_val(req_name, raw_match_val, evidence_val, item=item, eval_mode=eval_mode_key, candidate_profile=candidate_profile)
            
            mult = multipliers.get(match_val, 0.0)
            pct = mult * 100.0
            pts_earned = pts_per_must * mult

            is_claim_only = bool(
                declared_in_skills or
                "declared in skills" in evidence_val.lower() or
                "skills section" in evidence_val.lower() or
                "claim-only" in override_note.lower()
            )

            w_flag = None
            u_warning = None
            if is_claim_only:
                claim_only_count += 1
                w_flag = "CLAIM_ONLY"
                u_warning = f"⚠️ {req_name} — declared in skills section, no trace in experience or projects. Scored at partial credit. Human verification recommended."

            if match_val == "full":
                reason = f"Full requirement match (+{pts_earned:.1f} pts){override_note}"
            elif match_val == "partial":
                ded = pts_per_must - pts_earned
                reason = f"Partial match ({pct:.0f}% credit). Deduction: -{ded:.1f} pts{override_note}"
            else:
                reason = f"Requirement missing (0% credit). Deduction: -{pts_per_must:.1f} pts{override_note}"
                
            must_have_breakdown_items.append(RequirementItemBreakdown(
                requirement=req_name,
                match=match_val,
                points_earned=round(pts_earned, 1),
                max_points=round(pts_per_must, 1),
                percentage=pct,
                evidence=evidence_val,
                deduction_reason=reason,
                declared_in_skills=is_claim_only,
                evidence_bullet_ids=ev_bullet_ids,
                scope=ev_scope,
                warning_flag=w_flag,
                ui_warning=u_warning
            ))

    # 2. Itemized Nice-To-Have Skills Breakdown (Sanitized)
    nice_have_list = _filter_tenure_requirements(nice_to_have or [])
    nice_have_breakdown_items = []
    max_nice_pts = weights["nice"] * 100.0
    num_nice = len(nice_have_list)
    if num_nice > 0:
        pts_per_nice = max_nice_pts / num_nice
        for item in nice_have_list:
            req_name = getattr(item, "requirement", item.get("requirement", "") if isinstance(item, dict) else str(item))
            raw_match_val = getattr(item, "match", item.get("match", "none") if isinstance(item, dict) else "none")
            evidence_val = getattr(item, "evidence", item.get("evidence", "") if isinstance(item, dict) else "")
            
            match_val, override_note = _sanitize_match_val(req_name, raw_match_val, evidence_val, item=item, eval_mode=eval_mode_key, candidate_profile=candidate_profile)
            
            mult = multipliers.get(match_val, 0.0)
            pct = mult * 100.0
            pts_earned = pts_per_nice * mult

            if match_val == "full":
                reason = f"Preferred skill satisfied (+{pts_earned:.1f} pts){override_note}"
            elif match_val == "partial":
                reason = f"Partial match ({pct:.0f}% credit) (+{pts_earned:.1f} pts){override_note}"
            else:
                reason = f"Preferred skill missing (0 pts){override_note}"
                
            nice_have_breakdown_items.append(RequirementItemBreakdown(
                requirement=req_name,
                match=match_val,
                points_earned=round(pts_earned, 1),
                max_points=round(pts_per_nice, 1),
                percentage=pct,
                evidence=evidence_val,
                deduction_reason=reason
            ))

    # 3. Deterministic Category Sub-Scores (0-100 scale)
    raw_skills = getattr(score_breakdown, "required_skills_score", None)
    if num_must > 0:
        skills_score = sum(item.percentage for item in must_have_breakdown_items) / num_must
    elif raw_skills is not None:
        skills_score = float(raw_skills)
    else:
        skills_score = 50.0

    raw_nice = getattr(score_breakdown, "nice_to_have_score", None)
    if num_nice > 0:
        nice_score = sum(item.percentage for item in nice_have_breakdown_items) / num_nice
    elif raw_nice is not None:
        nice_score = float(raw_nice)
    else:
        # If JD has no nice-to-have items, candidate gets full credit
        nice_score = 100.0

    # Experience Score (Floor Removal: Ratio Y_relevant / Y_req with relevance proportion discount)
    cand_years = float(getattr(candidate_profile, "total_experience_years", 0.0) if candidate_profile else 0.0)

    # Determine relevant years (prioritize deterministic code calculation from work experience roles)
    rel_years = None
    if candidate_profile and hasattr(candidate_profile, "previous_roles") and candidate_profile.previous_roles:
        from app.agent.tools.timeline import calculate_experience_for_domain
        domain_kw = []
        if canonical_jd_spec and hasattr(canonical_jd_spec, "must_have_skills"):
            domain_kw.extend([r.requirement_name for r in canonical_jd_spec.must_have_skills if hasattr(r, "requirement_name")])
        if canonical_jd_spec and hasattr(canonical_jd_spec, "role_title") and canonical_jd_spec.role_title:
            domain_kw.append(canonical_jd_spec.role_title)
        if not domain_kw and must_have:
            for item in must_have:
                req_name = item.get("requirement") if isinstance(item, dict) else getattr(item, "requirement", "")
                if req_name:
                    domain_kw.append(str(req_name))
        det_years = calculate_experience_for_domain(candidate_profile.previous_roles, keywords=domain_kw)
        if det_years > 0:
            rel_years = det_years

    if rel_years is None and hasattr(score_breakdown, "relevant_experience_years") and score_breakdown.relevant_experience_years is not None:
        rel_years = float(score_breakdown.relevant_experience_years)
    elif rel_years is None and candidate_profile and hasattr(candidate_profile, "relevant_experience_years") and candidate_profile.relevant_experience_years is not None:
        rel_years = float(candidate_profile.relevant_experience_years)

    if rel_years is None and experience_assessment:
        match_rel = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:directly\s+)?relevant", experience_assessment, re.IGNORECASE)
        if match_rel:
            try:
                rel_years = float(match_rel.group(1))
            except (ValueError, TypeError):
                rel_years = None

    effective_exp_years = rel_years if rel_years is not None else cand_years

    # Determine required years
    req_years = None
    if required_years is not None:
        try:
            req_years = float(required_years)
        except (ValueError, TypeError):
            req_years = None

    if req_years is None and canonical_jd_spec is not None:
        c_years = getattr(canonical_jd_spec, "required_years", None)
        if c_years is not None:
            try:
                req_years = float(c_years)
            except (ValueError, TypeError):
                req_years = None

    if req_years is None:
        req_years = 5.0  # Default baseline for senior roles if unspecified

    if req_years == 0.0:
        exp_score = 100.0
    elif req_years > 0:
        ratio_score = min(100.0, max(0.0, (effective_exp_years / req_years) * 100.0))
        # Relevance proportion discount: apply ONLY when candidate meets or exceeds the required years (effective_exp_years >= req_years)
        # to prevent double-counting penalties and monotonicity inversions for career-changers below requirement.
        if cand_years > 0 and effective_exp_years >= req_years and effective_exp_years < cand_years:
            relevance_ratio = effective_exp_years / cand_years
            exp_score = (ratio_score * 0.7) + (relevance_ratio * 100.0 * 0.3)
        else:
            exp_score = ratio_score
    else:
        exp_score = 100.0

    # Domain Relevance Experience Bound:
    # Irrelevant experience depth cannot score at full depth — experience must be
    # anchored to demonstrated domain skills.
    # Strict mode: no floor (pure frontend years give 0 credit for a backend role),
    # smaller delta (20 pts headroom above skills_score).
    # Lenient/moderate: 25pt floor and 35pt headroom are more forgiving.
    if eval_mode_key == "strict":
        max_allowed_exp = min(100.0, max(0.0, skills_score + 20.0))
    else:
        max_allowed_exp = min(100.0, max(25.0, skills_score + 35.0))
    exp_score = min(exp_score, max_allowed_exp)

    # Extract JD keywords for education domain matching
    jd_kw_list = []
    if must_have:
        for item in must_have:
            req_name = item.get("requirement") if isinstance(item, dict) else getattr(item, "requirement", "")
            if req_name:
                jd_kw_list.append(str(req_name))
    if canonical_jd_spec and getattr(canonical_jd_spec, "role_title", None):
        jd_kw_list.append(str(canonical_jd_spec.role_title))

    # Growth Trajectory (Evidence-Derived, Structural & Domain-Agnostic)
    raw_traj = getattr(score_breakdown, "trajectory_score", None)
    if raw_traj is not None:
        traj_score = float(raw_traj)
        traj_sub_criteria = []
        traj_calc_summary = f"Pre-computed trajectory score ({traj_score:.0f} pts)."
    else:
        traj_score, traj_sub_criteria, traj_calc_summary = _compute_evidence_trajectory(
            candidate_profile, skills_score, eval_mode_key, jd_keywords=jd_kw_list, canonical_jd_spec=canonical_jd_spec
        )

    # Trajectory Skill Bounding:
    # Growth trajectory cannot inflate candidate score beyond technical competence
    delta_cap = 30.0 if eval_mode_key == "lenient" else 10.0 if eval_mode_key == "strict" else 20.0
    max_allowed_traj = min(100.0, max(0.0, skills_score + delta_cap))

    traj_cap_applied = False
    original_traj_score = traj_score
    if traj_score > max_allowed_traj:
        traj_score = max_allowed_traj
        traj_cap_applied = True

    # Raw Weighted Score
    raw_score = (
        skills_score * weights["skills"] +
        exp_score * weights["exp"] +
        nice_score * weights["nice"] +
        traj_score * weights["traj"]
    )

    # Mode-based adjustments: simple, principled, no per-candidate buckets.
    # Lenient: apply a flat bonus for candidates with meaningful partial domain overlap.
    # The bonus is withheld for near-zero domain candidates to avoid inflating
    # pure non-domain candidates (e.g. Jake Sullivan class: skills_score < 15).
    if eval_mode_key == "lenient" and skills_score >= 15.0:
        raw_score = min(SCORE_CEILING["lenient"], raw_score + LENIENT_BONUS)

    # Hard-filter penalty deductions
    deduction = 0.0
    penalty_reasons = []
    penalties_breakdown_items = []
    if penalties:
        for p in penalties:
            sev = str(p.get("severity", "")) if isinstance(p, dict) else str(getattr(p, "severity", ""))
            reason = str(p.get("reason", "")) if isinstance(p, dict) else str(getattr(p, "reason", ""))
            raw_pts = p.get("points_deducted") if isinstance(p, dict) else getattr(p, "points_deducted", None)
            if raw_pts is not None:
                pts = float(raw_pts)
            else:
                pts = 5.0 if sev == "slight_penalize" else 10.0 if sev == "intermediate_penalize" else 20.0 if sev == "hard_penalize" else 50.0 if sev in ("reject", "completely_reject") else 10.0 if sev else 0.0
            
            deduction += pts
            if reason:
                penalty_reasons.append(reason)
                penalties_breakdown_items.append(PenaltyBreakdownItem(
                    reason=reason,
                    severity=sev or "penalty",
                    points_deducted=pts
                ))

    penalty_scale = 0.5 if eval_mode_key == "lenient" else 1.5 if eval_mode_key == "strict" else 1.0
    scaled_deduction = round(deduction * penalty_scale)

    final_score = int(round(max(0.0, min(100.0, raw_score - scaled_deduction))))

    # Experience Breakdown
    if candidate_profile and hasattr(candidate_profile, "previous_roles") and candidate_profile.previous_roles:
        calc_summary = generate_experience_calculation_summary(candidate_profile.previous_roles)
    else:
        calc_summary = getattr(candidate_profile, "experience_calculation", None) if candidate_profile else None
        if not calc_summary:
            calc_summary = f"Direct ratio: {effective_exp_years:.1f} relevant yrs / {req_years:.1f} req yrs (total career tenure: {cand_years:.1f} yrs)"

    exp_pts_earned = round(exp_score * weights["exp"], 1)
    exp_breakdown_obj = ExperienceBreakdown(
        score=int(round(exp_score)),
        points_earned=exp_pts_earned,
        max_points=weights["exp"] * 100.0,
        required_years=req_years,
        candidate_years=cand_years,
        relevant_years=effective_exp_years,
        calculation=calc_summary,
        assessment=experience_assessment or f"Candidate relevant experience ({effective_exp_years:.1f} yrs, {cand_years:.1f} yrs total) evaluated against required depth ({req_years} yrs)."
    )

    # Trajectory Breakdown
    traj_pts_earned = round(traj_score * weights["traj"], 1)
    traj_assessment = "Growth capacity evaluated from career progression, skill acquisition breadth, project evidence, and degree domain relevance."
    if traj_cap_applied:
        traj_assessment += f" [Capped from {original_traj_score:.0f} to {traj_score:.0f} due to domain skills baseline ({skills_score:.0f}%)]"
        traj_calc_summary += f" (Capped to {traj_score:.0f} pts due to domain skill baseline of {skills_score:.0f}%)"

    traj_breakdown_obj = TrajectoryBreakdown(
        score=int(round(traj_score)),
        points_earned=traj_pts_earned,
        max_points=weights["traj"] * 100.0,
        sub_criteria=traj_sub_criteria or [],
        calculation_summary=traj_calc_summary,
        assessment=traj_assessment
    )

    skills_contrib = round(skills_score * weights["skills"], 1)
    nice_contrib = round(nice_score * weights["nice"], 1)
    formula_str = (
        f"Fit Score ({final_score}/100) = {skills_contrib:.1f} (Required Skills {weights['skills']*100:.0f}%) + "
        f"{exp_pts_earned:.1f} (Experience {weights['exp']*100:.0f}%) + "
        f"{nice_contrib:.1f} (Nice-To-Have {weights['nice']*100:.0f}%) + "
        f"{traj_pts_earned:.1f} (Growth Trajectory {weights['traj']*100:.0f}%)"
    )
    if scaled_deduction > 0:
        formula_str += f" - {scaled_deduction:.1f} (Penalties)"

    # Calculate flags & claim-only coverage
    claim_only_coverage = (claim_only_count / num_must) if num_must > 0 else 0.0
    flags_list = []
    has_stuffer_penalty = penalties and any(
        ("STUFFER_ALERT" in str(p)) or (isinstance(p, dict) and "STUFFER_ALERT" in str(p.get("reason", "")))
        for p in penalties
    )
    if claim_only_coverage >= 0.5 or claim_only_count >= 3 or has_stuffer_penalty:
        flags_list.append("STUFFER_ALERT")
        flags_list.append("unproven_claims")

    # Populate fields on score_breakdown if it is an object
    if score_breakdown is not None:
        if hasattr(score_breakdown, "required_skills_score"):
            score_breakdown.required_skills_score = int(round(skills_score))
            score_breakdown.experience_score = int(round(exp_score))
            score_breakdown.nice_to_have_score = int(round(nice_score))
            score_breakdown.trajectory_score = int(round(traj_score))
            score_breakdown.weights = weights
            score_breakdown.eval_mode = eval_mode_key
            score_breakdown.relevant_experience_years = effective_exp_years
            score_breakdown.formula_summary = formula_str
            score_breakdown.must_have_breakdown = must_have_breakdown_items
            score_breakdown.nice_to_have_breakdown = nice_have_breakdown_items
            score_breakdown.experience_breakdown = exp_breakdown_obj
            score_breakdown.trajectory_breakdown = traj_breakdown_obj
            score_breakdown.penalties_breakdown = penalties_breakdown_items
            score_breakdown.flags = flags_list
            score_breakdown.claim_only_coverage = round(claim_only_coverage, 2)
            score_breakdown.claim_only_count = claim_only_count

    # Thresholding logic
    if eval_mode_key == "strict":
        decision = "advance" if final_score >= 70 else "hold" if final_score >= 60 else "reject"
    elif eval_mode_key == "lenient":
        decision = "advance" if final_score >= 55 else "hold" if final_score >= 40 else "reject"
    else:
        decision = "advance" if final_score >= 60 else "hold" if final_score >= 50 else "reject"

    note = f"Score: {final_score}/100."
    if scaled_deduction > 0:
        note += f" [Penalty applied: -{scaled_deduction} pts for: {', '.join(penalty_reasons)}]"

    return final_score, decision, note


