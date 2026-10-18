"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { haptic } from "./haptic";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let show: ((req: Pending) => void) | null = null;

// window.confirm 대체 — 화면 아래에서 올라오는 시트로 묻고 Promise<boolean>을
// 돌려준다. 사용: if (!(await confirmSheet({ title: "삭제할까요?", destructive: true }))) return;
export function confirmSheet(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === "string" ? { title: opts } : opts;
  return new Promise((resolve) => {
    if (!show) {
      resolve(window.confirm(o.title));
      return;
    }
    show({ ...o, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Pending | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = (r) => {
      haptic(8);
      setReq(r);
    };
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  useEffect(() => {
    if (!req) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  return (
    <AnimatePresence>
      {req && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(false)}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <motion.div
              key="sheet"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              className="pointer-events-auto w-full max-w-md rounded-t-[1.75rem] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 shadow-2xl md:mx-4 md:rounded-[1.75rem] md:pb-5"
              initial={{ y: "100%", opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 500) close(false);
              }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-200 md:hidden" />
              <p id="confirm-title" className="whitespace-pre-line text-[17px] font-extrabold tracking-tight">
                {req.title}
              </p>
              {req.description && (
                <p className="mt-1.5 whitespace-pre-line text-sm text-zinc-500">{req.description}</p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => close(false)}
                  className="rounded-2xl bg-zinc-100 py-3 text-sm font-bold text-zinc-700"
                >
                  {req.cancelText ?? "취소"}
                </button>
                <button
                  ref={confirmRef}
                  onClick={() => {
                    haptic(12);
                    close(true);
                  }}
                  className={`rounded-2xl py-3 text-sm font-bold text-white shadow-lg ${
                    req.destructive
                      ? "bg-red-500 shadow-red-500/25"
                      : "bg-blue-700 shadow-blue-700/25"
                  }`}
                >
                  {req.confirmText ?? (req.destructive ? "삭제" : "확인")}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
