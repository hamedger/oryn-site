/** null = no fixed end date */
export function formatTermLabel(termMonths: number | null | undefined): string {
  if (termMonths === null || termMonths === undefined) return "No End";
  if (termMonths === 1) return "1 month";
  return `${termMonths} months`;
}

export const TERM_PRESET_MONTHS = [1, 3, 6, 12, 18, 24, 36] as const;

export function termMonthsToSelectValue(termMonths: number | null | undefined): string {
  if (termMonths === null || termMonths === undefined) return "no-end";
  if (TERM_PRESET_MONTHS.includes(termMonths as (typeof TERM_PRESET_MONTHS)[number])) {
    return String(termMonths);
  }
  return "custom";
}

export function selectValueToTermMonths(
  selectValue: string,
  customMonths: number
): number | null {
  if (selectValue === "no-end") return null;
  if (selectValue === "custom") return customMonths;
  const n = parseInt(selectValue, 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}
