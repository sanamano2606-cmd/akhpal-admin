/**
 * The engine behind every call the panel makes to the server.
 *
 * WHAT THIS FILE IS
 * Not the calls themselves - those live in api-orders.ts, api-stores.ts,
 * api-people.ts and api-money.ts. This is the machinery underneath them: the
 * sign-in token, the short-lived cache that stops the same page asking for the
 * same thing twice, the retry while the free server is waking up, and what to
 * do when a login has expired.
 *
 * WHY IT IS SEPARATE
 * api-client.ts was 1,090 lines: about 290 lines of engine followed by 120
 * one-line calls. Split on 2026-08-30 so a change to the engine cannot be lost
 * among the calls, and a new call cannot be dropped into the middle of the
 * engine.
 *
 * The members below are `protected` rather than `private` only so the files
 * that add the calls can reach them. Nothing outside this family can.
 */
/**
 * API Client for Admin Panel
 * Handles all communication with backend API
 */

// The backend origin is fixed at build time.
//
// SECURITY: this used to be read from `localStorage.getItem("api_url")`, which
// meant anything able to write a single localStorage key — any XSS, any
// malicious bookmarklet, any shared browser profile — could point every
// subsequent API call at a server of its choosing. Each of those calls carries
// the admin's bearer token in the Authorization header, so one writable key
// was enough to exfiltrate full admin access. It is now a constant.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://swat-delivery-api.onrender.com";

import { AccessDeniedError } from "./api-errors";

/** Random key so a resubmitted write is recognised and ignored by the server. */
function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** A normal fetch, plus how long ONE attempt may take.
 *
 *  Only for a request that is genuinely slow by nature — a bulk clear, a big
 *  export. Never as a way to paper over a slow endpoint: a screen that waits
 *  two minutes with no explanation is worse than one that fails. */
export type SlowRequestInit = RequestInit & { timeoutMs?: number };

export class APIClientCore {
  protected baseUrl: string;
  protected token: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.token = typeof window !== "undefined"
      ? localStorage.getItem("admin_token") || ""
      : "";
  }

  protected getHeaders() {
    // Read the token fresh each call so a login mid-session is always picked up.
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : this.token;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  protected get base() {
    return this.baseUrl;
  }

  /**
   * POST a money-moving action exactly once.
   *
   * The key is generated per logical action and reused across retries, so if
   * the response is lost in transit the server recognises the resubmission and
   * replays the original result instead of paying a second time.
   */
  protected async requestOnce<T>(path: string, body: unknown): Promise<T> {
    const result = await this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": newIdempotencyKey() },
    });
    // The server claims the key BEFORE it does the work, so a resend that
    // arrives while the first one is still running is answered with the bare
    // duplicate marker and no result. That is not a success and must never be
    // reported as one - the money may still be on its way. A duplicate that
    // carries the real stored answer has no `duplicate` flag and passes here.
    if (result && (result as { duplicate?: boolean }).duplicate === true) {
      throw new Error(
        "The server is still finishing this one. Wait a moment and refresh to " +
        "check before sending it again."
      );
    }
    return result;
  }

  /** Does this request carry a key that makes a resend safe? */
  protected static carriesIdempotencyKey(options: RequestInit): boolean {
    const h = options.headers as Record<string, string> | undefined;
    return !!(h && h["Idempotency-Key"]);
  }



  // ── Short-lived GET cache for instant page loads ─────────────────────────
  // Successful GET responses are cached in memory for a short window. Re-opening
  // a page returns the cached data immediately (no spinner), then quietly
  // refreshes in the background. ANY write (POST/PUT/PATCH/DELETE) clears the
  // cache so lists are never stale right after you edit something.
  protected static _cache = new Map<string, { data: any; ts: number }>();
  protected static _inflight = new Map<string, Promise<any>>();
  protected static readonly CACHE_TTL = 60_000;  // reuse cached data for up to 60s
  protected static readonly CACHE_FRESH = 8_000;  // refresh in background if older than this
  protected static _hydrated = false;
  protected static readonly PERSIST_KEY = "admin_get_cache_v1";

  /** Load the cache from sessionStorage once, so a hard-refresh loads instantly. */
  protected static _hydrate() {
    if (APIClientCore._hydrated || typeof window === "undefined") return;
    APIClientCore._hydrated = true;
    try {
      const raw = sessionStorage.getItem(APIClientCore.PERSIST_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, { data: any; ts: number }>;
      const now = Date.now();
      for (const [k, v] of Object.entries(obj)) {
        if (v && now - v.ts < APIClientCore.CACHE_TTL) APIClientCore._cache.set(k, v);
      }
    } catch {
      /* ignore corrupt/unavailable storage */
    }
  }

  /** Mirror the in-memory cache to sessionStorage (best-effort; ignores quota). */
  protected static _persist() {
    if (typeof window === "undefined") return;
    try {
      const obj: Record<string, { data: any; ts: number }> = {};
      APIClientCore._cache.forEach((v, k) => (obj[k] = v));
      sessionStorage.setItem(APIClientCore.PERSIST_KEY, JSON.stringify(obj));
    } catch {
      /* storage full or unserializable — the in-memory cache still works */
    }
  }

  /** Wipe the read cache — called after every successful write. */
  static clearCache() {
    APIClientCore._cache.clear();
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(APIClientCore.PERSIST_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  protected async request<T>(path: string, options: SlowRequestInit = {}, attempt = 0): Promise<T> {
    const url = `${this.base}${path}`;
    const method = (options.method || "GET").toUpperCase();

    // Reads: serve from cache instantly, revalidate in the background.
    if (method === "GET" && attempt === 0) {
      APIClientCore._hydrate();
      const hit = APIClientCore._cache.get(url);
      const now = Date.now();
      if (hit && now - hit.ts < APIClientCore.CACHE_TTL) {
        if (now - hit.ts > APIClientCore.CACHE_FRESH) {
          this._fetchAndCache<T>(url, options).catch(() => {});
        }
        return hit.data as T;
      }
      // Collapse duplicate concurrent GETs into one network call.
      const pending = APIClientCore._inflight.get(url);
      if (pending) return pending as Promise<T>;
      const p = this._fetchAndCache<T>(url, options);
      APIClientCore._inflight.set(url, p);
      try {
        return await p;
      } finally {
        APIClientCore._inflight.delete(url);
      }
    }

    const result = await this._send<T>(url, options, attempt);
    // A successful write means cached lists may be out of date — drop them.
    if (method !== "GET") APIClientCore.clearCache();
    return result;
  }

  protected async _fetchAndCache<T>(url: string, options: SlowRequestInit): Promise<T> {
    const data = await this._send<T>(url, options, 0);
    APIClientCore._cache.set(url, { data, ts: Date.now() });
    APIClientCore._persist();
    return data;
  }

  protected async _send<T>(url: string, options: SlowRequestInit, attempt = 0): Promise<T> {
    // The free backend sleeps after inactivity and can take ~60-90s to wake (a
    // fresh redeploy is even longer). We wait it out with retries, BUT each try
    // has a hard timeout so a stalled connection can never freeze the UI — a
    // warm server answers in well under a second.
    //
    // ⚠️ RETRIES ARE ONLY SAFE FOR IDEMPOTENT REQUESTS.
    //
    // This retry loop used to apply to EVERY method. A 502/503/504 comes from an
    // upstream proxy and says nothing about whether the backend already committed
    // the write — and on a free tier that sleeps, a 502 *after* a successful
    // commit is routine. That meant a single click on "Save Payment" could send
    // recordRestaurantPayout up to 24 times and pay a vendor several times over.
    // Same for recordRiderPayout, refundOrder, approveReturn, recordCashHandover
    // and broadcastNotification (24 push broadcasts to every user).
    //
    // The UI's `disabled={saving}` guards do NOT help here: they prevent double
    // *clicks*, not double *sends* — the retries happen invisibly inside one await.
    //
    // GET/HEAD have no side effects, so they can be retried freely. Everything
    // else now fails fast and lets the operator decide whether to retry, which
    // is the safe default until the backend supports an Idempotency-Key.
    const method = (options.method || "GET").toUpperCase();
    const isIdempotent = method === "GET" || method === "HEAD";
    // A write that carries an Idempotency-Key CAN be resent safely, and the
    // five money-moving actions all carry one. The server claims the key
    // before it moves any money, so a resend is recognised and answered from
    // the original - it can never pay twice. Without this, one slow moment on
    // a sleeping free-tier server left the owner with "this may or may not
    // have gone through" and no way to find out, which is exactly what
    // happened on 2026-09-01 right after a deploy restart.
    const resendIsSafe = isIdempotent || APIClientCore.carriesIdempotencyKey(options);

    // 6 × 5s ≈ 30s, still comfortably covers a Render cold start. (Was 24,
    // which made a genuinely-down backend hang the UI for two full minutes.)
    const MAX_ATTEMPTS = resendIsSafe ? 6 : 0;
    const WAIT_MS = 5000;
    // ── HOW LONG ONE ATTEMPT MAY TAKE ────────────────────────────────────
    //
    // 15 seconds is right for everything the panel normally does: read a
    // list, save a row, record a payment. A warm server answers those in well
    // under a second, and a longer wait would just be a frozen screen.
    //
    // IT IS NOT RIGHT FOR EVERY REQUEST, AND THAT WAS A REAL FAULT.
    // Found live on 2 September 2026: "Clear test data" copies sixteen tables
    // into a new schema and then empties seventeen, on a free-tier database,
    // through a free-tier server that had just restarted and was still waking
    // up. It took longer than 15 seconds, the panel gave up, and the owner was
    // told "this may or may not have gone through" about an action that cannot
    // be undone. Nothing had happened - but she had no way to know that.
    //
    // A caller that knows its request is a slow one can now say so, and only
    // that request waits longer. Everything else keeps failing fast.
    const PER_TRY_TIMEOUT = Number((options as SlowRequestInit).timeoutMs) > 0
      ? Number((options as SlowRequestInit).timeoutMs)
      : 15000;

    let response: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_TRY_TIMEOUT);
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {}),
        },
      });
    } catch {
      clearTimeout(timer);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, WAIT_MS));
        return this._send<T>(url, options, attempt + 1);
      }
      throw new Error(
        isIdempotent
          ? "Can't reach the server. Check your connection and try again."
          : "Couldn't reach the server, so this may or may not have gone through. " +
            "Refresh and check before trying again."
      );
    } finally {
      clearTimeout(timer);
    }

    // 502/503/504 = the server is still waking or restarting.
    // Retried for reads, and for writes that carry an Idempotency-Key.
    if ((response.status === 502 || response.status === 503 || response.status === 504)) {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, WAIT_MS));
        return this._send<T>(url, options, attempt + 1);
      }
      if (!isIdempotent) {
        // Every attempt was answered by a proxy, not by the app. A 502 can
        // arrive AFTER the backend already committed the write, so the only
        // honest answer is that this is unknown - whether or not it was safe
        // to resend.
        throw new Error(
          "The server didn't confirm this request, so it may or may not have gone " +
          "through. Refresh and check before trying again."
        );
      }
    }

    // 401 = the admin session has expired or been revoked. Without this the panel
    // showed "API Error: 401" on every page forever, with no route back to login.
    if (response.status === 401) {
      APIClientCore.handleUnauthorized();
      throw new Error("Your session has expired. Please sign in again.");
    }

    // 403 = the server understood perfectly well and said no, because of what
    // this account is allowed to do. That is a different thing from a failure,
    // and pages need to be able to tell them apart - otherwise "you are not
    // allowed to see riders" gets shown to the operator as "there are no
    // riders", which is simply untrue. See lib/api-errors.ts.
    if (response.status === 403) {
      const error = await response.json().catch(() => ({} as any));
      throw new AccessDeniedError(error.detail, error.section);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return response.json();
  }

  /** Clear the session and send the admin back to the login page (once). */
  protected static _redirecting = false;
  static handleUnauthorized() {
    if (typeof window === "undefined" || APIClientCore._redirecting) return;
    APIClientCore._redirecting = true;
    try {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      APIClientCore.clearCache();   // don't leave cached customer data behind
    } catch {
      /* ignore storage errors */
    }
    if (!window.location.pathname.startsWith("/auth/login")) {
      window.location.href = "/auth/login?expired=1";
    }
  }
}
