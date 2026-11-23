import { describe, expect, it } from "vitest";
import { calloutHotspots, findNumberBoxes, keepAscending, OCR_AUTO_NOTE } from "./calloutOcr";

/** 흰 바탕에 검은 직사각형들을 그린 그림 */
function image(W: number, H: number, rects: [number, number, number, number][]) {
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (const [x, y, w, h] of rects) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const k = (yy * W + xx) * 4;
      data[k] = data[k + 1] = data[k + 2] = 0;
    }
  }
  return { data, width: W, height: H };
}

describe("findNumberBoxes", () => {
  it("숫자 크기 덩어리를 가로로 묶고, 긴 선이나 큰 그림은 뺀다", () => {
    const img = image(400, 200, [
      [20, 20, 8, 18], [32, 20, 8, 18], // 「12」 두 글자
      [100, 100, 9, 18],                // 「5」 한 글자
      [150, 30, 200, 2],                // 긴 선
      [200, 80, 80, 80],                // 큰 그림
    ]);
    const boxes = findNumberBoxes(img, { x0: 0, y0: 0, x1: 400, y1: 200 }, 18);
    expect(boxes.map(({ x, y, w, h }) => [x, y, w, h])).toEqual([[20, 20, 20, 18], [100, 100, 9, 18]]);
  });

  it("투명한 바탕은 흰색으로 본다", () => {
    const img = image(60, 60, [[20, 20, 8, 18]]);
    for (let k = 3; k < img.data.length; k += 4) if (img.data[k - 1] === 255) img.data[k] = 0;
    for (let k = 0; k < img.data.length; k += 4) if (img.data[k + 3] === 0) img.data[k] = img.data[k + 1] = img.data[k + 2] = 0;
    expect(findNumberBoxes(img, { x0: 0, y0: 0, x1: 60, y1: 60 }, 18)).toHaveLength(1);
  });

  it("왼쪽에 글자가 붙어 있으면(「Fig 5」) 표시해 둔다", () => {
    const img = image(200, 60, [[20, 20, 8, 18], [32, 20, 4, 18], [40, 26, 8, 12], [70, 20, 9, 18]]);
    const boxes = findNumberBoxes(img, { x0: 0, y0: 0, x1: 200, y1: 60 }, 18);
    expect(boxes.find((b) => b.x === 70)?.leftText).toBe(true);
  });
});

describe("keepAscending", () => {
  const row = (y: number, no: string, x = 500) => ({ row: { x, y, w: 40, h: 10 }, no });
  it("부품표 순서에 안 맞는 번호(잘못 읽은 줄)는 버린다", () => {
    const kept = keepAscending([row(10, "1"), row(20, "2"), row(30, "71"), row(40, "3"), row(50, "3-1"), row(60, "4")]);
    expect(kept.map((k) => k.no)).toEqual(["1", "2", "3", "3-1", "4"]);
  });
  it("칸이 둘이면 칸마다 따로 본다", () => {
    const kept = keepAscending([row(10, "1"), row(20, "2"), row(10, "20", 900), row(20, "21", 900)]);
    expect(kept.map((k) => k.no).sort()).toEqual(["1", "2", "20", "21"]);
  });
});

describe("calloutHotspots", () => {
  const refs = new Map([["5", "1J5247-21200"], ["9", "1J5247-22100"]]);
  it("부품표에 있는 번호만 동그란 영역으로, ocr-auto 표시를 단다", () => {
    const spots = calloutHotspots([{ no: "5", x: 100, y: 100, w: 10, h: 18 }, { no: "77", x: 10, y: 10, w: 10, h: 18 }], refs, 1000, 500);
    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({ part_code: "1J5247-21200", callout_no: "5", notes: OCR_AUTO_NOTE });
    expect(spots[0].w).toBeGreaterThan(0);
  });
  it("같은 자리에 같은 번호가 이미 있으면 다시 만들지 않는다", () => {
    const existing = [{ callout_no: "9", x: 9.5, y: 19, w: 3, h: 6 }];
    expect(calloutHotspots([{ no: "9", x: 100, y: 100, w: 10, h: 18 }], refs, 1000, 500, existing)).toHaveLength(0);
  });
});
