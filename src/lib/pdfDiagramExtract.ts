/**
 * PDF 부품표 페이지 → 누를 수 있는 영역.
 * 글자 위치는 화면(회전 반영) 좌표로 받는다: 얀마 책처럼 90° 돌려 놓은 쪽도 제자리에 상자가 생긴다.
 */
export type PageText = { str: string; x: number; y: number; w: number; h: number }; // x,y = 글자 왼쪽 위(화면 좌표)

export type ExtractedHotspot = {
  part_code: string;
  part_name: string | null;
  callout_no: string | null;
  x: number; y: number; w: number; h: number; // %
};

/** 얀마 부품번호: 1A8060-00600, 129107-44590, 26106-060162 (+ -YNK 등 접미사) */
export const YANMAR_CODE_RE = /^[0-9A-Z]{5,6}-[0-9A-Z]{5,6}(-[0-9A-Z]{1,3})?$/;
/** 타사 부품번호(구보다 1G311-81110, LS 40250012, 대동 T4655-41111 등): 숫자가 섞인 6자 이상 */
export const LOOSE_CODE_RE = /^(?=.*\d)[0-9A-Z][0-9A-Z.\-]{5,19}$/;
const HEADER_RE = /^(부품번호|품번|부품\s*번호|PART\s*NO\.?|PART\s*NUMBER|P\/NO\.?)$/i;
const NO_HEADER_RE = /^(번호|NO\.?|REF\.?|순번|KEY)$/i;
const CALLOUT_RE = /^\d{1,3}(-\d{1,2})?$/;

const pct = (v: number, total: number) => Math.round((v / total) * 10000) / 100;
const sameRow = (a: PageText, b: PageText) => Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < Math.max(2.5, Math.min(a.h, b.h) * 0.6);

export function extractPageHotspots(items: PageText[], vw: number, vh: number, opts: { loose?: boolean } = {}): ExtractedHotspot[] {
  return extractPageTable(items, vw, vh, opts).hotspots;
}

export type PageTable = {
  hotspots: ExtractedHotspot[];
  /** 부품표 「번호」 → 부품번호 (같은 번호가 여러 줄이면 첫 줄) */
  refs: Map<string, string>;
  /** 부품표 왼쪽 끝(화면 좌표). 그림은 이보다 왼쪽에 있다 */
  tableLeft: number;
  /** 부품번호 글자 높이(화면 좌표) — 그림 번호 크기 짐작용 */
  textHeight: number;
  /** 그림에 글자로 박힌 번호가 있었는지 (없으면 그림 번호가 선으로 그려진 책) */
  textCallouts: number;
};

export function extractPageTable(items: PageText[], vw: number, vh: number, opts: { loose?: boolean } = {}): PageTable {
  const clean = items.map((i) => ({ ...i, str: i.str.trim() })).filter((i) => i.str);
  const header = clean.find((i) => HEADER_RE.test(i.str));
  const noHeader = header ? clean.filter((i) => NO_HEADER_RE.test(i.str) && sameRow(i, header) && i.x < header.x).sort((a, b) => b.x - a.x)[0] : undefined;

  const isCode = (i: PageText) => {
    const s = i.str.toUpperCase();
    if (YANMAR_CODE_RE.test(s)) return true;
    if (!opts.loose || !header || !LOOSE_CODE_RE.test(s)) return false;
    // 타사 형식은 「부품번호」 머리글 아래 같은 칸에 있는 것만 (가격·수량 오인 방지)
    return i.y > header.y && i.x > header.x - header.w * 1.5 && i.x < header.x + header.w * 2.5;
  };
  const codes = clean.filter(isCode);
  if (codes.length === 0) return { hotspots: [], refs: new Map(), tableLeft: vw, textHeight: 0, textCallouts: 0 };
  // 표 밖(그림 아래 문서번호 등)에 번호 형식 글자가 있어도 표 왼쪽 끝이 끌려가지 않게, 부품번호 칸에 모인 것만 본다
  const xs = codes.map((c) => c.x).sort((a, b) => a - b);
  const medX = xs[xs.length >> 1];
  const colXs = xs.filter((x) => Math.abs(x - medX) < vw * 0.08);
  const tableLeft = Math.min(...colXs, header?.x ?? Infinity, noHeader?.x ?? Infinity) - 4;

  const pad = 0.3;
  const out: ExtractedHotspot[] = [];
  const rowNo = new Map<string, string>(); // 번호 → 부품번호
  for (const c of codes) {
    const right = clean
      .filter((o) => o !== c && sameRow(o, c) && o.x >= c.x + c.w - 1 && !isCode(o) && !/^[\d.,]+$/.test(o.str))
      .sort((a, b) => a.x - b.x)[0];
    const left = clean
      .filter((o) => o !== c && sameRow(o, c) && o.x + o.w <= c.x + 1 && CALLOUT_RE.test(o.str) && (!noHeader || Math.abs(o.x + o.w / 2 - (noHeader.x + noHeader.w / 2)) < Math.max(12, noHeader.w * 1.5)))
      .sort((a, b) => a.x - b.x)[0];
    if (left && !rowNo.has(left.str)) rowNo.set(left.str, c.str.toUpperCase());
    out.push({
      part_code: c.str.toUpperCase(),
      part_name: right?.str || null,
      callout_no: null,
      x: Math.max(0, pct(c.x, vw) - pad),
      y: Math.max(0, pct(c.y, vh) - pad),
      w: Math.min(100, pct(c.w, vw) + pad * 2),
      h: Math.min(100, pct(c.h, vh) + pad * 2),
    });
  }

  // 그림 쪽(부품표 왼쪽)에 글자로 박힌 번호가 있으면 그 번호도 눌러지게 한다
  let textCallouts = 0;
  if (rowNo.size > 0) {
    for (const i of clean) {
      if (i.x + i.w >= tableLeft || !CALLOUT_RE.test(i.str)) continue;
      const code = rowNo.get(i.str);
      if (!code) continue;
      const cx = i.x + i.w / 2, cy = i.y + i.h / 2, r = Math.max(i.w, i.h) / 2 + 2;
      out.push({
        part_code: code,
        part_name: null,
        callout_no: i.str,
        x: Math.max(0, pct(cx - r, vw)),
        y: Math.max(0, pct(cy - r, vh)),
        w: pct(r * 2, vw),
        h: pct(r * 2, vh),
      });
      textCallouts++;
    }
  }
  const heights = codes.map((c) => c.h).sort((a, b) => a - b);
  return { hotspots: out, refs: rowNo, tableLeft, textHeight: heights[heights.length >> 1], textCallouts };
}

export type PdfPageReport = { page: number; textCount: number; yanmarCodes: number; looseCodes: number };

/** 왜 안 읽히는지 사람 말로: 스캔본 / 부품번호 형식 다름 / 정상 */
export function diagnosePdf(pages: PdfPageReport[]): { kind: "scan" | "format" | "ok" | "partial"; message: string } {
  const total = pages.length;
  const noText = pages.filter((p) => p.textCount < 5).length;
  const yanmar = pages.filter((p) => p.yanmarCodes >= 2).length;
  const loose = pages.filter((p) => p.yanmarCodes < 2 && p.looseCodes >= 2).length;
  if (total === 0) return { kind: "scan", message: "페이지가 없습니다." };
  if (noText >= total * 0.8) {
    return { kind: "scan", message: `${total}쪽 중 ${noText}쪽이 글자 없는 스캔본(사진)이라 부품번호를 읽을 수 없습니다. 그림으로만 등록되고, 번호는 「영역 편집」으로 직접 지정해야 합니다.` };
  }
  if (yanmar === 0 && loose > 0) {
    return { kind: "format", message: `얀마 번호 형식은 없지만 다른 회사 형식 부품번호가 ${loose}쪽에서 보입니다. 「타사 번호 형식도 읽기」로 등록합니다.` };
  }
  if (yanmar === 0) {
    return { kind: "format", message: "글자는 있지만 「부품번호」 머리글이나 번호 형식을 찾지 못했습니다. 그림으로만 등록하고 번호는 직접 지정해 주세요." };
  }
  if (noText > 0) return { kind: "partial", message: `부품표 ${yanmar + loose}쪽을 읽고, 글자 없는 ${noText}쪽은 그림으로만 등록합니다.` };
  return { kind: "ok", message: `부품표 ${yanmar + loose}쪽에서 부품번호를 읽습니다.` };
}
