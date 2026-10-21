"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useSession } from "./useSession";
import { haptic } from "./ui/haptic";
import { TEAM_SLUG_KEY } from "@/lib/teamSlug";

// "멤버"(회원가입 때 입력하고 필요하면 /members에서 직접 수정 — 운영진은
// /admin에서 링크로 들어감), "전당"(랭킹 페이지 안 탭으로 통합), "운영진"
// (계정 설정 안 링크로 이동)은 더 이상 바텀 네비 탭이 아니다.
const BASE_TABS = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/schedule", label: "일정", icon: "📅" },
  { href: "/notice", label: "게시판", icon: "📢" },
  { href: "/polls", label: "투표", icon: "🗳️" },
  { href: "/ranking", label: "랭킹", icon: "🏆" },
];

const SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useSession();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const tabs = BASE_TABS;

  // 로그인 전에도 이 기기에서 마지막으로 쓴 팀의 로고·이름을 왼쪽 위에 계속
  // 보여준다(처음 쓰는 기기라면 앱 로고). 마스터가 다른 팀을 방문 중일 때는
  // 기억하는 팀을 바꾸지 않아서, 로그아웃하면 내 팀 로고로 돌아온다.
  const [brand, setBrand] = useState<{ name: string; logo: string | null } | null>(null);
  useEffect(() => {
    if (loading) return;
    try {
      if (user) {
        if (user.teamSlug && !user.masterVisit) localStorage.setItem(TEAM_SLUG_KEY, user.teamSlug);
        return;
      }
      const slug = localStorage.getItem(TEAM_SLUG_KEY) ?? "";
      if (!slug) return;
      fetch("/api/teams/public")
        .then((r) => (r.ok ? r.json() : []))
        .then((list: { slug: string; name: string; logo: string | null }[]) => {
          const t = list.find((x) => x.slug === slug);
          if (t) setBrand({ name: t.name, logo: t.logo });
        })
        .catch(() => {});
    } catch {
      // 저장소를 못 쓰는 환경이면 앱 로고 그대로
    }
  }, [loading, user]);

  const doLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <header className="no-print sticky top-0 z-20 bg-blue-900/95 pt-[env(safe-area-inset-top)] text-white shadow-[0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/" className="pressable flex items-center gap-2.5">
            {user?.teamLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URI 로고라 next/image 최적화 대상이 아님
              <img
                src={user.teamLogoUrl}
                alt={user.teamName}
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/20"
              />
            ) : user ? (
              // 팀 화면인데 팀 로고가 아직 없으면 팀 이름 첫 글자(앱 로고는 쓰지 않음)
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-extrabold ring-2 ring-white/20">
                {user.teamName?.trim().charAt(0) || "T"}
              </span>
            ) : brand ? (
              // 로그인 전이어도 마지막으로 쓴 팀이 있으면 그 팀 로고
              brand.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- 팀이 올린 로고라 크기가 제각각
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/20"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-extrabold ring-2 ring-white/20">
                  {brand.name.trim().charAt(0) || "T"}
                </span>
              )
            ) : (
              // 처음 쓰는 기기(기억하는 팀이 없는 화면)에만 앱 로고
              // eslint-disable-next-line @next/next/no-img-element -- 작은 정적 아이콘
              <img
                src="/app-mark.png"
                alt="Team Manager"
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/20"
              />
            )}
            <span className="text-[17px] font-extrabold tracking-tight">
              {user?.teamName || brand?.name || "Team Manager"}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <nav className="relative hidden gap-1 md:flex">
              {tabs.map((t) => {
                const active = isActive(t.href);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`pressable relative rounded-lg px-3 py-1.5 text-sm font-medium ${
                      active ? "text-white" : "text-blue-100 hover:text-white"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="desktop-nav-pill"
                        transition={SPRING}
                        className="absolute inset-0 rounded-lg bg-white/15"
                      />
                    )}
                    <span className="relative">{t.label}</span>
                  </Link>
                );
              })}
            </nav>
            {!loading && (
              <div className="flex items-center gap-1.5 text-sm">
                {user ? (
                  <>
                    <Link
                      href="/account"
                      className="hidden text-blue-100 hover:underline sm:inline"
                    >
                      {user.displayName}님
                    </Link>
                    <Link
                      href="/account"
                      aria-label="계정 설정"
                      className="pressable flex h-9 w-9 items-center justify-center rounded-full text-base hover:bg-white/10 sm:hidden"
                    >
                      ⚙️
                    </Link>
                    <button
                      onClick={doLogout}
                      className="pressable rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="pressable rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-blue-900"
                  >
                    로그인
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      {user?.masterVisit && (
        <div className="no-print sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 flex items-center justify-between gap-2 bg-amber-400 px-4 py-1.5 text-xs font-bold text-amber-950">
          <span>🛠 마스터로 방문 중 · {user.teamName}</span>
          <Link href="/master" className="pressable rounded-full bg-amber-950/10 px-2.5 py-1">
            팀 바꾸기 / 돌아가기
          </Link>
        </div>
      )}
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200/70 bg-white/85 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] backdrop-blur-xl md:hidden">
        <div
          className="grid px-1.5 pt-1.5"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => haptic(8)}
                className={`pressable relative flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] ${
                  active ? "font-bold text-blue-700" : "font-medium text-zinc-500"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    transition={SPRING}
                    className="absolute inset-x-1 inset-y-0 rounded-2xl bg-blue-50"
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.15 : 1, y: active ? -1 : 0 }}
                  transition={SPRING}
                  className="relative text-xl leading-none"
                >
                  {t.icon}
                </motion.span>
                <span className="relative">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
