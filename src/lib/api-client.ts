/**
 * The panel's one client for talking to the server.
 *
 * WHAT HAPPENED HERE
 * This file was 1,090 lines - about 290 lines of engine followed by 120 calls,
 * all in one class. It was split by subject on 2026-08-30:
 *
 *     api-core.ts     the engine: token, cache, retries, expired logins
 *     api-orders.ts   orders, returns, parcels, messages sent out
 *     api-stores.ts   shops, products, pictures, stock, categories
 *     api-people.ts   riders, customers, admin staff, reviews
 *     api-money.ts    payouts, reports, settings, promos, banners
 *
 * Each one adds its calls by extending the one before it, so every screen in
 * the panel still writes `apiClient.getOrders()` and means exactly what it
 * always meant. Not one line of any call changed.
 */
import { APIClientMoney } from "./api-money";
import { getMyPerms } from "./perms";

export class APIClient extends APIClientMoney {
  // These two live HERE, in the final class, not in the engine.
  // They call getOrders / getRestaurants / getRiders / getCustomers, which the
  // subject files add. The engine cannot see those, and should not: it is the
  // machinery, not the list of calls.
  /**
   * Fire-and-forget wake-up ping (like the customer app's splash does). Hits
   * /health with NO retry and swallows all errors, so the free-tier server
   * starts waking in the background before the admin actually does anything —
   * making saves feel instant instead of waiting for a cold start.
   */
  warmUp(): void {
    if (typeof window === "undefined") return;
    try {
      fetch(`${this.base}/health`, { cache: "no-store" }).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  /**
   * Warm the cache for the pages this admin is most likely to open next, right
   * after login, so they appear instantly when clicked. Fire-and-forget; these
   * call the SAME endpoints with the SAME defaults the pages use on load, so
   * the cached URLs match exactly and turn into a cache hit.
   *
   * A short delay lets the page you are actually on finish loading first, so
   * the background warms do not compete with it on the free-tier backend.
   *
   * IT NOW ASKS WHAT THIS ADMIN MAY SEE FIRST.
   *
   * It used to fire all four regardless. A sub-admin created to handle
   * customers and nothing else generated THREE refusals on the server every
   * single time they logged in - and the Dashboard code carries a comment
   * warning against exactly this, because a stream of avoidable refusals in the
   * log looks like somebody attacking the panel. It also wasted three requests
   * on a free server that is often still waking up.
   */
  prefetchCommon(): void {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("admin_token")) return;

    const { isSuper, sections } = getMyPerms();
    const may = (section: string) => isSuper || sections.includes(section);

    setTimeout(() => {
      if (may("orders")) this.getOrders(1, 50, {}).catch(() => {});
      if (may("restaurants")) this.getRestaurants({}).catch(() => {});
      if (may("riders")) this.getRiders({}).catch(() => {});
      if (may("customers")) this.getCustomers().catch(() => {});
    }, 1200);
  }

  /**
   * SUPPORT ALERTS.
   *
   * These four live here, in the final class, for the same reason prefetchCommon
   * does: they are the panel's own machinery rather than a subject like orders
   * or money, and `request` is protected, so they cannot live outside the chain.
   *
   * WHY THEY EXIST AT ALL. Until 16 September 2026 a customer could write to
   * Takal Support and nobody was told; the conversation sat there marked unread
   * until somebody happened to open the panel.
   */

  /** Is this device being told, and is ANYBODY being told? */
  getAlertState(): Promise<{
    this_device: boolean;
    anybody_covered: number | null;
    /** Does THIS admin hold the support permission? null = could not be read. */
    you_will_be_told: boolean | null;
    push_working: boolean;
  }> {
    return this.request("/admin/alerts", { method: "GET" });
  }

  /** Start being told on this device. */
  saveMyAlertDevice(token: string): Promise<{ message: string }> {
    return this.request("/admin/fcm-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  /** Stop being told. THIS is the switch; the browser side is only tidying. */
  forgetMyAlertDevice(): Promise<{ message: string }> {
    return this.request("/admin/fcm-token", { method: "DELETE" });
  }

  /** Prove it works now, rather than finding out when a real customer writes. */
  sendTestAlert(): Promise<{ ok: boolean; reason?: string }> {
    return this.request("/admin/fcm-test", { method: "POST" });
  }
}

// One client, shared by every screen.
export const apiClient = new APIClient();
