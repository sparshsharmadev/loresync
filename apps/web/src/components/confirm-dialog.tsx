"use client";

import { useEffect, useId, useRef, useState } from "react";

type ConfirmDialogProps = {
  open: boolean;
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "warning";
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  eyebrow,
  title,
  description,
  confirmLabel,
  tone = "warning",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [working, setWorking] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  async function confirm() {
    if (working) return;
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`confirm-dialog confirm-dialog-${tone}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!working) onCancel();
      }}
    >
      <div className="confirm-dialog-frame">
        <div className="confirm-dialog-kicker"><span>{eyebrow}</span><span>!</span></div>
        <div className="confirm-dialog-content">
          <div className="confirm-dialog-mark" aria-hidden="true">!</div>
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-cancel" onClick={onCancel} disabled={working}>
            Keep it
          </button>
          <button type="button" className="confirm-dialog-submit" onClick={() => void confirm()} disabled={working}>
            {working ? "PLEASE WAIT…" : confirmLabel}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
