/**
 * Categories: show the "Needs prescription" column only where it means
 * something (Stores visual audit, 10 Nov 2026, finding D2).
 *
 * Every department showed a prescription switch on every shelf - Burgers,
 * Fashion, Pets. Only medicines need one. The column now shows for the health /
 * pharmacy department, AND for any department where a shelf already carries
 * the mark - so a mark set by mistake can still be seen and taken off.
 * Example: "Food & Drinks" -> no column; "Health & Pharmacy" -> column.
 */
export function showsPrescription(
  dept: { slug?: string | null; name?: string | null },
  shelves: { needs_prescription?: boolean | null }[],
): boolean {
  if (/pharm|health|medic/i.test(`${dept.slug || ""} ${dept.name || ""}`)) return true;
  return shelves.some((s) => s.needs_prescription === true);
}
