"use client";

/**
 * THE CUSTOMER'S PRESCRIPTION PHOTO on an order (Mock 184, Sana 13 Oct 2026:
 * "yes, but keep it optional").
 *
 * PRIVATE, like a rider's CNIC: the panel never keeps an address that lasts.
 * It asks the server for a link that works for 10 minutes (the server writes
 * every look in the Audit Log), and "Open full size" asks again for a fresh
 * one. The same rules as the CNIC card (src/lib/cnic-pictures.ts).
 */

import { useCallback, useState } from "react";
import { ExternalLink, FileImage } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { cnicLinkStillGood, isSafeCnicLink } from "@/lib/cnic-pictures";

export function OrderPrescription({ orderId, sentAt }: { orderId: string; sentAt?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setWhy("");
    try {
      const d = await apiClient.getOrderPrescription(orderId);
      const link = d?.has_photo && isSafeCnicLink(d.url) ? d.url : null;
      setUrl(link);
      setAt(Date.now());
      if (!link) setWhy("The photo could not be opened just now.");
      return link;
    } catch (e) {
      setWhy(e instanceof Error ? e.message : "The photo could not be opened.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [orderId]);

  const openFull = async () => {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    const link = url && cnicLinkStillGood(at, Date.now()) ? url : await load();
    if (tab && link) tab.location.href = link;
    else tab?.close();
  };

  return (
    <div className="mt-4 rounded-lg border-2 border-takal-ink bg-white px-4 py-3 text-sm" data-prescription>
      <div className="flex flex-wrap items-center gap-3">
        <FileImage className="w-5 h-5 text-takal-ink" />
        <div className="flex-1 min-w-[10rem]">
          <p className="font-bold text-takal-ink">℞ Prescription photo</p>
          <p className="text-xs text-takal-ink-soft">
            Sent by the customer{sentAt ? ` · ${new Date(sentAt).toLocaleString()}` : ""}. Private -
            every look is written to the Audit Log.
          </p>
        </div>
        {!url ? (
          <Button size="sm" variant="secondary" onClick={load} loading={busy}>Show the photo</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={openFull}>
            <ExternalLink className="w-3.5 h-3.5 mr-1 inline" /> Open full size
          </Button>
        )}
      </div>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="The customer's prescription" referrerPolicy="no-referrer"
             className="mt-3 max-h-80 rounded border border-takal-line object-contain" />
      )}
      {why && <p className="mt-2 text-xs font-semibold text-takal-red">{why}</p>}
    </div>
  );
}
