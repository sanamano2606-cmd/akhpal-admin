"use client";

/**
 * SETTINGS → ALERTS ON THIS DEVICE.   (Mock 77, approved 16 September 2026.)
 *
 * WHAT WAS WRONG
 * A customer wrote to Takal Support and nobody was told. The conversation was
 * marked unread and then waited for somebody to happen to open the panel. On a
 * Friday night that could be a very long time, and the customer had no way of
 * knowing that nothing was happening.
 *
 * WHY THE CARD SAYS "THIS DEVICE" AND NOT "ALERTS ARE ON"
 * A browser's permission belongs to one browser on one machine. "Alerts are
 * on" would be a lie the first time somebody turns them on at home and then
 * wonders why the office computer stayed silent all day.
 *
 * WHY IT ALSO SHOWS HOW MANY PEOPLE ARE COVERED
 * Alerts can be on for you and still nobody is watching at 2am. That is the
 * number a person would never think to ask for and the one that decides
 * whether a customer waits ten minutes or ten hours, so the card says it out
 * loud when it is zero.
 *
 * EVERY REFUSAL IS ANSWERED WITH WHAT TO DO NEXT. A browser that has been told
 * "no" once never shows the prompt again, so a plain "it failed" would leave
 * somebody pressing a button that can never work.
 */

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody, Button, Badge } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";
import {
  browserCanDoAlerts,
  describeThisDevice,
  turnOffHere,
  turnOnHere,
  type AlertState,
} from "@/lib/alerts";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.takalapp.com";

export function SupportAlerts() {
  const [state, setState] = useState<AlertState | "loading">("loading");
  const [covered, setCovered] = useState<number | null>(null);
  const [pushWorking, setPushWorking] = useState(true);
  // Null means the server could not work it out, which is not the same as
  // "no" and must not be shown as one.
  const [youWillBeTold, setYouWillBeTold] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState("");
  const device = describeThisDevice();

  const load = useCallback(async () => {
    if (!browserCanDoAlerts()) {
      setState("unsupported");
      return;
    }
    try {
      const s = await apiClient.getAlertState();
      setCovered(typeof s.anybody_covered === "number" ? s.anybody_covered : null);
      setPushWorking(Boolean(s.push_working));
      setYouWillBeTold(
        typeof s.you_will_be_told === "boolean" ? s.you_will_be_told : null);
      // THE BROWSER HAS THE LAST WORD. The server only knows that an address
      // was saved once. If the person has since blocked alerts in the browser,
      // the saved address is dead and "on" would be a lie.
      if (Notification.permission === "denied") setState("blocked");
      else setState(s.this_device ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function turnOn() {
    setBusy(true);
    setWhy("");
    try {
      const out = await turnOnHere(API_BASE);
      if (!out.ok) {
        setState(out.state);
        setWhy(out.why);
        return;
      }
      await apiClient.saveMyAlertDevice(out.token);
      setState("on");
      toast("Alerts are on for this device", "success");
      void load();
    } catch (e) {
      setWhy(errorMessage(e, "turning alerts on"));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      // THE SERVER FIRST. Emptying the saved address is what actually stops
      // the alerts. Undoing the browser side first and then failing here would
      // leave the server still sending into a void it believes is working.
      await apiClient.forgetMyAlertDevice();
      await turnOffHere();
      setState("off");
      toast("Alerts are off for this device", "success");
      void load();
    } catch (e) {
      toast(errorMessage(e, "turning alerts off"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const r = await apiClient.sendTestAlert();
      if (r?.ok) toast("Sent. It should arrive in a moment.", "success");
      else toast(r?.reason || "The test alert did not go.", "error");
    } catch (e) {
      toast(errorMessage(e, "sending a test alert"), "error");
    } finally {
      setBusy(false);
    }
  }

  const pill =
    state === "on" ? <Badge tone="good" icon={<Check className="w-3 h-3" />}>Alerts are on</Badge>
    : state === "blocked" ? <Badge tone="bad" icon={<AlertTriangle className="w-3 h-3" />}>Your browser said no</Badge>
    : state === "unsupported" ? <Badge tone="neutral">This browser cannot</Badge>
    : state === "not-ready" ? <Badge tone="warn">Not set up yet</Badge>
    : <Badge tone="neutral" icon={<BellOff className="w-3 h-3" />}>Alerts are off</Badge>;

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Bell className="w-4 h-4" /> Alerts on this device
          </span>
        }
        hint="Be told the moment a customer writes to support."
      />
      <CardBody>
        <div className="mb-3">{pill}</div>

        {state === "loading" && (
          <p className="text-sm text-takal-ink-soft">Checking…</p>
        )}

        {state === "off" && (
          <>
            <p className="text-sm text-takal-ink-soft">
              Right now, when a customer writes to support, nobody is told. The
              message waits until somebody opens the support page.
            </p>
            <Button className="mt-4 w-full" onClick={turnOn} loading={busy}>
              Turn on alerts on this device
            </Button>
            <p className="mt-2 text-xs text-takal-ink-soft">
              Your browser will ask you once. This covers {device} only — turn it
              on wherever you want to be told.
            </p>
          </>
        )}

        {state === "on" && youWillBeTold === false && (
          <>
            {/* THE ONE THING THIS CARD MUST NEVER GET WRONG.
                Support alerts only go to admins who may open the support
                section, because the alert carries the first 90 characters of
                what the customer wrote. Without this box, somebody without
                that permission would switch alerts on, read "Alerts are on",
                and wait for ever. */}
            <div className="rounded-lg border border-takal-red bg-red-50 p-3">
              <p className="text-sm font-bold text-takal-ink">
                You will not receive support alerts
              </p>
              <p className="mt-1 text-sm text-takal-ink">
                This device is switched on, but your account does not have the
                <b> Support </b> permission — and a support alert shows what the
                customer wrote. Ask the Main Admin to add it on
                Settings → Admin Users.
              </p>
            </div>
            <Button variant="ghost" className="mt-3 w-full text-takal-red"
                    onClick={turnOff} loading={busy}>
              Turn off on this device
            </Button>
          </>
        )}

        {state === "on" && youWillBeTold !== false && (
          <>
            <p className="text-sm text-takal-ink-soft">
              {device} will be told the moment a customer writes — even when the
              panel is closed.
            </p>
            <Button variant="secondary" className="mt-4 w-full"
                    onClick={sendTest} loading={busy}>
              Send a test alert to this device
            </Button>
            <Button variant="ghost" className="mt-2 w-full text-takal-red"
                    onClick={turnOff} loading={busy}>
              Turn off on this device
            </Button>
          </>
        )}

        {state === "blocked" && (
          <>
            <p className="text-sm text-takal-ink-soft">
              This browser has blocked alerts for the panel, so Takal cannot turn
              them on from here.
            </p>
            <div className="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm">
              <b>To fix it:</b> tap the padlock next to the web address →
              Notifications → Allow. Then press the button again.
            </div>
            <Button className="mt-4 w-full" onClick={turnOn} loading={busy}>
              Try again
            </Button>
          </>
        )}

        {state === "not-ready" && (
          <p className="text-sm text-takal-ink-soft">
            {why || "The server is not giving out its alert settings. Nothing you can do here will fix that — it is a server setting, not a missing switch."}
          </p>
        )}

        {state === "unsupported" && (
          <p className="text-sm text-takal-ink-soft">
            This browser cannot show alerts. Chrome or Edge can, on a phone or a
            computer.
          </p>
        )}

        {why && state !== "not-ready" && (
          <p className="mt-3 text-sm text-takal-red">{why}</p>
        )}

        {/* THE NUMBER THAT DECIDES WHETHER ANYBODY IS ACTUALLY WATCHING. */}
        {covered === 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-takal-ink">
            <b>Nobody is being alerted at all.</b> No admin anywhere has turned
            this on, so every message waits until somebody opens the page.
          </div>
        )}
        {covered !== null && covered > 0 && (
          <p className="mt-4 text-xs text-takal-ink-soft">
            {covered} {covered === 1 ? "person is" : "people are"} being alerted
            across all devices.
          </p>
        )}
        {!pushWorking && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
            <b>The server cannot send any alerts.</b> Its Firebase key is
            missing, so nothing will arrive however this is set. Check
            <span className="font-mono"> /health</span> → push.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
