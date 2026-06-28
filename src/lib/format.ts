// Shared formatting helpers so currency etc. is consistent everywhere.

/** Format a number as Pakistani Rupees, e.g. money(12744) -> "Rs 12,744". */
export const money = (n: any) => "Rs " + Math.round(Number(n) || 0).toLocaleString();

/** Title-case a status word, e.g. "pending" -> "Pending". */
export const titleCase = (s: any) => {
  const str = String(s || "");
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
};
