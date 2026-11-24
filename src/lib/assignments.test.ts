import { describe, expect, it } from "vitest";
import { isMine, newlyAssigned } from "./assignments";
import { splitNames } from "@/hooks/useTechnicians";

describe("담당자 칸", () => {
  it("쉼표·가운뎃점·슬래시로 여러 명", () => {
    expect(splitNames("김영일, 마성수")).toEqual(["김영일", "마성수"]);
    expect(splitNames("김영일·이재현/유호상")).toEqual(["김영일", "이재현", "유호상"]);
    expect(splitNames("")).toEqual([]);
  });
  it("새로 들어온 사람만 알린다", () => {
    expect(newlyAssigned("김영일, 마성수", "김영일")).toEqual(["마성수"]);
    expect(newlyAssigned("김영일", "김영일")).toEqual([]);
    expect(newlyAssigned("안정미", null)).toEqual(["안정미"]);
  });
  it("내 이름이 정확히 들어 있을 때만 내 것", () => {
    expect(isMine("김영일, 마성수", "마성수")).toBe(true);
    expect(isMine("김영일", "김영")).toBe(false);
    expect(isMine("김영일", null)).toBe(false);
  });
});
