/**
 * Get today's date in America/Bogota timezone as YYYY-MM-DD.
 * Avoids UTC timezone shifts.
 */
export function getBogotaToday(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

/**
 * Calculate a date by adding business days (Mon-Fri).
 * Ignores weekends (Saturday and Sunday).
 * Works with local dates, not UTC.
 *
 * @param startDate ISO date string (YYYY-MM-DD)
 * @param businessDays Number of business days to add
 * @returns ISO date string (YYYY-MM-DD)
 */
export function addBusinessDays(startDate: string, businessDays: number): string {
  // Parse date explicitly to avoid UTC interpretation
  const [year, month, day] = startDate.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0);

  let daysAdded = 0;

  // Add one day at a time, skipping weekends
  while (daysAdded < businessDays) {
    date.setDate(date.getDate() + 1);

    // 0 = Sunday, 6 = Saturday
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  // Return as ISO date string (YYYY-MM-DD)
  const year2 = date.getFullYear();
  const month2 = String(date.getMonth() + 1).padStart(2, "0");
  const day2 = String(date.getDate()).padStart(2, "0");

  return `${year2}-${month2}-${day2}`;
}
