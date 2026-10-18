"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

/**
 * "내 캘린더에 추가" — 우리 팀 일정 구독 주소를 받아 아이폰 캘린더(webcal)나
 * 구글 캘린더(안드로이드·갤럭시)에 한 번에 등록할 수 있게 한다. 구독해두면
 * 새 일정·변경 사항이 휴대폰 캘린더에 자동으로 반영된다.
 */
export default function CalendarSubscribe() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const show = async () => {
    setOpen(true);
    if (url) return;
    const res = await fetch("/api/calendar/subscribe");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) {
      toast.error(data?.error || "구독 주소를 가져오지 못했어요.");
      setOpen(false);
      return;
    }
    setUrl(data.url);
  };

  const webcal = url?.replace(/^https?:\/\//, "webcal://") ?? "";
  const google = url ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` : "";

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("구독 주소를 복사했어요");
    } catch {
      toast.error("복사하지 못했어요. 주소를 길게 눌러 복사해 주세요.");
    }
  };

  return (
    <>
      <button
        onClick={show}
        className="rounded-full bg-white px-3.5 py-2 text-sm font-bold text-blue-700 shadow-sm ring-1 ring-zinc-200"
      >
        📅 내 캘린더에 추가
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="bg"
              className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-center">
              <motion.div
                key="sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cal-title"
                className="pointer-events-auto w-full max-w-md space-y-3 rounded-t-[1.75rem] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 shadow-2xl md:mx-4 md:rounded-[1.75rem] md:pb-5"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                <div className="mx-auto h-1.5 w-10 rounded-full bg-zinc-200 md:hidden" />
                <div>
                  <p id="cal-title" className="text-[17px] font-extrabold tracking-tight">
                    팀 일정을 내 캘린더에 추가
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    한 번 구독해두면 새 일정과 바뀐 시간·장소가 휴대폰 캘린더에 자동으로
                    반영돼요.
                  </p>
                </div>
                {!url ? (
                  <p className="py-6 text-center text-sm text-zinc-400">주소를 준비하는 중…</p>
                ) : (
                  <div className="space-y-2">
                    <a
                      href={webcal}
                      className="flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3.5 text-white"
                    >
                      <span className="text-xl" aria-hidden="true">📱</span>
                      <span className="flex-1">
                        <span className="block text-sm font-bold">아이폰 · 맥 캘린더</span>
                        <span className="block text-xs text-zinc-300">누르고 &lsquo;구독&rsquo;을 선택하세요</span>
                      </span>
                    </a>
                    <a
                      href={google}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-2xl bg-blue-700 px-4 py-3.5 text-white"
                    >
                      <span className="text-xl" aria-hidden="true">
                        G
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-bold">구글 캘린더 (안드로이드 · 갤럭시)</span>
                        <span className="block text-xs text-blue-100">
                          구글 계정에 추가되면 삼성 캘린더에도 함께 보여요
                        </span>
                      </span>
                    </a>
                    <button
                      onClick={copy}
                      className="w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-700"
                    >
                      구독 주소 복사
                    </button>
                    <p className="text-[11px] leading-relaxed text-zinc-400">
                      캘린더 앱이 몇 시간마다 새로 불러와서, 방금 바뀐 일정은 조금 늦게 보일 수
                      있어요. 이 주소는 우리 팀원끼리만 공유해 주세요.
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
