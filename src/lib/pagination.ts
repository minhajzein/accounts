export const DEFAULT_PAGE_SIZE = 25;

export function pageRangeLabel(page: number, limit: number, total: number) {
  if (total <= 0) return "0 of 0";
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return `${from}–${to} of ${total}`;
}
