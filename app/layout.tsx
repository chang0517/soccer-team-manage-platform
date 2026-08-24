import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import PushPrompt from "@/components/PushPrompt";
import { getSessionUser } from "@/lib/auth";
import { getTeamById } from "@/lib/db";

const DEFAULT_NAME = "Team Manage";

// 로그인된 팀 이름으로 탭 타이틀을 채운다. 로그아웃 상태(또는 세션 만료)
// 에서는 특정 팀 이름을 노출할 수 없으니 범용 기본값으로 둔다 — 이 앱은
// 한 배포를 여러 팀이 같이 쓰기 때문에 "고정된 팀 이름"이라는 게 없다.
export async function generateMetadata(): Promise<Metadata> {
  const session = await getSessionUser();
  const team = session ? await getTeamById(session.teamId) : null;
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
    icons: {
      icon: [{ url: icon }],
      apple: team?.logoUrl || "/apple-touch-icon.png",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <Nav />
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:pb-10">
          {children}
        </main>
        <PushPrompt />
      </body>
    </html>
  );
}
