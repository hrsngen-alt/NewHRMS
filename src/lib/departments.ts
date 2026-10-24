export const STANDARD_DEPARTMENTS: string[] = [
  "Marketing",
  "Sales and Marketing",
  "Molecular Biology",
  "Molecular Biology - Bioinformatics",
  "Molecular Biology & Cytogenetics",
  "Cytogenetics",
  "Cytogenetics - Analysis",
  "Cytogenetics - Processing",
  "Administration",
  "Accounts",
  "Engineering",
  "HR",
  "Management",
  "Supporting Staff",
  "Director"
];

const NORMALIZATION_MAP: Record<string, string> = {
  'marketing': 'Marketing',
  'molecular biology': 'Molecular Biology',
  'administration': 'Administration',
  'accounts': 'Accounts',
  'cytogenetics': 'Cytogenetics',
  'molecular biology- bioinformatics': 'Molecular Biology - Bioinformatics',
  'molecular biology (bioinformatics)': 'Molecular Biology - Bioinformatics',
  'molecular biology - bioinformatics': 'Molecular Biology - Bioinformatics',
  'molecular biology & cytogenetics': 'Molecular Biology & Cytogenetics',
  'cytogenetics- analysis': 'Cytogenetics - Analysis',
  'cytogenetics - analysis': 'Cytogenetics - Analysis',
  'cytogenetics- processing': 'Cytogenetics - Processing',
  'cytogenetics - processing': 'Cytogenetics - Processing',
  'sales and marketing': 'Sales and Marketing',
  'hr': 'HR',
  'management': 'Management',
  'supporting staff': 'Supporting Staff',
  'staff': 'Supporting Staff',
  'engineer': 'Engineering',
  'engineering': 'Engineering',
  'director': 'Director'
};

/**
 * Clean and standardize any department name to avoid duplicates like "MARKETING" vs "Marketing"
 */
export function normalizeDepartment(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  
  if (NORMALIZATION_MAP[lower]) {
    return NORMALIZATION_MAP[lower];
  }
  
  // Title-case fallback
  return trimmed
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Standardize and clean designation titles, fixing common database typos like "HUMAN RECOURSE"
 */
export function normalizeDesignation(raw?: string | null): string {
  if (!raw) return "Employee";
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "human recourse" || lower === "human resources" || lower === "hr") {
    return "HR";
  }
  return trimmed;
}
