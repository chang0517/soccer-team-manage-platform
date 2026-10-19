import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "./Reveal";

export const metadata: Metadata = {
  title: "기능 소개 · Team Manager",
  description: "일정·참석 투표·스쿼드·경기 기록·MVP·랭킹까지, 조기축구 팀 운영을 한 곳에서.",
};

type Shot = { src: string; w: number; h: number; alt: string };

const SHOTS = {
  home: { src: "/about/home.webp", w: 640, h: 1385, alt: "홈 화면" },
  squad: { src: "/about/squad-confirmed.webp", w: 640, h: 1739, alt: "확정된 스쿼드 필드" },
  squadTable: { src: "/about/squad-table.webp", w: 640, h: 1739, alt: "쿼터별 출전표" },
  record: { src: "/about/record.webp", w: 640, h: 1182, alt: "경기 기록 화면" },
  recordSheet: { src: "/about/record-sheet.webp", w: 640, h: 1009, alt: "골 기록 시트" },
  mvp: { src: "/about/mvp.webp", w: 640, h: 735, alt: "MVP 투표 화면" },
  ranking: { src: "/about/ranking.webp", w: 640, h: 1477, alt: "시즌 랭킹" },
  login: { src: "/about/login.webp", w: 640, h: 1050, alt: "팀 선택 로그인 화면" },
} satisfies Record<string, Shot>;

function Phone({ shot, className = "" }: { shot: Shot; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[26px] bg-white shadow-xl shadow-zinc-900/10 ring-1 ring-zinc-200 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 소개용 스크린샷 */}
      <img src={shot.src} width={shot.w} height={shot.h} alt={shot.alt} loading="lazy" className="block h-auto w-full" />
    </div>
  );
}

function Section({
  tag,
  title,
  lead,
  points,
  shots,
}: {
  tag: string;
  title: string;
  lead: string;
  points: string[];
  shots?: Shot[];
}) {
  return (
    <Reveal>
      <section className="card space-y-4 p-5">
        <div>
          <p className="text-xs font-bold tracking-wide text-blue-700">{tag}</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{lead}</p>
        </div>
        <ul className="space-y-1.5 text-sm text-zinc-700">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-0.5 text-blue-600">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {shots && (
          <div
            className={`grid gap-3 pt-1 ${shots.length > 1 ? "grid-cols-2" : "mx-auto max-w-[260px] grid-cols-1"}`}
          >
            {shots.map((s) => (
              <Phone key={s.src} shot={s} />
            ))}
          </div>
        )}
      </section>
    </Reveal>
  );
}

const MORE = [
  ["📅", "일정 캘린더", "월간 캘린더와 목록으로 경기·모임을 한눈에"],
  ["🌦", "경기 날씨", "경기 시간 날씨를 일정 상세에서 바로 확인"],
  ["🧢", "용병 추가", "외부 선수도 참석 명단에 넣어 스쿼드·기록에 포함"],
  ["💬", "댓글", "경기마다 댓글로 공지·잡담을 주고받기"],
  ["🎒", "비품 담당", "공가방·음료 등 경기별 담당자 지정"],
  ["👕", "상대팀 유니폼 추천", "상대 유니폼 색을 기억해 두었다가 다음에 자동 추천"],
  ["🔔", "미투표자 독려", "투표 안 한 사람에게 문자로 한 번에 재촉"],
  ["🗳", "설문 투표", "회식·장소 등 팀 설문을 만들고 푸시로 알리기"],
  ["📣", "게시판", "공지 · 코치 피드백 · 훈련 세션을 한 곳에 정리"],
  ["🏆", "명예의 전당", "지난 시즌 기록을 영구 보관하는 기록실"],
] as const;

const ADMIN = [
  "가입 신청을 운영진이 승인해야 팀원이 되는 승인제",
  "CSV로 선수 명단 일괄 등록, 번호·포지션 관리",
  "팀 이름·팀 로고 설정 (화면 상단과 브라우저 탭에 표시)",
  "벌금 설정과 미투표자 확인, 점수 배율 조정",
  "역대 기록·계정 관리, 비밀번호는 문자로 찾기",
];

export default function AboutPage() {
  return (
    <div className="space-y-5 pb-6">
      <Reveal>
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-6 text-white shadow-lg shadow-blue-900/20">
          <p className="text-xs font-bold tracking-wide text-blue-200">TEAM MANAGER</p>
          <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight">
            조기축구 팀 운영,
            <br />
            이제 앱 하나로 끝.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-blue-100">
            참석 투표부터 스쿼드 짜기, 골 기록, MVP 투표, 시즌 랭킹까지. 단톡방에 흩어져 있던 일을
            한 곳에서 처리하세요.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/login" className="pressable rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-900">
              로그인
            </Link>
            <Link href="/teams/new" className="pressable rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
              새 팀 만들기
            </Link>
          </div>
        </section>
      </Reveal>

      <Section
        tag="1 · 경기 전"
        title="일정 올리면 참석 투표까지 한 번에"
        lead="운영진이 경기를 등록하면 팀원 모두에게 푸시가 가고, 탭 한 번으로 참석·미정·불참을 정해요."
        points={[
          "참석 인원이 실시간으로 보이고, 투표 안 한 사람에게 독려 문자",
          "경기 날씨, 상대팀 유니폼 추천, 비품 담당까지 일정 상세에서 확인",
          "용병도 참석 명단에 바로 추가",
        ]}
        shots={[SHOTS.home]}
      />

      <Section
        tag="2 · 스쿼드"
        title="쿼터별 라인업을 자동으로 짜줘요"
        lead="‘스쿼드 만들기’를 누르면 참석자 기준으로 4쿼터 라인업이 먼저 채워져요. 사람마다 쿼터가 고르게 돌아가고, 마음에 안 들면 탭해서 바꾸면 됩니다."
        points={[
          "1순위 포지션 기준 자동 배치 · 한 사람 최대 3쿼터 · 휴식 쿼터 분배",
          "필드 보기와 출전표 보기, 빈자리 채우기, 내전(A/B팀) 모드",
          "운영진이 제출하면 3명이 승인하는 순간 확정, 참석자 전원에게 알림",
        ]}
        shots={[SHOTS.squad, SHOTS.squadTable]}
      />

      <Section
        tag="3 · 경기 중·후"
        title="골 기록은 탭 세 번, 저장은 자동"
        lead="득점자 → 어시스트 순서로 누르기만 하면 기록돼요. 여러 명이 동시에 입력해도 서로 덮어쓰지 않아요."
        points={[
          "쿼터별 득점·실점, 무실점 클린시트는 자동 계산",
          "경기가 끝나면 MVP 투표가 열리고, 다음 날 자정에 마감돼 결과를 알려줘요",
          "입력과 동시에 랭킹이 갱신돼요",
        ]}
        shots={[SHOTS.record, SHOTS.recordSheet, SHOTS.mvp]}
      />

      <Section
        tag="4 · 랭킹·기록"
        title="시즌 랭킹과 연속 골 🔥"
        lead="출전·골·어시스트·클린시트에 팀이 정한 점수 배율을 곱해 랭킹을 만들어요. 내전이나 훈련은 연속 기록을 끊지 않아요."
        points={[
          "전체 · 공격 · 미드필더 · 수비 포지션별 랭킹",
          "시즌별 보기와 명예의 전당, 과거 기록도 이어서 관리",
        ]}
        shots={[SHOTS.ranking]}
      />

      <Section
        tag="5 · 알림"
        title="필요한 순간에 알려줘요"
        lead="앱을 설치하지 않아도 되고, 홈 화면에 추가하면 푸시도 받을 수 있어요."
        points={[
          "새 경기·투표·스쿼드 확정·MVP 열림/발표 푸시",
          "정기 알림: 구장 예약 오픈 같은 월 반복 일정을 1시간 전에, 받을 사람을 골라서",
          "팀 일정을 내 캘린더(구글·애플)에 구독",
        ]}
      />

      <Reveal>
        <section className="card p-5">
          <p className="text-xs font-bold tracking-wide text-blue-700">6 · 그 밖의 기능</p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {MORE.map(([icon, name, desc]) => (
              <li key={name} className="flex gap-3 rounded-2xl bg-zinc-50 p-3">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="text-sm font-bold">{name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      <Section
        tag="7 · 팀 운영"
        title="여러 팀이 각자의 공간에서"
        lead="팀마다 데이터가 완전히 분리돼요. 로그인할 때 팀 엠블럼을 고르기만 하면 됩니다."
        points={ADMIN}
        shots={[SHOTS.login]}
      />

      <Reveal>
        <section className="card space-y-3 p-5">
          <p className="text-xs font-bold tracking-wide text-blue-700">시작하기</p>
          <ol className="space-y-3 text-sm">
            {[
              ["팀 만들기", "팀 이름·아이디를 정하면 내가 첫 운영진이 돼요."],
              ["팀원 초대", "팀원이 팀을 선택해 가입하고, 운영진이 승인해요. 명단은 CSV로 한 번에 등록할 수도 있어요."],
              ["경기 등록", "일정을 올리면 참석 투표 알림이 나가요. 그다음은 앱이 안내해요."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold">{t}</p>
                  <p className="mt-0.5 text-zinc-600">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/teams/new" className="pressable rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white">
              새 팀 만들기
            </Link>
            <Link href="/signup" className="pressable rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-800">
              팀원으로 가입
            </Link>
            <Link href="/login" className="pressable rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-800">
              로그인
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
