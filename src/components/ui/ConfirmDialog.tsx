"use client";

/**
 * "Are you sure?" - the same way, every time.
 *
 * Most destructive buttons in this panel already asked before acting, using the
 * browser's own grey confirm() box. Two did not: REJECT on the Stores page and
 * REJECT on the Riders page both fired the moment you clicked, sitting six
 * lines away from Suspend, which asked. Turning away a shop or a rider is at
 * least as final as suspending one.
 *
 * This replaces confirm() as well. A browser confirm box looks like the
 * operating system, not like Takal, and it cannot show the name of the thing
 * you are about to remove.
 */

import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  /** Say plainly WHAT happens, and name the thing. "Reject Matti Restaurant?"
   *  beats "Are you sure?" every time. */
  message,
  confirmLabel = "Yes, do it",
  cancelLabel = "Cancel",
  danger = true,
  busy = false,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      lockClose={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-takal-ink">{message}</p>
    </Modal>
  );
}
