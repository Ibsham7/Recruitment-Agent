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
    
    if clean_str in ['present', 'current', 'now', 'today', 'ongoing']:
        return (ref.year, ref.month)
    
    # Try YYYY-MM or YYYY/MM
    m = re.search(r'(\d{4})[-/](\d{1,2})', clean_str)
    if m:
        year, month = int(m.group(1)), int(m.group(2))
        return (year, min(max(month, 1), 12))
    
    # Try MM/YYYY or MM-YYYY
    m = re.search(r'(\d{1,2})[-/](\d{4})', clean_str)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        return (year, min(max(month, 1), 12))
    
    # Try "Month YYYY" or "Jan 2021"
    for m_name, m_val in MONTH_NAMES.items():
        if m_name in clean_str:
            m_year = re.search(r'\b(19\d{2}|20\d{2})\b', clean_str)
            if m_year:
                return (int(m_year.group(1)), m_val)
    
    # Try standalone YYYY
    m_year = re.search(r'\b(19\d{2}|20\d{2})\b', clean_str)
    if m_year:
        year = int(m_year.group(1))
        # If start date, default to Jan (1); if end date, default to Dec (12) unless it's current year
        if default_is_now and year == ref.year:
            month = ref.month
        else:
            month = 12 if default_is_now else 1
        return (year, month)
        
    return None

def extract_role_interval(role: Any, reference_date: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """Extract start/end month indices and meta details from a role object, dict, or string."""
    ref = reference_date or datetime.now()
    title = ""
    company = ""
    start_date = None
    end_date = None
    is_current = False
    skills_used = []

    if isinstance(role, str):
        title = role
        # Attempt to find date pattern like "2021–2024" or "2022-Present" in string
        parts = re.split(r'\s*(?:-|–|to)\s*', role, maxsplit=1)
        if len(parts) == 2:
            start_date = parts[0]
            end_date = parts[1]
    elif isinstance(role, dict):
        title = role.get("title") or role.get("role") or ""
        company = role.get("company") or ""
        start_date = role.get("start_date")
        end_date = role.get("end_date")
        is_current = bool(role.get("is_current", False))
        skills_used = role.get("skills_used") or []
        dates_str = role.get("dates") or role.get("duration") or ""
        if not start_date and not end_date and dates_str:
            parts = re.split(r'\s*(?:-|–|to)\s*', dates_str, maxsplit=1)
            start_date = parts[0] if len(parts) > 0 else None
            end_date = parts[1] if len(parts) > 1 else "Present"
    else:
        title = getattr(role, "title", "")
        company = getattr(role, "company", "")
        start_date = getattr(role, "start_date", None)
        end_date = getattr(role, "end_date", None)
        is_current = bool(getattr(role, "is_current", False))
        skills_used = getattr(role, "skills_used", [])
        if not start_date and not end_date and hasattr(role, "dates"):
            dates_str = getattr(role, "dates", "")
            if dates_str:
                parts = re.split(r'\s*(?:-|–|to)\s*', dates_str, maxsplit=1)
                start_date = parts[0] if len(parts) > 0 else None
                end_date = parts[1] if len(parts) > 1 else "Present"

    if is_current and not end_date:
        end_date = "Present"

    st_tuple = parse_date_str(start_date, default_is_now=False, reference_date=ref) if start_date else None
    end_tuple = parse_date_str(end_date, default_is_now=True, reference_date=ref) if end_date else (ref.year, ref.month)

    if not st_tuple:
        # Fallback: try parsing title string for standalone year range if start_date wasn't explicit
        years = re.findall(r'\b(19\d{2}|20\d{2})\b', title)
        if len(years) >= 1:
            st_tuple = (int(years[0]), 1)
            if len(years) >= 2:
                end_tuple = (int(years[1]), 12)

    if st_tuple and end_tuple:
        st_idx = st_tuple[0] * 12 + st_tuple[1]
        end_idx = end_tuple[0] * 12 + end_tuple[1]
        if end_idx >= st_idx:
            dur_months = end_idx - st_idx + 1
            return {
                "title": title,
                "company": company,
                "start_idx": st_idx,
                "end_idx": end_idx,
                "duration_years": round(dur_months / 12.0, 1),
                "skills_used": skills_used,
                "start_str": f"{st_tuple[0]}/{st_tuple[1]:02d}",
                "end_str": "Present" if (end_date and str(end_date).lower() in ['present', 'current', 'now']) else f"{end_tuple[0]}/{end_tuple[1]:02d}"
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

def calculate_experience_for_domain(roles: List[Any], keywords: List[str], reference_date: Optional[datetime] = None) -> float:
    """
    Filters roles matching any domain/skill keywords and computes exact non-overlapping years.
    """
    if not roles or not keywords:
        return 0.0

    matching_roles = []
    kw_lower = [k.lower() for k in keywords]
    for role in roles:
        title = getattr(role, "title", role.get("title", "") if isinstance(role, dict) else str(role)).lower()
        skills = getattr(role, "skills_used", role.get("skills_used", []) if isinstance(role, dict) else [])
        skills_str = " ".join([str(s).lower() for s in skills])

        if any(k in title or k in skills_str for k in kw_lower):
            matching_roles.append(role)

    return calculate_total_experience_years(matching_roles, reference_date=reference_date)
