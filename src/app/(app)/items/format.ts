/** Display helpers shared by the item pages. */

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** `date` columns are stored as UTC midnight, so format them in UTC. */
export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
export const formatDateTime = (d: Date) => dateTimeFormat.format(d);
export const formatRupiah = (n: number | bigint) => rupiah.format(n);

/** Short "how long": 5 menit, 3 jam, 12 hari, 4 bulan. */
export function formatAge(since: Date, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days} hari`;
  return `${Math.floor(days / 30)} bulan`;
}

/** `YYYY-MM-DD` for <input type="date">. */
export const toDateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
