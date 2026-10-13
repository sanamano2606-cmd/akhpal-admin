// "← ALL STORES" GOES BACK TO THE SAME LIST (Stores page fix 7, Sana 12 Oct
// 2026: "OK fix 7"; audit O7).
//
// WAS: you were in Suspended, sorted Newest, searching "wakeel"; you opened a
// store and pressed "← All stores" - and landed on Live, no search, the usual
// order.
//
// NOW: the Stores list keeps its list, sort, search and store type in its own
// address (?status=suspended&sort=newest&q=wakeel&type=grocery) and remembers
// that address for this browser tab. "← All stores" opens exactly that.
// Nothing is stored on the server; a new tab starts on Live as before.

export const LIST_ADDRESS_KEY = "takal.stores.listAddress";

/** The list's address part ("?status=…&q=…"), from what is on screen. */
export function listQuery(o: { view: string; sort: string; defaultSort: string; search: string; type: string }): string {
  const p = new URLSearchParams();
  if (o.view && o.view !== "live") p.set("status", o.view);
  if (o.sort && o.sort !== o.defaultSort) p.set("sort", o.sort);
  if (o.search.trim()) p.set("q", o.search.trim());
  if (o.type && o.type !== "all") p.set("type", o.type);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Remember it for this tab. A blocked storage is not an error. */
export function rememberListQuery(query: string, store?: Pick<Storage, "setItem">): void {
  try {
    (store ?? window.sessionStorage).setItem(LIST_ADDRESS_KEY, query);
  } catch {
    /* private window or storage switched off: "← All stores" opens Live */
  }
}

/** Where "← All stores" goes: the remembered list, or plain Live. */
export function allStoresHref(store?: Pick<Storage, "getItem">): string {
  let q = "";
  try {
    q = (store ?? window.sessionStorage).getItem(LIST_ADDRESS_KEY) || "";
  } catch {
    q = "";
  }
  // Only ever our own short "?a=b" part - never a whole address.
  if (!/^\?[\w.~%+=&-]{0,400}$/.test(q)) q = "";
  return `/dashboard/stores${q}`;
}
