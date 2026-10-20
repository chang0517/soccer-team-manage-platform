import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import PushPrompt from "@/components/PushPrompt";
import Providers from "@/components/ui/Providers";
import { getSessionUser } from "@/lib/auth";
import { getTeamById } from "@/lib/db";

const DEFAULT_NAME = "Team Manager";

// 로그인된 팀 이름으로 탭 타이틀을 채운다. 로그아웃 상태(또는 세션 만료)
// 에서는 특정 팀 이름을 노출할 수 없으니 범용 기본값으로 둔다 — 이 앱은
// 한 배포를 여러 팀이 같이 쓰기 때문에 "고정된 팀 이름"이라는 게 없다.
export async function generateMetadata(): Promise<Metadata> {
  const session = await getSessionUser();
  // 탭 제목·아이콘은 부가 정보라, DB가 잠깐 응답하지 않는다고 해서 화면
  // 전체가 "This page couldn't load"로 죽으면 안 된다 — 실패하면 기본값으로.
  const team = session
    ? await getTeamById(session.teamId).catch((e) => {
        console.error("[layout] team lookup failed:", e);
        return null;
      })
    : null;
  const name = team?.name ?? DEFAULT_NAME;
  // 팀 로고가 있으면 브라우저 탭 아이콘도 그걸로 — generateMetadata는
  // 요청마다 다시 실행되니 data: URI를 그대로 넣어도 된다. 다만 홈 화면에
  // "설치"하는 PWA 아이콘(manifest.webmanifest)은 정적 파일이라 이건
  // 여전히 범용 아이콘으로 고정된다.
  const icon = team?.logoUrl || "/favicon-32.png";
  return {
    title: name,
    description: `${name} 일정·스쿼드·기록 관리`,
    manifest: "/manifest.webmanifest",
    // Next는 접두사 없는 mobile-web-app-capable만 내보내는데, 아이폰 홈 화면
    // 앱(전체 화면 실행)은 apple-mobile-web-app-capable도 있어야 안정적으로
    // 앱처럼 열린다.
    other: { "apple-mobile-web-app-capable": "yes" },
    icons: {
      icon: [{ url: icon }],
      // 아이폰은 홈 화면 아이콘으로 data: 주소를 못 읽는 경우가 있어서, 팀 로고는
      // 이미지 주소(로고가 바뀌면 v도 바뀜)로 내려준다.
      apple: team?.logoUrl
        ? `/api/teams/${team.slug}/logo?v=${team.logoUrl.length}`
        : "/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: name,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* 한글 UI에 최적화된 Pretendard (실패하면 시스템 글꼴로 대체됨) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-10">
            {children}
          </main>
          <PushPrompt />
        </Providers>
      </body>
    </html>
  );
}
