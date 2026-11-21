import { describe, expect, it } from "vitest";
import { mergePhotoCandidates, preChecked, stopsQueue, type PhotoMatch } from "./repairPhotoParts";

const m = (code: string, confidence: PhotoMatch["confidence"], extra: Partial<PhotoMatch> = {}): PhotoMatch => ({
  diagram_id: "d1", title: "Fig.1", part_code: code, part_name: null, callout_no: null, confidence, reason: "", ...extra,
});

describe("수리 사진 부품 후보 합치기", () => {
  it("같은 부품번호가 여러 사진에 나오면 한 줄로 합치고 사진 번호를 모두 남긴다", () => {
    const out = mergePhotoCandidates([
      { photo: 1, matches: [m("129961-77200", "보통")] },
      { photo: 3, matches: [m("12996177200", "낮음")] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].photos).toEqual([1, 3]);
    expect(out[0].confidence).toBe("보통");
  });

  it("확신도가 높은 후보가 먼저 나온다", () => {
    const out = mergePhotoCandidates([{ photo: 1, matches: [m("A-1", "낮음"), m("B-2", "높음"), m("C-3", "보통")] }]);
    expect(out.map((c) => c.part_code)).toEqual(["B-2", "C-3", "A-1"]);
  });

  it("라벨 번호·확신도 높음·사진 2장 이상만 미리 체크한다", () => {
    const [label] = mergePhotoCandidates([{ photo: 1, matches: [m("L-1", "보통", { source: "label" })] }]);
    const [low] = mergePhotoCandidates([{ photo: 1, matches: [m("X-1", "낮음")] }]);
    const [twice] = mergePhotoCandidates([{ photo: 1, matches: [m("T-1", "낮음")] }, { photo: 2, matches: [m("T-1", "낮음")] }]);
    expect(preChecked(label)).toBe(true);
    expect(preChecked(low)).toBe(false);
    expect(preChecked(twice)).toBe(true);
  });

  it("크레딧 부족·권한 오류면 남은 사진 분석을 멈춘다", () => {
    expect(stopsQueue(402)).toBe(true);
    expect(stopsQueue(403)).toBe(true);
    expect(stopsQueue(500)).toBe(false);
    expect(stopsQueue(429)).toBe(false);
  });
});
