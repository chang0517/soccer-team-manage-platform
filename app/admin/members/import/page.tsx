"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/useSession";
import { POS_GROUPS } from "@/lib/types";
import type { PosGroup } from "@/lib/types";

interface ParsedRow {
  name: string;
  backNo: string;
  pos1: string;
  pos2: string;
  phone: string;
}

function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        cells.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  });
}

export default function ImportMembersPage() {
  const { user, loading } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    created: string[];
    failed: { row: number; name: string; reason: string }[];
  } | null>(null);

  if (loading) return null;
  if (!user || user.role !== "admin") {
    return (
      <div className="space-y-3 pt-10 text-center">
        <p className="text-sm text-zinc-500">운영진만 볼 수 있는 페이지예요.</p>
        <Link href="/" className="font-semibold text-blue-700">
          홈으로
        </Link>
      </div>
    );
  }

  const onFile = async (file: File) => {
    setParseError("");
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    const table = parseCsv(text);
    if (table.length < 2) {
      setParseError("데이터가 없어요. 양식의 첫 줄(제목행) 아래에 멤버를 입력해 주세요.");
      setRows([]);
      return;
    }
    const body = table.slice(1); // 첫 줄(제목행) 제외
    const parsed: ParsedRow[] = body.map(([name, backNo, pos1, pos2, phone]) => ({
      name: name ?? "",
      backNo: backNo ?? "",
      pos1: (pos1 ?? "").toUpperCase(),
      pos2: (pos2 ?? "").toUpperCase(),
      phone: phone ?? "",
    }));
    setRows(parsed);
  };

  const isValidPos = (p: string) => POS_GROUPS.includes(p as PosGroup);

  const submit = async () => {
    const validRows = rows.filter((r) => r.name.trim());
    if (validRows.length === 0) return;
    if (
      !confirm(`${validRows.length}명을 등록할까요? 포지션이 비어있으면 CB/WB로 자동 설정돼요.`)
    )
      return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            name: r.name.trim(),
            backNo: r.backNo.trim() === "" ? null : Number(r.backNo.trim()),
            pos1: r.pos1,
            pos2: r.pos2,
            phone: r.phone.trim() || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error ?? "등록에 실패했어요.");
      } else {
        setResult(data);
        if (data.failed.length === 0) {
          setRows([]);
          setFileName("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      }
    } catch {
      setParseError("요청에 실패했어요. 네트워크를 확인해 주세요.");
    }
    setSubmitting(false);
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-24 pt-6">
      <Link href="/admin" className="text-sm font-semibold text-blue-700">
        ← 운영진 메뉴
      </Link>
      <h1 className="text-lg font-bold">멤버 명단 일괄 등록</h1>
      <p className="text-sm text-zinc-500">
        양식(CSV)을 받아서 멤버 명단을 채운 다음 업로드하면 한 번에 등록돼요.
        포지션은 <code className="rounded bg-zinc-100 px-1">GK·CB·WB·DM·AM·WG·ST</code>{" "}
        중 하나로 적어주세요(비워두면 CB/WB로 자동 설정).
      </p>

      <a
        href="/templates/member-roster-template.csv"
        download
        className="inline-block rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white"
      >
        ⬇️ 양식 다운로드
      </a>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="block text-xs font-semibold text-zinc-500">
          작성한 CSV 파일 업로드
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
        {fileName && <p className="mt-2 text-xs text-zinc-400">{fileName}</p>}
      </div>

      {parseError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{parseError}</p>
      )}

      {rows.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold">
            미리보기 — {rows.filter((r) => r.name.trim()).length}명
          </p>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="py-1.5 pr-2">이름</th>
                  <th className="py-1.5 pr-2">등번호</th>
                  <th className="py-1.5 pr-2">포지션1</th>
                  <th className="py-1.5 pr-2">포지션2</th>
                  <th className="py-1.5 pr-2">전화번호</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0">
                    <td className="py-1 pr-2">{r.name || <span className="text-red-500">(빈값)</span>}</td>
                    <td className="py-1 pr-2">{r.backNo}</td>
                    <td className="py-1 pr-2">
                      {r.pos1 ? (
                        isValidPos(r.pos1) ? (
                          r.pos1
                        ) : (
                          <span className="text-amber-600">{r.pos1}→CB</span>
                        )
                      ) : (
                        <span className="text-zinc-400">CB</span>
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {r.pos2 ? (
                        isValidPos(r.pos2) ? (
                          r.pos2
                        ) : (
                          <span className="text-amber-600">{r.pos2}→WB</span>
                        )
                      ) : (
                        <span className="text-zinc-400">WB</span>
                      )}
                    </td>
                    <td className="py-1 pr-2">{r.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="mt-3 w-full rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {submitting ? "등록 중…" : "일괄 등록"}
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-bold text-green-800">{result.created.length}명 등록 완료</p>
          {result.failed.length > 0 && (
            <>
              <p className="mt-2 font-semibold text-red-700">
                실패 {result.failed.length}건
              </p>
              <ul className="mt-1 space-y-0.5 text-red-600">
                {result.failed.map((f) => (
                  <li key={f.row}>
                    {f.row}번째 줄 {f.name && `(${f.name})`}: {f.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </main>
  );
}
