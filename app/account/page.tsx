"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import NotificationSettings from "@/components/NotificationSettings";
import { useSession } from "@/components/useSession";

// 큰 사진을 그대로 올리면 서버 쪽 800KB 캡에 걸리기 쉬워서, 올리기 전에
// 브라우저에서 정사각형으로 잘라 작게(최대 256px) 리사이즈해서 보낸다.
const MAX_LOGO_DIM = 256;

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = MAX_LOGO_DIM;
        canvas.height = MAX_LOGO_DIM;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("캔버스를 사용할 수 없어요."));
        ctx.drawImage(
          img,
          (img.width - size) / 2,
          (img.height - size) / 2,
          size,
          size,
          0,
          0,
          MAX_LOGO_DIM,
          MAX_LOGO_DIM
        );
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("이미지를 읽을 수 없어요."));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요."));
    reader.readAsDataURL(file);
  });
}

export default function AccountPage() {
  const { user, loading: sessionLoading, refresh } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [teamName, setTeamName] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadLogo = async (file: File) => {
    setLogoSaving(true);
    setLogoError("");
    try {
      const dataUri = await resizeImageFile(file);
      const res = await fetch("/api/teams/logo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoDataUri: dataUri }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드에 실패했어요.");
      await refresh();
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : "업로드에 실패했어요.");
    } finally {
      setLogoSaving(false);
    }
  };

  const saveTeamName = async () => {
    const name = (teamName ?? "").trim();
    if (!name || name === user?.teamName) return;
    setNameSaving(true);
    try {
      const res = await fetch("/api/teams/name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "변경에 실패했어요.");
      await refresh();
      setTeamName(null);
      toast.success(`팀 이름을 "${name}"(으)로 바꿨어요`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "변경에 실패했어요.");
    } finally {
      setNameSaving(false);
    }
  };

  const removeLogo = async () => {
    setLogoSaving(true);
    setLogoError("");
    await fetch("/api/teams/logo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoDataUri: null }),
    });
    await refresh();
    setLogoSaving(false);
  };

  const input =
    "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm";

  const submit = async () => {
    if (!currentPassword || newPassword.length < 4) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "비밀번호 변경에 실패했어요.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setSuccess(true);
  };

  if (sessionLoading) return null;

  if (!user) {
    return (
      <div className="space-y-3 pt-10 text-center">
        <p className="text-sm text-zinc-500">로그인이 필요해요.</p>
        <Link href="/login" className="font-semibold text-blue-700">
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-10">
      <h1 className="text-center text-2xl font-extrabold tracking-tight">계정 설정</h1>
      <p className="text-center text-sm text-zinc-500">
        {user.displayName}님 ({user.username})
      </p>
      {user.role === "admin" && (
        <div className="space-y-2 rounded-3xl bg-blue-50/70 ring-1 ring-blue-100 p-4">
          <p className="text-sm font-bold text-blue-900">운영진</p>
          <Link href="/admin" className="block text-sm font-semibold text-blue-700">
            가입 승인 관리 →
          </Link>
        </div>
      )}

      <NotificationSettings />

      {user.isMaster && (
        <div className="space-y-2 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-sm font-bold text-amber-900">🛠 마스터</p>
          <p className="text-xs text-amber-800">
            모든 팀에 승인 없이 운영진으로 들어갈 수 있어요.
          </p>
          <Link href="/master" className="block text-sm font-semibold text-blue-700">
            팀 목록 보기 →
          </Link>
        </div>
      )}

      {user.role === "admin" && (
        <div className="space-y-2 card p-4">
          <div>
            <p className="text-sm font-bold">팀 이름</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              화면 상단과 브라우저 탭에 보이는 이름이에요. 로그인할 때 쓰는 팀 코드는 바뀌지 않아요.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              className={input}
              value={teamName ?? user.teamName}
              maxLength={40}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTeamName()}
            />
            <button
              onClick={saveTeamName}
              disabled={nameSaving || !(teamName ?? "").trim() || teamName?.trim() === user.teamName}
              className="shrink-0 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              {nameSaving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}

      {user.role === "admin" && (
        <div className="space-y-3 card p-4">
          <div>
            <p className="text-sm font-bold">팀 로고</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              올리면 우리 팀원 모두의 화면 상단 아이콘과 브라우저 탭 아이콘이 이 로고로 바뀌어요.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user.teamLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.teamLogoUrl}
                alt={user.teamName}
                className="h-14 w-14 rounded-full object-cover ring-1 ring-zinc-200"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-900 text-xl font-extrabold text-white">
                {user.teamName?.trim().charAt(0) || "T"}
              </span>
            )}
            <div className="flex flex-col gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={logoSaving}
                className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {logoSaving ? "처리 중…" : "로고 업로드"}
              </button>
              {user.teamLogoUrl && (
                <button
                  onClick={removeLogo}
                  disabled={logoSaving}
                  className="text-xs text-zinc-400 underline disabled:opacity-40"
                >
                  올린 로고 지우기
                </button>
              )}
            </div>
          </div>
          {logoError && <p className="text-sm text-red-500">{logoError}</p>}
        </div>
      )}

      <div className="space-y-3 card p-4">
        <div>
          <label className="text-xs font-semibold text-zinc-500">현재 비밀번호</label>
          <input
            type="password"
            className={input}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-500">새 비밀번호</label>
          <input
            type="password"
            className={input}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-blue-700">비밀번호가 변경됐어요.</p>}
        <button
          onClick={submit}
          disabled={loading || !currentPassword || newPassword.length < 4}
          className="w-full rounded-2xl bg-blue-700 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 disabled:opacity-40"
        >
          {loading ? "변경 중…" : "비밀번호 변경"}
        </button>
      </div>
      <p className="text-center">
        <Link href="/about" className="text-sm font-semibold text-blue-700">
          앱 기능 소개 보기
        </Link>
      </p>
    </div>
  );
}
