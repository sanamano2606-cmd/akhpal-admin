// Shared formatting helpers so currency etc. is consistent everywhere.

/** Format a number as Pakistani Rupees, e.g. money(12744) -> "Rs 12,744". */
export const money = (n: any) => "Rs " + Math.round(Number(n) || 0).toLocaleString();

/** Title-case a status word, e.g. "pending" -> "Pending". */
export const titleCase = (s: any) => {
  const str = String(s || "");
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
};

// Dates are always shown in Pakistan time so they match the apps and your day.
const PK_TZ = "Asia/Karachi";

export const fmtDate = (d: any) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { timeZone: PK_TZ, day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
};

export const fmtDateTime = (d: any) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      timeZone: PK_TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
};
