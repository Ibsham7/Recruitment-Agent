import { Candidate } from "./types";

export function isUuidString(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ||
    /^[0-9a-f]{32}$/i.test(trimmed) ||
    /^candidate[_-]?[0-9a-f-]+$/i.test(trimmed)
  );
}

export function cleanFilenameToDisplayName(filename: string): string | null {
  if (!filename) return null;
  try {
    const decoded = decodeURIComponent(filename);
    const baseName = decoded.includes('.') ? decoded.split('.').slice(0, -1).join('.') : decoded;
    // Strip UUID prefix if any (e.g. 12345678-1234-1234-1234-123456789abc_John_Doe -> John_Doe)
    const stripped = baseName.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[_-]?/i, "").trim();
    if (stripped && !isUuidString(stripped) && stripped.toLowerCase() !== "unknown candidate") {
      const formatted = stripped
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
      if (formatted.length > 0) return formatted;
    }
  } catch (e) {
    // Fallback if decodeURIComponent fails
  }
  return null;
}

export function getCandidateDisplayName(candidate: Partial<Candidate> | null | undefined): string {
  if (!candidate) return "Processing Candidate...";

  const rawName = candidate.name?.trim();

  // 1. Check if rawName is valid and not a UUID or placeholder
  if (
    rawName &&
    rawName !== "Unknown Candidate" &&
    rawName !== "Processing Candidate..." &&
    !isUuidString(rawName)
  ) {
    return rawName;
  }

  // 2. Try to derive human name from file URL or path
  const fileSource = candidate.cvUrl || candidate.resumePath;
  if (fileSource && typeof fileSource === 'string') {
    const filename = fileSource.split('/').pop()?.split('?')[0];
    if (filename) {
      const cleanName = cleanFilenameToDisplayName(filename);
      if (cleanName) return cleanName;
    }
  }

  // 3. Status/Stage check
  const isProcessing =
    candidate.status === 'pending' ||
    candidate.status === 'screening' ||
    candidate.stage === 'pending' ||
    candidate.stage === 'screening';

  if (isProcessing) {
    return "Processing Candidate...";
  }

  return "Candidate";
}
