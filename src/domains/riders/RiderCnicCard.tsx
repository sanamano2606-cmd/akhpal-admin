"use client";

/**
 * THE RIDER'S CNIC - the number and a picture of each side (Mock 163-5,
 * approved by Sana on 5 October 2026).
 *
 * The pictures are PRIVATE. The panel never holds an address that lasts: it
 * asks the server for links that work for 10 minutes, and the server writes
 * every look in the Audit Log. "Open full size" asks again for a fresh link
 * when the one on screen is about to run out.
 *
 * The rules (when a link is still good, which links are safe to show) live in
 * src/lib/cnic-pictures.ts, where plain Node can test them.
 */

import { useState, useEffect, useCallback } from "react";
import { Lock, ExternalLink, Contact } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui";
import {
  type CnicPictures, cnicLinkStillGood, isSafeCnicLink,
} from "@/lib/cnic-pictures";

export function RiderCnicCard({ riderId, cnic }: { riderId: string; cnic?: string | null }) {
  const [pics, setPics] = useState<CnicPictures | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");

  const load = useCallback(async (): Promise<CnicPictures | null> => {
    try {
      setFailed("");
      const d = (await apiClient.getRiderCnicPictures(riderId)) as CnicPictures;
      setPics(d);
      setFetchedAt(Date.now());
      return d;
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not load the CNIC pictures");
      return null;
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Open one side in a new tab - with a fresh link if this one is old. */
  const openFull = async (side: "front" | "back") => {
    // The tab is opened NOW, while the click still counts as a click, so the
    // browser does not block it; the address is filled in once it is known.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    let current = pics;
    if (!cnicLinkStillGood(fetchedAt, Date.now())) current = await load();
    const url = current?.[side];
    if (tab && isSafeCnicLink(url)) tab.location.href = url;
    else tab?.close();
  };

  const number = pics?.cnic || cnic || "—";
  const hasAny = !!(pics?.has_front || pics?.has_back);

  const side = (key: "front" | "back", label: string) => {
    const url = pics?.[key];
    const kept = key === "front" ? pics?.has_front : pics?.has_back;
    return (
      <div className="rounded-lg border border-takal-line overflow-hidden" data-cnic-side={key}>
        <div className="aspect-[16/10] bg-takal-page flex items-center justify-center">
          {isSafeCnicLink(url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`CNIC ${label.toLowerCase()}`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <p className="text-sm text-takal-ink-soft px-4 text-center">
              {kept ? "This picture could not be opened just now." : "Not sent"}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-sm font-semibold text-takal-ink">{label}</span>
          {kept && (
            <Button size="sm" variant="secondary" onClick={() => openFull(key)}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open full size
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-takal-line p-6" data-testid="rider-cnic-card">
      <h3 className="font-semibold text-takal-ink flex items-center gap-2">
        <Contact className="w-4 h-4" /> CNIC
      </h3>
      <p className="text-sm text-takal-ink-soft mt-1">{number}</p>

      {loading ? (
        <p className="text-sm text-takal-ink-soft mt-4">Loading the CNIC pictures…</p>
      ) : failed ? (
        <div className="mt-4 rounded-lg border border-takal-red bg-takal-red-soft p-3 text-sm text-takal-ink">
          {failed}{" "}
          <button className="underline font-semibold" onClick={() => load()}>Try again</button>
        </div>
      ) : !hasAny ? (
        <div className="mt-4 rounded-lg border border-dashed border-takal-line p-4 text-sm text-takal-ink">
          No CNIC pictures yet. The rider is asked for them in the Takal Riders app, on his
          Profile page.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 max-w-2xl">
            {side("front", "Front side")}
            {side("back", "Back side")}
          </div>
          {pics?.sent_at && (
            <p className="text-xs text-takal-ink-soft mt-2">Sent {fmtDate(pics.sent_at)}</p>
          )}
        </>
      )}

      <p className="text-xs text-takal-ink-soft mt-3 flex items-center gap-1">
        <Lock className="w-3.5 h-3.5" />
        Private pictures. The links work for 10 minutes, and opening them is written in the Audit Log.
      </p>
    </div>
  );
}
