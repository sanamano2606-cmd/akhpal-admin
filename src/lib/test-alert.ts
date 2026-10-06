/**
 * Who may press "Send a test alert to this device".
 *
 * Exactly the server's rule for /admin/fcm-test (app_guard.py and
 * navigation.ts SERVER_RULES): Marketing -> Notifications, or Support. The
 * button used to show to anybody whose support answer had not come back, and
 * Settings staff were then refused (admin audit low item 14, 6 October 2026).
 * Kept in a .ts file so plain Node can test it.
 */
export const TEST_ALERT_SECTIONS = ["marketing.notifications", "support"] as const;

export function mayUseTheTestAlert(canAccess: (section: string) => boolean): boolean {
  return TEST_ALERT_SECTIONS.some((s) => canAccess(s));
}
