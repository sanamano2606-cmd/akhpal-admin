/**
 * SUPPORT ALERTS — the browser half.
 *
 * WHY THIS EXISTS
 * Until 16 September 2026, a customer writing to Takal Support reached nobody.
 * The conversation was marked unread and then waited for somebody to happen to
 * open the panel. The server now tells every admin who has turned alerts on;
 * this file is how an admin turns them on.
 *
 * WHY IT SAYS "THIS DEVICE" EVERYWHERE
 * A browser notification permission belongs to one browser on one machine.
 * Saying "alerts are on" without saying where would be a lie the first time
 * somebody turns them on at home and then wonders why the office computer is
 * silent.
 *
 * NOTHING HERE IS A SECRET. Firebase's web settings are sent to every visitor
 * by design. They are still fetched from the server rather than written into
 * this file, because the service worker needs exactly the same values and two
 * copies of a setting is how the two come to disagree.
 *
 * EVERY FAILURE IS ANSWERED IN WORDS A PERSON CAN ACT ON. "Permission denied"
 * tells nobody what to do next; "your browser has blocked alerts, tap the
 * padlock" does.
 */

export type AlertState =
  | "off"          // never turned on here
  | "on"           // this device will be told
  | "blocked"      // the browser has refused, and only the person can undo it
  | "unsupported"  // this browser cannot do it at all
  | "not-ready";   // the server is not giving out its web settings

export type AlertStatus = {
  state: AlertState;
  /** How many admins in total are covered. `0` means nobody is watching. */
  anybodyCovered: number | null;
  /** False when the server has no Firebase key, so nothing can ever arrive. */
  pushWorking: boolean;
  /** Something true to show the person, e.g. "Chrome on Windows". */
  deviceName: string;
};

const SW_PATH = "/firebase-messaging-sw.js";

/** Can this browser do it at all? Safari on old iPhones cannot. */
export function browserCanDoAlerts(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** A short, honest name for the thing the person is sitting at. */
export function describeThisDevice(): string {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "This browser";
  const where =
    /Android/.test(ua) ? "Android phone"
    : /iPhone|iPad/.test(ua) ? "iPhone"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "Mac"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return where ? `${browser} on ${where}` : browser;
}

/**
 * Takal's Firebase web settings, from the server.
 *
 * Returns null when they have not been set yet - which is a normal state on the
 * day this feature ships, not an error, and the card says so in plain words
 * instead of showing a broken button.
 */
export async function fetchWebSettings(apiBase: string): Promise<{
  apiKey: string; projectId: string; messagingSenderId: string;
  appId: string; vapidKey: string;
} | null> {
  try {
    const r = await fetch(`${apiBase}/push-config`, { cache: "no-store" });
    if (!r.ok) return null;
    const c = await r.json();
    if (!c?.apiKey || !c?.vapidKey || !c?.messagingSenderId) return null;
    return c;
  } catch {
    return null;
  }
}

/**
 * Ask the browser, then Firebase, for this device's address.
 *
 * THE PERMISSION PROMPT ONLY APPEARS ONCE, EVER. If the person says no, the
 * browser remembers and every later call returns "denied" without showing
 * anything - which looks like a broken button unless the difference is
 * reported, which is why "blocked" is its own answer.
 */
export async function turnOnHere(apiBase: string): Promise<
  { ok: true; token: string } | { ok: false; state: AlertState; why: string }
> {
  if (!browserCanDoAlerts()) {
    return { ok: false, state: "unsupported",
             why: "This browser cannot show alerts. Chrome or Edge can." };
  }

  const settings = await fetchWebSettings(apiBase);
  if (!settings) {
    return { ok: false, state: "not-ready",
             why: "The server is not giving out its alert settings. Nothing you can do here will fix that - it is a server setting, not a missing switch." };
  }

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    permission = "denied";
  }
  if (permission !== "granted") {
    return { ok: false, state: "blocked",
             why: "Your browser has blocked alerts for the panel." };
  }

  try {
    const reg = await navigator.serviceWorker.register(SW_PATH);
    // Firefox in particular hands back a registration that is not usable yet.
    await navigator.serviceWorker.ready;

    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken } = await import("firebase/messaging");

    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          apiKey: settings.apiKey,
          projectId: settings.projectId,
          messagingSenderId: settings.messagingSenderId,
          appId: settings.appId,
        });

    const token = await getToken(getMessaging(app), {
      vapidKey: settings.vapidKey,
      serviceWorkerRegistration: reg,
    });
    if (!token) {
      return { ok: false, state: "off",
               why: "The browser allowed alerts but gave no address back. Try once more." };
    }
    return { ok: true, token };
  } catch (e) {
    return { ok: false, state: "off",
             why: `Alerts could not be switched on: ${(e as Error)?.message || "unknown reason"}` };
  }
}

/**
 * Stop this browser asking to be told.
 *
 * The server side is what actually stops the alerts - it only looks at admins
 * whose address is saved. Undoing the browser registration as well keeps the
 * two honest, but it is the belt, not the braces.
 */
export async function turnOffHere(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.filter((r) => (r.active?.scriptURL || "").includes("firebase-messaging-sw"))
          .map((r) => r.unregister()),
    );
  } catch {
    /* The server has already been told; this is tidying, not the switch. */
  }
}
