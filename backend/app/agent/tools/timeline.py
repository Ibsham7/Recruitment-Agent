import re
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional

MONTH_NAMES = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'oct': 10, 'october': 10,
    'nov': 11, 'november': 11, 'dec': 12, 'december': 12
}

def parse_date_str(date_str: str, default_is_now: bool = False) -> Optional[Tuple[int, int]]:
    """Parse string representations of dates into (year, month) tuple."""
    if not date_str or not isinstance(date_str, str):
        return None
    
    clean_str = date_str.strip().lower()
    if clean_str in ['present', 'current', 'now', 'today', 'ongoing']:
        now = datetime.now()
        return (now.year, now.month)
    
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
        # If start date, default to Jan (1); if end date, default to Dec (12)
        month = 12 if default_is_now else 1
        return (year, month)
        
    return None

def merge_date_intervals(intervals: List[Tuple[int, int]]) -> float:
    """
    Merge overlapping month intervals represented as (start_month_idx, end_month_idx).
    Returns total non-overlapping years rounded to 1 decimal place.
    """
    if not intervals:
        return 0.0
    
    # Sort intervals by start month
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

def calculate_total_experience_years(roles: List[Any], fallback_years: float = 0.0) -> float:
    """
    Deterministic timeline calculator for candidate work experience.
    Parses start/end dates from structured roles, handles overlaps, and computes exact years.
    """
    if not roles or not isinstance(roles, list):
        return fallback_years
        
    intervals = []
    for role in roles:
        role_dict = role if isinstance(role, dict) else getattr(role, "__dict__", {})
        dates_str = role_dict.get("dates") or role_dict.get("duration") or ""
        
        start_date = role_dict.get("start_date")
        end_date = role_dict.get("end_date")
        
        # If dates given as single string e.g. "Jan 2020 - Mar 2023"
        if not start_date and not end_date and dates_str:
            parts = re.split(r'\s*(?:-|–|to)\s*', dates_str, maxsplit=1)
            start_date = parts[0] if len(parts) > 0 else None
            end_date = parts[1] if len(parts) > 1 else "Present"
            
        st_tuple = parse_date_str(start_date, default_is_now=False) if start_date else None
        end_tuple = parse_date_str(end_date, default_is_now=True) if end_date else (datetime.now().year, datetime.now().month)
        
        if st_tuple and end_tuple:
            st_idx = st_tuple[0] * 12 + st_tuple[1]
            end_idx = end_tuple[0] * 12 + end_tuple[1]
            if end_idx >= st_idx:
                intervals.append((st_idx, end_idx))
                
    if not intervals:
        return fallback_years
        
    calculated = merge_date_intervals(intervals)
    return max(calculated, fallback_years)
