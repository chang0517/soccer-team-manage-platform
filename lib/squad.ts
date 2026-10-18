import type { Member, PosGroup, QuarterSquad, SquadData } from "./types";
import { POS_SHORT } from "./types";

export const QUARTER_COUNT = 4;

// 깃헙 PR 승인처럼, 운영진이 이 인원수 이상 승인해야 스쿼드가 확정(잠금)된다.
export const SQUAD_APPROVAL_THRESHOLD = 3;

// 스쿼드가 확정(잠금) 상태인지 판단한다. 예전 방식(confirmed 플래그를 운영진
// 1명이 직접 켬)으로 이미 확정된 과거 데이터는 그대로 확정 상태로 인정하고,
// 그 외에는 approvedBy에 쌓인 운영진 승인 수로 판단한다.
export function isSquadConfirmed(squad: SquadData | null | undefined): boolean {
  if (!squad) return false;
  if (squad.confirmed) return true;
  return (squad.approvedBy?.length ?? 0) >= SQUAD_APPROVAL_THRESHOLD;
}

export type SlotCategory = "GK" | "DF" | "MF" | "FW";

export interface SlotDef {
  id: string;
  accepts: PosGroup[];
  label: string;
  category: SlotCategory;
  x: number;
  y: number;
}

// 4-1-2-2-1: GK 1 / CB·WB 4 / DM 1 / (DM·AM) 2 / (WG·AM) 2 / ST 1
// 수미 한 명이 뒤에서 지키고 그 앞 두 명의 CM이 박스투박스, 좌우 두 명은
// 공미·윙어 겸업으로 폭과 침투를 담당, 최전방엔 스트라이커 한 명만 둔다.
export const FORMATION_SLOTS: SlotDef[] = [
  { id: "GK", accepts: ["GK"], label: "GK", category: "GK", x: 50, y: 91 },
  { id: "LB", accepts: ["WB"], label: "LB", category: "DF", x: 13, y: 72 },
  { id: "LCB", accepts: ["CB"], label: "CB", category: "DF", x: 37, y: 77 },
  { id: "RCB", accepts: ["CB"], label: "CB", category: "DF", x: 63, y: 77 },
  { id: "RB", accepts: ["WB"], label: "RB", category: "DF", x: 87, y: 72 },
  { id: "DM", accepts: ["DM"], label: "DM", category: "MF", x: 50, y: 60 },
  { id: "LCM", accepts: ["DM", "AM"], label: "CM", category: "MF", x: 30, y: 46 },
  { id: "RCM", accepts: ["DM", "AM"], label: "CM", category: "MF", x: 70, y: 46 },
  { id: "LW", accepts: ["WG", "AM"], label: "LW", category: "FW", x: 16, y: 26 },
  { id: "RW", accepts: ["WG", "AM"], label: "RW", category: "FW", x: 84, y: 26 },
  { id: "ST", accepts: ["ST"], label: "ST", category: "FW", x: 50, y: 13 },
];

export const SLOT_CATEGORY_COLORS: Record<
  SlotCategory,
  { bg: string; text: string }
> = {
  GK: { bg: "bg-amber-400", text: "text-amber-950" },
  DF: { bg: "bg-sky-400", text: "text-sky-950" },
  MF: { bg: "bg-violet-300", text: "text-violet-950" },
  FW: { bg: "bg-rose-400", text: "text-rose-950" },
};

export function slotAccepts(slotId: string): PosGroup[] {
  return FORMATION_SLOTS.find((s) => s.id === slotId)?.accepts ?? [];
}

/**
 * 슬롯 표시용 라벨. 받는 포지션이 하나뿐이고 그게 슬롯 라벨과 같으면
 * ("GK · GK", "CB · CB" 같은 중복) 라벨 하나만 보여준다.
 */
export function slotDisplayLabel(slot: SlotDef): string {
  if (slot.accepts.length === 1 && POS_SHORT[slot.accepts[0]] === slot.label) {
    return slot.label;
  }
  return `${slot.label} · ${slot.accepts.map((g) => POS_SHORT[g]).join("/")}`;
}

/**
 * 슬롯에 배정된 선수의 실제 선호 포지션을 반환한다 (1순위가 슬롯과 맞으면 1순위,
 * 아니면 2순위, 그것도 아니면 슬롯이 받는 포지션 중 첫 번째).
 */
export function slotPositionFor(slotId: string, member: Member): PosGroup | "" {
  const accepts = slotAccepts(slotId);
  if (accepts.includes(member.pos1)) return member.pos1;
  if (accepts.includes(member.pos2)) return member.pos2;
  return accepts[0] ?? "";
}

/**
 * 클린시트 판정용 "최종 확정 포지션". 선수의 선호 포지션과 무관하게, 그 쿼터에
 * 실제로 배정된 슬롯 자체가 무엇인지로만 판단한다 — LCM·RCM은 DM·AM을 겸업으로
 * 받는 슬롯이라 선수의 1순위가 DM(수미)이어도, 그 쿼터의 확정 포지션은 항상
 * CM이라 클린시트 대상(GK·CB·WB·DM)에 들지 않는다. 오직 슬롯 id가 "DM"인
 * 경우에만 수미로 인정한다.
 */
export function slotFinalPosition(slotId: string): PosGroup | "" {
  if (slotId === "GK") return "GK";
  if (slotId === "LB" || slotId === "RB") return "WB";
  if (slotId === "LCB" || slotId === "RCB") return "CB";
  if (slotId === "DM") return "DM";
  return "";
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 포지션(PosGroup)이 속한 슬롯 카테고리(수비/미드필더/공격/GK). */
export function categoryOf(pos: PosGroup): SlotCategory {
  if (pos === "GK") return "GK";
  if (pos === "CB" || pos === "WB") return "DF";
  if (pos === "DM" || pos === "AM") return "MF";
  return "FW"; // WG, ST
}

// 자동 배치에서 한 사람이 뛰는 최대 쿼터 수. 인원이 모자라도 이 이상은
// 넣지 않고, 남는 자리는 빈칸으로 둔다(운영진이 직접 채우거나 "빈 자리
// 자동 채우기"로 2순위 포지션 선수를 넣는다).
export const MAX_AUTO_QUARTERS = 3;

const LINES: SlotCategory[] = ["GK", "DF", "MF", "FW"];

function subsets(k: number): number[][] {
  const out: number[][] = [];
  const walk = (from: number, cur: number[]) => {
    if (cur.length === k) {
      out.push(cur);
      return;
    }
    for (let q = from; q < QUARTER_COUNT; q++) walk(q + 1, [...cur, q]);
  };
  walk(0, []);
  return out;
}

// 체력 안배: 두 쿼터는 1·3 / 2·4처럼 한 쿼터 쉬고 뛰게(1·4가 차선, 연속
// 두 쿼터는 최후). 세 쿼터는 중간에 한 번 쉬는 쪽(1·2·4, 1·3·4)을 살짝만
// 선호한다 — 빈자리가 한 쿼터에 몰리는 것보다는 덜 중요해서. 작을수록 좋다.
function restPenalty(qs: number[]): number {
  if (qs.length === 2) {
    const gap = qs[1] - qs[0];
    return gap === 2 ? 0 : gap === 3 ? 10 : 40;
  }
  if (qs.length === 3) return qs[2] - qs[0] === 2 ? 3 : 0;
  return 0;
}

// 1순위 포지션마다 "자기 자리"로 보는 슬롯. 쿼터 수는 먼저 이 자리 수를
// 기준으로 같은 포지션끼리 나누고, 남는 자리만 같은 라인 선수가 메운다.
const OWN_SLOTS: Record<PosGroup, string[]> = {
  GK: ["GK"],
  CB: ["LCB", "RCB"],
  WB: ["LB", "RB"],
  DM: ["DM"],
  AM: ["LCM", "RCM"],
  WG: ["LW", "RW"],
  ST: ["ST"],
};

function evenSplit(players: Member[], units: number, counts: Map<number, number>) {
  if (players.length === 0) return;
  const base = Math.floor(units / players.length);
  const extra = units % players.length;
  shuffle(players).forEach((m, i) => {
    counts.set(m.id, Math.min(MAX_AUTO_QUARTERS, base + (i < extra ? 1 : 0)));
  });
}

/**
 * 한 라인(GK·수비·미드필더·공격) 안에서 각자 몇 쿼터를 뛸지 정한다.
 * 1) 1순위 포지션별로 자기 자리 수 × 4쿼터를 그 포지션 인원에게 최대한
 *    고르게 나눈다(인당 최대 MAX_AUTO_QUARTERS).
 * 2) 그래도 남는 그 라인 자리(예: 윙어가 없어 비는 측면)는 같은 라인에서
 *    덜 뛴 사람부터 한 쿼터씩 더 준다 — 역시 최대 MAX_AUTO_QUARTERS까지.
 *    다 차도 남으면 빈칸으로 둔다.
 */
function lineQuarterCounts(players: Member[], lineSlots: number): Map<number, number> {
  const counts = new Map<number, number>();
  for (const pos of Object.keys(OWN_SLOTS) as PosGroup[]) {
    evenSplit(
      players.filter((m) => m.pos1 === pos),
      OWN_SLOTS[pos].length * QUARTER_COUNT,
      counts
    );
  }
  let spare = lineSlots * QUARTER_COUNT - [...counts.values()].reduce((a, b) => a + b, 0);
  while (spare > 0) {
    const open = shuffle(players.filter((m) => (counts.get(m.id) ?? 0) < MAX_AUTO_QUARTERS));
    if (open.length === 0) break;
    const pick = open.sort((x, y) => (counts.get(x.id) ?? 0) - (counts.get(y.id) ?? 0))[0];
    counts.set(pick.id, (counts.get(pick.id) ?? 0) + 1);
    spare--;
  }
  return counts;
}

/**
 * 정해진 쿼터 수대로 각자 어느 쿼터에 뛸지 고른다. 쿼터마다 그 라인 자리
 * 수를 넘지 않게 하면서 (1) 빈자리가 생기면 한 쿼터에 몰리지 않게 — 앞서
 * 배치한 다른 라인의 빈자리(holes)까지 합쳐서 쿼터마다 고르게 퍼뜨리고
 * (2) 체력 안배 패턴을 최대한 지키고 (3) 같은 쿼터에 한 포지션이 자기 자리
 * 수보다 많이 몰려 다른 자리로 밀려나는 일을 줄인다. 인원이 적어 경우의
 * 수가 작으니 가지치기 탐색으로 가장 좋은 배치를 찾는다.
 */
function scheduleLine(
  players: Member[],
  counts: Map<number, number>,
  cap: number,
  holes: number[]
): Map<number, number[]> {
  const order = shuffle(players.filter((m) => (counts.get(m.id) ?? 0) > 0)).sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
  );
  const options = order.map((m) =>
    shuffle(subsets(counts.get(m.id)!)).sort((a, b) => restPenalty(a) - restPenalty(b))
  );
  const loads = new Array(QUARTER_COUNT).fill(0);
  const posLoads = new Map<PosGroup, number[]>();
  const pick: number[][] = [];
  let best: { score: number; plan: number[][] } | null = null;
  let nodes = 0;

  const dfs = (i: number, penalty: number) => {
    if (++nodes > 30000) return;
    if (best && penalty >= best.score) return;
    if (i === order.length) {
      const spread = loads.reduce((sum, l, q) => sum + (holes[q] + cap - l) ** 2, 0);
      const score = penalty + spread * 10;
      if (!best || score < best.score) best = { score, plan: pick.map((p) => p.slice()) };
      return;
    }
    const pos = order[i].pos1;
    const own = OWN_SLOTS[pos].length;
    if (!posLoads.has(pos)) posLoads.set(pos, new Array(QUARTER_COUNT).fill(0));
    const pl = posLoads.get(pos)!;
    for (const qs of options[i]) {
      if (qs.some((q) => loads[q] >= cap)) continue;
      // 자기 자리가 이미 다 찬 쿼터에 들어가면 다른 자리로 밀려나니 감점
      const displaced = qs.filter((q) => pl[q] >= own).length;
      qs.forEach((q) => {
        loads[q]++;
        pl[q]++;
      });
      pick[i] = qs;
      dfs(i + 1, penalty + restPenalty(qs) + displaced * 15);
      qs.forEach((q) => {
        loads[q]--;
        pl[q]--;
      });
    }
  };
  dfs(0, 0);

  const plan = new Map<number, number[]>();
  const found = best as { score: number; plan: number[][] } | null;
  order.forEach((m, i) => plan.set(m.id, found?.plan[i] ?? []));
  return plan;
}

/**
 * 한 쿼터·한 라인에서 뛸 선수들을 그 라인의 자리에 앉힌다. 1순위 포지션에
 * 맞는 자리 → 2순위 → 같은 라인 순으로, 앞 쿼터와 같은 자리면 조금 더
 * 우선한다(쿼터마다 좌우가 바뀌지 않게). 자리가 남으면 빈칸으로 둔다.
 */
function seatLine(
  slots: SlotDef[],
  players: Member[],
  prevSlot: Map<number, string>
): Map<string, number> {
  let best: { cost: number; seats: Map<string, number> } | null = null;
  const used = new Set<string>();
  const seats = new Map<string, number>();
  const walk = (i: number, cost: number) => {
    if (best && cost >= best.cost) return;
    if (i === players.length) {
      best = { cost, seats: new Map(seats) };
      return;
    }
    const m = players[i];
    for (const slot of slots) {
      if (used.has(slot.id)) continue;
      used.add(slot.id);
      seats.set(slot.id, m.id);
      const moved = prevSlot.has(m.id) && prevSlot.get(m.id) !== slot.id ? 1 : 0;
      walk(i + 1, cost + slotFit(slot.id, m) * 10 + moved);
      used.delete(slot.id);
      seats.delete(slot.id);
    }
  };
  walk(0, 0);
  return (best as { cost: number; seats: Map<string, number> } | null)?.seats ?? new Map();
}

/**
 * 참석자로 1~4쿼터 스쿼드를 자동 배치한다.
 * - 1순위 포지션별로 인당 뛰는 쿼터 수를 최대한 고르게 나누고, 남는
 *   자리는 같은 라인(GK·수비·미드필더·공격)에서 덜 뛴 사람이 메운다.
 * - 두 쿼터를 뛰면 1·3 / 2·4쿼터처럼 쉬어가며 뛰게 한다.
 * - 한 사람당 최대 3쿼터 — 그 라인 인원이 모자라면 남는 자리는 빈칸.
 * - 다른 라인 선수로 빈자리를 메우지 않는다(수비수가 공격 자리에 가는 일 없음).
 */
export function generateSquad(attendees: Member[]): SquadData {
  const playQuarters = new Map<number, number[]>();
  // 쿼터별로 지금까지 생긴 빈자리 수 — 자리가 많은 라인부터 배치하면서
  // 다음 라인은 빈자리가 적은 쿼터 쪽에 자기 빈자리를 두게 한다.
  const holes = new Array(QUARTER_COUNT).fill(0);
  for (const line of ["DF", "MF", "FW", "GK"] as SlotCategory[]) {
    const players = attendees.filter((m) => categoryOf(m.pos1) === line);
    const cap = FORMATION_SLOTS.filter((s) => s.category === line).length;
    const plan = scheduleLine(players, lineQuarterCounts(players, cap), cap, holes);
    const loads = new Array(QUARTER_COUNT).fill(0);
    for (const [id, qs] of plan) {
      playQuarters.set(id, qs);
      qs.forEach((q) => loads[q]++);
    }
    loads.forEach((l, q) => (holes[q] += cap - l));
  }

  const prevSlot = new Map<number, string>();
  const quarters: QuarterSquad[] = [];
  for (let q = 0; q < QUARTER_COUNT; q++) {
    const seat = new Map<string, number>();
    for (const line of LINES) {
      const slots = FORMATION_SLOTS.filter((s) => s.category === line);
      const players = attendees.filter(
        (m) => categoryOf(m.pos1) === line && playQuarters.get(m.id)?.includes(q)
      );
      for (const [slotId, id] of seatLine(slots, players, prevSlot)) {
        seat.set(slotId, id);
        prevSlot.set(id, slotId);
      }
    }
    const on = new Set(seat.values());
    quarters.push({
      starters: FORMATION_SLOTS.map((s) => ({ slotId: s.id, memberId: seat.get(s.id) ?? null })),
      bench: attendees.filter((m) => !on.has(m.id)).map((m) => m.id),
    });
  }
  return { quarters, generatedAt: new Date().toISOString() };
}

/**
 * 내전(자체 훈련용 2팀 스크리미지)을 위해 참석자를 포지션 균형을 맞춰 두
 * 팀으로 나눈다. 카테고리(수비/미드필더/공격)별로 따로 섞어서 절반씩 두
 * 팀에 번갈아 배정하므로, 인원이 맞으면 양 팀이 비슷한 포지션 구성을 갖는다.
 */
export function splitScrimmageTeams(attendees: Member[]): {
  teamA: Member[];
  teamB: Member[];
} {
  const byCategory = new Map<SlotCategory, Member[]>();
  for (const m of attendees) {
    const cat = categoryOf(m.pos1);
    const list = byCategory.get(cat) ?? [];
    list.push(m);
    byCategory.set(cat, list);
  }

  const teamA: Member[] = [];
  const teamB: Member[] = [];
  for (const list of byCategory.values()) {
    shuffle(list).forEach((m, i) => (i % 2 === 0 ? teamA : teamB).push(m));
  }

  // 카테고리마다는 균형이 맞아도, 홀수 인원 카테고리가 여러 개 겹치면 그
  // 나머지 한 명이 매번 A팀 쪽으로 쌓여서 전체 인원수가 크게 벌어질 수
  // 있다 — 두 팀 인원 차이가 1명을 넘지 않을 때까지 큰 팀에서 작은 팀으로
  // 옮긴다.
  while (teamA.length - teamB.length > 1) teamB.push(teamA.pop()!);
  while (teamB.length - teamA.length > 1) teamA.push(teamB.pop()!);

  return { teamA, teamB };
}

// ---------- 제출 → 승인 → 확정 ----------

export type SquadStatus = "draft" | "submitted" | "confirmed";

export function squadStatus(squad: SquadData | null | undefined): SquadStatus {
  if (!squad) return "draft";
  if (isSquadConfirmed(squad)) return "confirmed";
  return squad.submittedAt ? "submitted" : "draft";
}

// 라인업이 바뀐 스쿼드는 처음부터 다시 제출·승인받아야 한다.
export function asDraft(squad: SquadData): SquadData {
  return {
    ...squad,
    confirmed: false,
    approvedBy: [],
    submittedAt: null,
    submittedBy: null,
    confirmedAt: null,
  };
}

export type SquadAction = "submit" | "withdraw" | "approve" | "unapprove" | "unlock";

export class SquadActionError extends Error {}

/**
 * 스쿼드 상태 전환. memberId는 버튼을 누른 운영진. 규칙에 안 맞으면
 * SquadActionError(사용자에게 보여줄 문구)를 던진다.
 */
export function applySquadAction(
  squad: SquadData,
  action: SquadAction,
  memberId: number
): SquadData {
  const status = squadStatus(squad);
  const approvedBy = squad.approvedBy ?? [];
  switch (action) {
    case "submit":
      if (status !== "draft") throw new SquadActionError("이미 제출된 스쿼드예요.");
      return {
        ...asDraft(squad),
        submittedAt: new Date().toISOString(),
        submittedBy: memberId,
      };
    case "withdraw":
      if (status !== "submitted") throw new SquadActionError("승인 대기 중인 스쿼드가 아니에요.");
      return asDraft(squad);
    case "approve": {
      if (status === "draft") throw new SquadActionError("먼저 스쿼드를 제출해 주세요.");
      if (status === "confirmed") throw new SquadActionError("이미 확정된 스쿼드예요.");
      if (approvedBy.includes(memberId)) return squad;
      const next = { ...squad, approvedBy: [...approvedBy, memberId] };
      return isSquadConfirmed(next) ? { ...next, confirmedAt: new Date().toISOString() } : next;
    }
    case "unapprove":
      if (status !== "submitted") throw new SquadActionError("승인 대기 중일 때만 승인을 취소할 수 있어요.");
      return { ...squad, approvedBy: approvedBy.filter((m) => m !== memberId) };
    case "unlock":
      if (status !== "confirmed") throw new SquadActionError("확정된 스쿼드가 아니에요.");
      return asDraft(squad);
  }
}

/** 선수가 그 슬롯에 얼마나 맞는지: 0 1순위, 1 2순위, 2 같은 라인, 3 다른 라인. */
export function slotFit(slotId: string, member: Member): number {
  const slot = FORMATION_SLOTS.find((s) => s.id === slotId);
  if (!slot) return 3;
  if (slot.accepts.includes(member.pos1)) return 0;
  if (slot.accepts.includes(member.pos2)) return 1;
  if (categoryOf(member.pos1) === slot.category || categoryOf(member.pos2) === slot.category) {
    return 2;
  }
  return 3;
}

/** 4쿼터 동안 선수별 출전 쿼터 수(하프 분할은 0.5). */
export function squadPlayCounts(squad: SquadData): Map<number, number> {
  const counts = new Map<number, number>();
  for (const q of squad.quarters) {
    for (const s of q.starters) {
      const w = s.memberId2 !== undefined ? 0.5 : 1;
      for (const mid of [s.memberId, s.memberId2]) {
        if (mid != null) counts.set(mid, (counts.get(mid) ?? 0) + w);
      }
    }
  }
  return counts;
}

/** 쿼터별 내 자리 — ["CB", "휴식", "LB 전반", "CB"] 같은 목록. */
export function memberQuarterRoles(squad: SquadData, memberId: number): string[] {
  return squad.quarters.map((q) => {
    for (const s of q.starters) {
      const label = FORMATION_SLOTS.find((d) => d.id === s.slotId)?.label ?? s.slotId;
      if (s.memberId === memberId) return s.memberId2 !== undefined ? `${label} 전반` : label;
      if (s.memberId2 === memberId) return `${label} 후반`;
    }
    return "휴식";
  });
}

/**
 * 비어 있는 자리만 채운다(직접 손본 자리는 그대로). 그 쿼터 벤치에서 자리에
 * 잘 맞는 포지션 → 지금까지 덜 뛴 선수 순으로 고르고, 다른 라인(수비↔공격)
 * 선수는 넣지 않는다.
 */
export function fillEmptySlots(
  squad: SquadData,
  roster: Member[]
): { squad: SquadData; filled: number } {
  const counts = squadPlayCounts(squad);
  const byId = new Map(roster.map((m) => [m.id, m]));
  let filled = 0;
  const quarters = squad.quarters.map((q) => {
    const starters = q.starters.map((s) => ({ ...s }));
    const used = new Set(
      starters.flatMap((s) => [s.memberId, s.memberId2]).filter((v): v is number => v != null)
    );
    for (const s of starters) {
      if (s.memberId != null || s.memberId2 !== undefined) continue;
      const pick = roster
        .filter((m) => !used.has(m.id) && slotFit(s.slotId, m) <= 2)
        .sort(
          (a, b) =>
            slotFit(s.slotId, a) - slotFit(s.slotId, b) ||
            (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) ||
            a.name.localeCompare(b.name, "ko")
        )[0];
      if (!pick) continue;
      s.memberId = pick.id;
      used.add(pick.id);
      counts.set(pick.id, (counts.get(pick.id) ?? 0) + 1);
      filled++;
    }
    return { starters, bench: [...byId.keys()].filter((id) => !used.has(id)) };
  });
  return { squad: { ...squad, quarters }, filled };
}
