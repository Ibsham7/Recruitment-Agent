import re
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional

MONTH_NAMES = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'oct': 10, 'october': 10,
    'nov': 11, 'november': 11, 'dec': 12, 'december': 12
}

def parse_date_str(date_str: str, default_is_now: bool = False, reference_date: Optional[datetime] = None) -> Optional[Tuple[int, int]]:
    """Parse string representations of dates into (year, month) tuple, anchored to reference_date."""
    if not date_str or not isinstance(date_str, str):
        return None
    
    ref = reference_date or datetime.now()
    clean_str = date_str.strip().lower()

    if not clean_str:
        return None

    # Check if the string is purely/primarily a present keyword (e.g. 'present', 'current', 'now', 'today', 'ongoing')
    years_found = re.findall(r'\b(19\d{2}|20\d{2})\b', clean_str)
    if any(kw in clean_str for kw in ['present', 'current', 'now', 'today', 'ongoing']) and not years_found:
        return (ref.year, ref.month)
    
    # Try YYYY-MM or YYYY/MM (e.g. "2022-01", "2024/06")
    m = re.search(r'\b(\d{4})[-/](\d{1,2})\b', clean_str)
    if m:
        year, month = int(m.group(1)), int(m.group(2))
        return (year, min(max(month, 1), 12))
    
    # Try MM/YYYY or MM-YYYY (e.g. "01-2022", "06/2024")
    m = re.search(r'\b(\d{1,2})[-/](\d{4})\b', clean_str)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        return (year, min(max(month, 1), 12))
    
    # Try "Month YYYY" or "Jan 2021"
    for m_name, m_val in MONTH_NAMES.items():
        if m_name in clean_str:
            m_year = re.search(r'\b(19\d{2}|20\d{2})\b', clean_str)
            if m_year:
                return (int(m_year.group(1)), m_val)
    
    # Standalone YYYY:
    # Solution 1: Default standalone years to Month 1 (Jan) for both start and end dates
    # unless default_is_now is True AND the year is the current reference year.
    if years_found:
        year = int(years_found[0] if not default_is_now else years_found[-1])
        if default_is_now and year == ref.year:
            month = ref.month
        else:
            month = 1  # Solution 1: Align standalone end years to Month 1 so Y2 - Y1 is exact!
        return (year, month)
        
    return None

def split_date_range(text_str: str) -> Tuple[Optional[str], Optional[str]]:
    """Split a combined date range string into (start_part, end_part)."""
    if not text_str or not isinstance(text_str, str):
        return None, None
    
    # Standardize dashes/separators (hyphen, en-dash, em-dash, horizontal bar)
    clean = re.sub(r'[\u2010-\u2015–—]', '-', text_str.strip())
    
    # Regex matching start - end patterns, including 'to', 'until', 'till', '-'
    parts = re.split(r'\s*(?:-|to|until|till)\s*', clean, maxsplit=1, flags=re.IGNORECASE)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return None, None

def extract_role_interval(role: Any, reference_date: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """Extract start/end month indices and meta details from a role object, dict, or string."""
    ref = reference_date or datetime.now()
    title = ""
    company = ""
    start_date = None
    end_date = None
    is_current = False
    skills_used = []
    description = ""

    if isinstance(role, str):
        title = role
        s_part, e_part = split_date_range(role)
        if s_part and e_part:
            start_date, end_date = s_part, e_part
    elif isinstance(role, dict):
        title = role.get("title") or role.get("role") or ""
        company = role.get("company") or ""
        start_date = role.get("start_date")
        end_date = role.get("end_date")
        is_current = bool(role.get("is_current", False))
        skills_used = role.get("skills_used") or []
        description = role.get("description") or ""
        dates_str = role.get("dates") or role.get("duration") or ""
        if dates_str and (not start_date or not end_date):
            s_part, e_part = split_date_range(dates_str)
            if s_part:
                start_date = start_date or s_part
                end_date = end_date or e_part
    else:
        title = getattr(role, "title", "")
        company = getattr(role, "company", "")
        start_date = getattr(role, "start_date", None)
        end_date = getattr(role, "end_date", None)
        is_current = bool(getattr(role, "is_current", False))
        skills_used = getattr(role, "skills_used", [])
        description = getattr(role, "description", "")
        if hasattr(role, "dates"):
            dates_str = getattr(role, "dates", "")
            if dates_str and (not start_date or not end_date):
                s_part, e_part = split_date_range(dates_str)
                if s_part:
                    start_date = start_date or s_part
                    end_date = end_date or e_part

    # If start_date contains a range (e.g. "2020 - 2023" or "2023 - Present"), split it!
    if start_date and not end_date:
        s_part, e_part = split_date_range(str(start_date))
        if s_part and e_part:
            start_date = s_part
            end_date = e_part

    # Search title and description if start_date is still missing
    if not start_date and title:
        s_part, e_part = split_date_range(title)
        if s_part and e_part:
            start_date = s_part
            end_date = e_part
        else:
            m_range = re.search(r'\b(19\d{2}|20\d{2})\s*[\u2010-\u2015–—-]\s*(19\d{2}|20\d{2}|present|current|now)\b', title, re.IGNORECASE)
            if m_range:
                start_date = m_range.group(1)
                end_date = m_range.group(2)

    if not start_date and description:
        m_range = re.search(r'\b(19\d{2}|20\d{2})\s*[\u2010-\u2015–—-]\s*(19\d{2}|20\d{2}|present|current|now)\b', description, re.IGNORECASE)
        if m_range:
            start_date = m_range.group(1)
            end_date = m_range.group(2)

    # CRITICAL: Ongoing role detection
    is_ongoing = is_current or (end_date is not None and any(k in str(end_date).lower() for k in ['present', 'current', 'now', 'today', 'ongoing']))
    if is_ongoing:
        end_date = "Present"

    st_tuple = parse_date_str(str(start_date), default_is_now=False, reference_date=ref) if start_date else None
    end_tuple = parse_date_str(str(end_date), default_is_now=True, reference_date=ref) if end_date else None

    # Fallback standalone year extraction if start_date was not parsed
    if not st_tuple:
        search_text = f"{title} {description}"
        years = re.findall(r'\b(19\d{2}|20\d{2})\b', search_text)
        if len(years) >= 1:
            st_tuple = (int(years[0]), 1)
            if len(years) >= 2 and not end_tuple:
                end_tuple = (int(years[1]), 1)
                is_ongoing = False

    if is_ongoing and not end_tuple:
        end_tuple = (ref.year, ref.month)

    if st_tuple and end_tuple:
        st_idx = st_tuple[0] * 12 + st_tuple[1]
        end_idx = end_tuple[0] * 12 + end_tuple[1]
        if end_idx >= st_idx:
            # Duration calculation for closed roles with standalone years: (end_idx - st_idx) / 12
            # For ongoing roles or month-to-month, include inclusive months: (end_idx - st_idx + 1) / 12
            dur_months = end_idx - st_idx if (not is_ongoing and end_tuple[1] == st_tuple[1] == 1) else (end_idx - st_idx + 1)
            dur_years = round(max(0.1, dur_months / 12.0), 1)
            return {
                "title": title,
                "company": company,
                "start_idx": st_idx,
                "end_idx": end_idx,
                "duration_years": dur_years,
                "skills_used": skills_used,
                "description": description,
                "start_str": f"{st_tuple[0]}/{st_tuple[1]:02d}",
                "end_str": "Present" if is_ongoing else f"{end_tuple[0]}/{end_tuple[1]:02d}"
            }
    return None

def merge_date_intervals(intervals: List[Tuple[int, int]]) -> float:
    """
    Merge overlapping month intervals represented as (start_month_idx, end_month_idx).
    Returns total non-overlapping years rounded to 1 decimal place.
    """
    if not intervals:
        return 0.0
    
    sorted_intervals = sorted(intervals, key=lambda x: x[0])
    merged = []
    
    for current in sorted_intervals:
        if not merged:
            merged.append(current)
        else:
            prev_start, prev_end = merged[-1]
            curr_start, curr_end = current
            
            if curr_start <= prev_end + 1:
                # Overlapping or adjacent, merge
                merged[-1] = (prev_start, max(prev_end, curr_end))
            else:
                merged.append(current)
                
    total_months = sum(end - start + 1 for start, end in merged if end >= start)
    return round(total_months / 12.0, 1)

def calculate_total_experience_years(roles: List[Any], fallback_years: float = 0.0, reference_date: Optional[datetime] = None) -> float:
    """
    Deterministic timeline calculator for candidate work experience.
    Parses start/end dates from structured roles, handles overlaps, and computes exact years.
    """
    if not roles or not isinstance(roles, list):
        return fallback_years
        
    intervals = []
    for role in roles:
        parsed = extract_role_interval(role, reference_date=reference_date)
        if parsed:
            intervals.append((parsed["start_idx"], parsed["end_idx"]))
                
    if not intervals:
        return fallback_years
        
    calculated = merge_date_intervals(intervals)
    return max(calculated, fallback_years)

def generate_experience_calculation_summary(roles: List[Any], reference_date: Optional[datetime] = None) -> str:
    """Generate a step-by-step transparent calculation summary for experience breakdown."""
    if not roles or not isinstance(roles, list):
        return "No structured work experience provided."

    summaries = []
    intervals = []
    for role in roles:
        parsed = extract_role_interval(role, reference_date=reference_date)
        if parsed:
            intervals.append((parsed["start_idx"], parsed["end_idx"]))
            label = parsed["title"]
            if parsed["company"]:
                label += f" at {parsed['company']}"
            summaries.append(f"{label} ({parsed['start_str']} - {parsed['end_str']}): {parsed['duration_years']} yrs")

    if not intervals:
        return "No explicit dates parsed from experience roles."

    total_years = merge_date_intervals(intervals)
    details = "; ".join(summaries)
    return f"{details}. Total non-overlapping experience: {total_years} yrs."

def extract_domain_tokens(keywords: List[str]) -> set[str]:
    """Extract individual domain skill tokens from requirement names and role titles."""
    stop_words = {'and', 'or', 'the', 'a', 'an', 'of', 'in', 'for', 'with', 'to', 'is', 'at', 'on', 'role', 'senior', 'junior', 'lead', 'manager', 'engineer', 'experience', 'development', 'management', 'pipelines', 'design', 'must_have', 'nice_to_have', 'skills', 'required'}
    tokens = set()
    for kw in keywords:
        words = re.findall(r'[a-zA-Z0-9+#/\-]+', kw.lower())
        for word in words:
            word_clean = word.strip('/')
            if len(word_clean) >= 2 and word_clean not in stop_words:
                tokens.add(word_clean)
    return tokens

def calculate_experience_for_domain(roles: List[Any], keywords: List[str], reference_date: Optional[datetime] = None) -> float:
    """
    Filters roles matching any domain/skill keywords and computes exact non-overlapping years.
    """
    if not roles or not keywords:
        return 0.0

    domain_tokens = extract_domain_tokens(keywords)
    if not domain_tokens:
        return 0.0

    matching_roles = []
    for role in roles:
        parsed = extract_role_interval(role, reference_date=reference_date)
        if not parsed:
            continue

        title = (parsed.get("title") or "").lower()
        skills = parsed.get("skills_used") or []
        skills_str = " ".join([str(s).lower() for s in skills])
        desc = (parsed.get("description") or "").lower()
        combined_text = f"{title} {skills_str} {desc}"

        role_tokens = set(re.findall(r'[a-zA-Z0-9+#/\-]+', combined_text))

        if domain_tokens & role_tokens:
            matching_roles.append(role)

    return calculate_total_experience_years(matching_roles, reference_date=reference_date)
