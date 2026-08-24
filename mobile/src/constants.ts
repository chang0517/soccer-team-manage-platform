import type { PosCategory, PosGroup } from "./api/types";

export const POS_GROUPS: PosGroup[] = ["GK", "CB", "WB", "DM", "AM", "WG", "ST"];

export const POS_LABELS: Record<PosGroup, string> = {
  GK: "골키퍼",
  CB: "센터백",
  WB: "윙백",
  DM: "수비형 미드필더",
  AM: "공격형 미드필더",
  WG: "윙어",
  ST: "스트라이커",
};

export const POS_CATEGORY: Record<PosGroup, PosCategory> = {
  GK: "DEF",
  CB: "DEF",
  WB: "DEF",
  DM: "MID",
  AM: "MID",
  WG: "ATT",
  ST: "ATT",
};

export const POS_CATEGORY_LABELS: Record<PosCategory, string> = {
  ATT: "공격",
  MID: "미드필더",
  DEF: "수비",
};
