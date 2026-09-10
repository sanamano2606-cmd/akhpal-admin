"use client";

/**
 * ONE SUPPORT CONVERSATION — read it, and answer it.
 *
 * Plan 52, Mock 53, approved by Sana on 10 September 2026.
 *
 * TWO THINGS ABOUT THIS SCREEN ARE DELIBERATE AND MUST NOT BE "TIDIED UP":
 *
 *   1. TAKAL'S OWN WORDS ARE YELLOW, the customer's are white. Yellow here is
 *      not a warning — it is Takal speaking. That is the only meaning yellow
 *      ever carries in this project. Black writing on it, always.
 *   2. WHO TYPED THE REPLY IS SHOWN HERE AND NOWHERE ELSE. The customer is
 *      talking to Takal, not to a named member of staff. The server already
 *      refuses to send the name to the app; this screen shows it because the
 *      office needs to know who answered.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, Paperclip, Clock } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Badge, ConfirmDialog, ErrorState, LoadingState } from "@/components/ui";
import { money, fmtDateTime } from "@/lib/format";
import { readFailure, type ReadFailure } from "@/lib/api-errors";

function waitedFor(iso: any): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default function SupportThreadPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = String((params as any)?.id || "");

  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>({});
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);

  const [reply, setReply] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  /** The name of the picture chosen, so the person can see WHICH one. */
  const [imageName, setImageName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const filePicker = useRef<HTMLInputElement | null>(null);
  const [askClose, setAskClose] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);

  const fetchThread = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getSupportThread(threadId)) as any;
      setThread(res?.thread || null);
      setMessages(res?.messages || []);
      setCustomer(res?.customer || {});
      setOrder(res?.order || null);
    } catch (err) {
      setError(readFailure(err, "this conversation"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (threadId) fetchThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Always land on the newest message. A support person opening a long
  // conversation wants the bottom of it, not the beginning.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // CHOOSING A PICTURE, PROPERLY.
  //
  // This was a box to type a web address into - which is no use at all to a
  // support person holding a photo the customer needs to see. Sana's note:
  // "the File or photo picker is also not working on replying window."
  //
  // It goes through the SAME door every other picture on the platform uses,
  // so it is shrunk, stripped and re-saved on arrival with no special case
  // here. The picture is uploaded the moment it is chosen, not when Send is
  // pressed, so a failure is known before the words are written.
  const choosePicture = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("That file is not a picture. Choose a JPG, PNG or WebP.", "error");
      return;
    }
    try {
      setUploading(true);
      const res = (await apiClient.uploadImage(file)) as any;
      const url = String(res?.url || res?.image_url || "");
      if (!url) throw new Error("The server did not return a picture address.");
      setImageUrl(url);
      setImageName(file.name);
      toast("Picture attached.", "success");
    } catch (err) {
      // Say what the SERVER said. It answers in plain sentences.
      toast(err instanceof Error ? err.message : "The picture could not be sent.", "error");
    } finally {
      setUploading(false);
      // Let the same file be chosen again after a failure.
      if (filePicker.current) filePicker.current.value = "";
    }
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text) {
      toast("Write something first.", "info");
      return;
    }
    if (text.length > 2000) {
      toast("That reply is too long. Please keep it under 2000 characters.", "error");
      return;
    }
    try {
      setSending(true);
      await apiClient.replySupport(threadId, text, imageUrl.trim() || undefined);
      setReply("");
      setImageUrl("");
      setImageName("");
      toast("Reply sent. The customer gets it on their phone.", "success");
      await fetchThread();
    } catch (err) {
      toast(err instanceof Error ? err.message : "The reply could not be sent.", "error");
    } finally {
      setSending(false);
    }
  };

  const doClose = async () => {
    try {
      setSending(true);
      await apiClient.closeSupportThread(threadId);
      setAskClose(false);
      toast("Conversation closed.", "success");
      await fetchThread();
    } catch (err) {
      toast(err instanceof Error ? err.message : "It could not be closed.", "error");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState label="Opening the conversation…" />;

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push("/dashboard/support")}
          className="flex items-center gap-2 text-takal-ink-soft hover:text-takal-ink"
        >
          <ArrowLeft className="w-4 h-4" /> Back to the inbox
        </button>
        <ErrorState message={error.message} onRetry={fetchThread} denied={error.denied} />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push("/dashboard/support")}
          className="flex items-center gap-2 text-takal-ink-soft hover:text-takal-ink"
        >
          <ArrowLeft className="w-4 h-4" /> Back to the inbox
        </button>
        <p className="text-takal-ink-soft">This conversation was not found.</p>
      </div>
    );
  }

  const isClosed = thread.status === "closed";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push("/dashboard/support")}
            className="mt-1 rounded-lg p-1.5 hover:bg-slate-100"
            aria-label="Back to the inbox"
          >
            <ArrowLeft className="w-5 h-5 text-takal-ink" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-takal-ink">
              {thread.subject || "(no subject)"}
            </h2>
            <p className="text-takal-ink-soft mt-1">
              Started {fmtDateTime(thread.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {thread.unread_for_takal && (
            <Badge tone="bad" icon={<Clock className="w-3.5 h-3.5" />}>
              Waiting {waitedFor(thread.last_message_at)}
            </Badge>
          )}
          {isClosed && <Badge tone="neutral">Closed</Badge>}
          {!isClosed && !thread.unread_for_takal && thread.status === "answered" && (
            <Badge tone="good">Answered</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── The conversation itself ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-takal-line p-4 space-y-3 max-h-[28rem] overflow-y-auto">
            {/* read-safe: nothing below this point is drawn unless the read
                succeeded — a failure returns the error screen above, and a
                missing conversation returns the not-found screen above that.
                So "no messages" here is a fact, not an unread page. */}
            {messages.length === 0 ? (
              <p className="text-takal-ink-soft text-sm py-6 text-center">
                There are no messages in this conversation.
              </p>
            ) : (
              messages.map((m) => {
                const fromTakal = m.sender === "takal";
                return (
                  <div
                    key={m.id}
                    className={`flex ${fromTakal ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ring-1 ring-inset ${
                        fromTakal
                          ? "bg-takal-yellow text-takal-ink ring-takal-yellow-dark"
                          : "bg-white text-takal-ink ring-takal-line"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      {m.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image_url}
                          alt="Sent with the message"
                          className="mt-2 max-h-56 rounded-lg border border-takal-line"
                        />
                      )}
                      <p className="mt-1 text-[11px] text-takal-ink-soft">
                        {fromTakal ? "Takal" : customer.full_name || "Customer"}
                        {" · "}
                        {fmtDateTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottom} />
          </div>

          {/* ── The reply box ────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-takal-line p-4 space-y-3">
            {isClosed && (
              <p className="text-sm text-takal-ink-soft">
                This conversation is closed. Replying opens it again.
              </p>
            )}
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Write your reply to the customer…"
              className="w-full px-4 py-3 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none resize-y"
            />
            <div className="flex items-center gap-2">
              <input
                ref={filePicker}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => choosePicture(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => filePicker.current?.click()}
                disabled={uploading || sending}
                className="inline-flex items-center gap-2 rounded-lg border border-takal-line px-3 py-2 text-sm font-medium text-takal-ink hover:bg-takal-page disabled:opacity-50"
              >
                <Paperclip className="w-4 h-4" />
                {uploading ? "Sending the picture…" : "Attach a picture"}
              </button>
              {imageUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Attached"
                    className="h-10 w-10 rounded-md border border-takal-line object-cover"
                  />
                  <span className="truncate text-xs text-takal-ink-soft max-w-[12rem]">
                    {imageName || "Picture attached"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl("");
                      setImageName("");
                    }}
                    className="text-xs font-semibold text-takal-red hover:underline"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-takal-ink-soft">
                {reply.length}/2000 · the customer gets this on their phone
              </span>
              <button
                onClick={sendReply}
                disabled={sending || uploading || reply.trim().length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink font-semibold rounded-lg transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send reply"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Who it is, and what it is about ──────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-takal-line p-4">
            <h3 className="text-sm font-semibold text-takal-ink mb-3">Customer</h3>
            <p className="text-sm font-semibold text-takal-ink">
              {customer.full_name || "Customer"}
            </p>
            <p className="text-sm text-takal-ink-soft">{customer.phone || "—"}</p>
            {customer.email && (
              <p className="text-sm text-takal-ink-soft break-all">{customer.email}</p>
            )}
            {customer.id && (
              <Link
                href={`/dashboard/customers/${customer.id}`}
                className="mt-3 inline-block text-sm text-takal-blue hover:underline"
              >
                Open the customer →
              </Link>
            )}
          </div>

          <div className="bg-white rounded-lg border border-takal-line p-4">
            <h3 className="text-sm font-semibold text-takal-ink mb-3">About this order</h3>
            {!thread.order_id ? (
              <p className="text-sm text-takal-ink-soft">
                This message is not about a particular order.
              </p>
            ) : !order ? (
              <p className="text-sm text-takal-ink-soft">
                The order behind this conversation could not be read. The
                conversation is still complete.
              </p>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-takal-ink">
                  #{String(order.id).slice(0, 8)}
                </p>
                <p className="text-takal-ink-soft">
                  {order.restaurant_name || "Shop not recorded"}
                </p>
                <p className="text-takal-ink-soft">{money(order.total_amount)}</p>
                <p className="text-takal-ink-soft">
                  {order.delivered_at
                    ? `Delivered ${fmtDateTime(order.delivered_at)}`
                    : `Placed ${fmtDateTime(order.created_at)}`}
                </p>
                <Link
                  href={`/dashboard/orders?order=${order.id}`}
                  className="mt-2 inline-block text-takal-blue hover:underline"
                >
                  Open the order →
                </Link>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-takal-line p-4 space-y-2">
            <h3 className="text-sm font-semibold text-takal-ink mb-1">When it is finished</h3>
            <p className="text-xs text-takal-ink-soft">
              Closing only tidies the list. The customer can write again at any
              time, which opens it back up. A conversation nobody adds to for
              two days closes itself.
            </p>
            <button
              onClick={() => setAskClose(true)}
              disabled={isClosed || sending}
              className="w-full px-4 py-2.5 bg-white border border-takal-line text-takal-ink font-medium rounded-lg hover:bg-takal-page transition disabled:opacity-50"
            >
              {isClosed ? "Already closed" : "Close this conversation"}
            </button>
          </div>

          {/* WHO ANSWERED. Panel only — never sent to the customer's app. */}
          {thread.last_admin_id && (
            <p className="text-xs text-takal-ink-soft px-1">
              Last answered by admin{" "}
              <span className="font-mono">{String(thread.last_admin_id).slice(0, 8)}</span>.
              The customer is never shown this.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={askClose}
        busy={sending}
        onCancel={() => setAskClose(false)}
        title="Close this conversation?"
        confirmLabel="Yes, close it"
        message={
          <>
            It leaves the waiting list. <b>{customer.full_name || "The customer"}</b>{" "}
            can still write again, and that opens it back up.
          </>
        }
        onConfirm={doClose}
      />
    </div>
  );
}
