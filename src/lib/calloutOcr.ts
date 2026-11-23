/**
 * 도면 그림 속 번호(콜아웃) 찾기.
 * PDF에서 그림 번호가 글자가 아니라 선으로 그려진 책은 글자 층으로 읽을 수 없어서,
 * 숫자 크기의 검은 덩어리를 찾아 한 칸씩 잘라 OCR(tesseract, 숫자만)로 읽고
 * 그 쪽 부품표에 있는 번호와 맞는 것만 남긴다. 표에 없는 숫자는 버리므로 엉뚱한 부품으로 가지 않는다.
 * 만든 영역은 notes='ocr-auto' 로 표시해 한 번에 검토·되돌리기 할 수 있다.
 */

export const OCR_AUTO_NOTE = "ocr-auto";
const CALLOUT_RE = /^\d{1,3}(-\d{1,2})?$/;

export type Gray = { data: Uint8ClampedArray; width: number; height: number };
export type Box = { x: number; y: number; w: number; h: number; leftText?: boolean }; // 픽셀
export type Region = { x0: number; y0: number; x1: number; y1: number }; // 픽셀, 끝 미포함
export type FoundCallout = Box & { no: string };

/** RGBA → 어두운 점(1)/밝은 점(0) */
function darkMask(img: Gray, threshold = 140): Uint8Array {
  const { data, width, height } = img;
  const out = new Uint8Array(width * height);
  for (let k = 0, q = 0; q < out.length; k += 4, q++) {
    // 투명한 점은 바탕(흰색)으로 본다
    out[q] = data[k + 3] > 127 && data[k] * 0.3 + data[k + 1] * 0.59 + data[k + 2] * 0.11 < threshold ? 1 : 0;
  }
  return out;
}

type Comp = { x0: number; y0: number; x1: number; y1: number };

function components(mask: Uint8Array, W: number, H: number, r: Region): Comp[] {
  const lab = new Uint8Array(W * H);
  const comps: Comp[] = [];
  const stack: number[] = [];
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++) {
      const q = y * W + x;
      if (!mask[q] || lab[q]) continue;
      let x0 = x, y0 = y, x1 = x, y1 = y;
      lab[q] = 1;
      stack.push(q);
      while (stack.length) {
        const v = stack.pop()!;
        const vx = v % W, vy = (v - vx) / W;
        if (vx < x0) x0 = vx; if (vx > x1) x1 = vx;
        if (vy < y0) y0 = vy; if (vy > y1) y1 = vy;
        if (vx > r.x0 && mask[v - 1] && !lab[v - 1]) { lab[v - 1] = 1; stack.push(v - 1); }
        if (vx < r.x1 - 1 && mask[v + 1] && !lab[v + 1]) { lab[v + 1] = 1; stack.push(v + 1); }
        if (vy > r.y0 && mask[v - W] && !lab[v - W]) { lab[v - W] = 1; stack.push(v - W); }
        if (vy < r.y1 - 1 && mask[v + W] && !lab[v + W]) { lab[v + W] = 1; stack.push(v + W); }
      }
      comps.push({ x0, y0, x1, y1 });
    }
  }
  return comps;
}

/**
 * 숫자 한 글자 크기(높이 ≈ digitH)의 덩어리를 찾아 가로로 붙은 것끼리 묶는다(최대 4글자, 「11-1」 같은 줄표 포함).
 * 선·그림 조각은 크기와 모양으로 걸러진다.
 */
export function findNumberBoxes(img: Gray, region: Region, digitH: number): Box[] {
  const W = img.width, H = img.height;
  const r: Region = {
    x0: Math.max(0, Math.floor(region.x0)), y0: Math.max(0, Math.floor(region.y0)),
    x1: Math.min(W, Math.ceil(region.x1)), y1: Math.min(H, Math.ceil(region.y1)),
  };
  if (r.x1 <= r.x0 || r.y1 <= r.y0 || digitH < 4) return [];
  const comps = components(darkMask(img), W, H, r);
  const glyphs = comps.filter((k) => {
    const h = k.y1 - k.y0 + 1, w = k.x1 - k.x0 + 1;
    const digit = h > digitH * 0.55 && h < digitH * 1.6 && w < h * 1.3 && w > h * 0.12;
    const dash = h < digitH * 0.35 && w > digitH * 0.25 && w < digitH * 0.9;
    return digit || dash;
  }).sort((a, b) => a.x0 - b.x0);

  const groups: (Comp & { n: number; members: Comp[] })[] = [];
  for (const k of glyphs) {
    const cy = (k.y0 + k.y1) / 2;
    const g = groups.find((G) => k.x0 - G.x1 < digitH * 0.6 && k.x0 > G.x1 - 2 && Math.abs(cy - (G.y0 + G.y1) / 2) < digitH * 0.6);
    if (g) { g.x1 = Math.max(g.x1, k.x1); g.y0 = Math.min(g.y0, k.y0); g.y1 = Math.max(g.y1, k.y1); g.n++; g.members.push(k); }
    else groups.push({ ...k, n: 1, members: [k] });
  }
  // 왼쪽 가까이에 글자 크기 덩어리가 있으면 「Fig 5」 같은 글자일 수 있다 → 읽을 때 왼쪽까지 넓혀 확인한다
  const leftText = (G: Comp & { members: Comp[] }) => {
    const cy = (G.y0 + G.y1) / 2;
    return glyphs.some((k) => !G.members.includes(k) && k.x1 < G.x0 && G.x0 - k.x1 < digitH * 1.6 && Math.abs((k.y0 + k.y1) / 2 - cy) < digitH * 0.5);
  };
  return groups
    .filter((G) => G.n <= 4 && G.y1 - G.y0 > digitH * 0.55)
    .map((G) => ({ x: G.x0, y: G.y0, w: G.x1 - G.x0 + 1, h: G.y1 - G.y0 + 1, leftText: leftText(G) }));
}

/** 상자 안의 글자만 흰 바탕에 옮기고 작은 글자는 키워서 OCR에 넘긴다 */
function cropCanvas(src: HTMLCanvasElement, b: Box, digitH: number): HTMLCanvasElement {
  const scale = digitH < 28 ? Math.min(3, 32 / digitH) : 1;
  const pad = Math.round(digitH * 0.5 * scale);
  const c = document.createElement("canvas");
  c.width = Math.round((b.w + 2) * scale) + pad * 2;
  c.height = Math.round((b.h + 2) * scale) + pad * 2;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = true;
  g.drawImage(src, b.x - 1, b.y - 1, b.w + 2, b.h + 2, pad, pad, (b.w + 2) * scale, (b.h + 2) * scale);
  return c;
}

const DIGITS = { tessedit_char_whitelist: "0123456789-" };
const ANY = { tessedit_char_whitelist: "" };

type OcrWorker = {
  recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>;
  setParameters: (p: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

/** 숫자만 읽는 OCR 일꾼. 무거우니 필요할 때만 불러오고, 다 쓰면 terminate 한다. */
export async function createDigitReader(): Promise<OcrWorker> {
  const { createWorker, PSM } = await import("tesseract.js");
  const w = (await createWorker("eng", 1)) as unknown as OcrWorker;
  await w.setParameters({ tessedit_pageseg_mode: String(PSM.SINGLE_LINE), ...DIGITS });
  return w;
}

/** 왼쪽에 글자가 붙어 있는지 넓혀서 읽어 본다: 영문자가 나오면(「Fig 5」) 그림 번호가 아니다 */
async function hasLetterBefore(reader: OcrWorker, canvas: HTMLCanvasElement, b: Box, digitH: number) {
  const wide: Box = { x: Math.max(0, Math.round(b.x - digitH * 2.5)), y: b.y, w: b.w + Math.round(Math.min(b.x, digitH * 2.5)), h: b.h };
  await reader.setParameters(ANY);
  try {
    const { text } = await readBox(reader, canvas, wide, digitH);
    return /[A-Za-z]{2}|Fig/i.test(text);
  } finally {
    await reader.setParameters(DIGITS);
  }
}

async function readBox(reader: OcrWorker, canvas: HTMLCanvasElement, b: Box, digitH: number) {
  const crop = cropCanvas(canvas, b, digitH);
  try {
    const { data } = await reader.recognize(crop);
    return { text: data.text.replace(/\s/g, ""), confidence: data.confidence };
  } finally {
    crop.width = crop.height = 0;
  }
}

/**
 * 그림 쪽(region)에서 번호를 찾아 읽는다. valid(그 쪽 부품표 번호)에 있는 것만 돌려준다.
 * 같은 번호가 그림에 여러 번 나오면 모두 돌려준다(같은 부품을 여러 군데 가리키는 경우).
 */
export async function findCallouts(
  reader: OcrWorker,
  canvas: HTMLCanvasElement,
  opts: { region: Region; digitH: number; valid: Set<string>; signal?: AbortSignal; onProgress?: (done: number, total: number) => void },
): Promise<FoundCallout[]> {
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const boxes = findNumberBoxes(img, opts.region, opts.digitH);
  const out: FoundCallout[] = [];
  for (let i = 0; i < boxes.length; i++) {
    if (opts.signal?.aborted) break;
    const r = await readBox(reader, canvas, boxes[i], opts.digitH);
    if (r.confidence > 50 && opts.valid.has(r.text) && !(boxes[i].leftText && await hasLetterBefore(reader, canvas, boxes[i], opts.digitH))) {
      const { leftText: _skip, ...box } = boxes[i];
      out.push({ ...box, no: r.text });
    }
    opts.onProgress?.(i + 1, boxes.length);
  }
  return out;
}

/**
 * 이미 등록된 도면용: 부품표 줄(부품번호 상자) 왼쪽의 「번호」 칸을 읽어 번호 → 부품번호 표를 만든다.
 * 같은 번호가 두 줄이면 처음 줄을 쓴다(PDF 등록 때와 같은 규칙).
 */
export async function readRefColumn(
  reader: OcrWorker,
  canvas: HTMLCanvasElement,
  rows: (Box & { code: string })[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const img = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
  const read: { row: Box & { code: string }; no: string }[] = [];
  const sorted = [...rows].sort((a, b) => a.y - b.y);
  for (const row of sorted) {
    if (signal?.aborted) break;
    // 번호 칸은 부품번호 왼쪽(사이에 「레벨」 칸이 있는 책도 있다): 글자 높이의 7배 폭에서 숫자 덩어리를 찾아 맨 왼쪽 것을 읽는다
    const digitH = row.h * 0.7;
    const box = findNumberBoxes(img, { x0: row.x - row.h * 7, y0: row.y, x1: row.x - 1, y1: row.y + row.h }, digitH)
      .sort((a, b) => a.x - b.x)[0];
    if (!box) continue;
    const r = await readBox(reader, canvas, box, digitH);
    if (r.confidence > 50 && CALLOUT_RE.test(r.text)) read.push({ row, no: r.text });
  }
  const refs = new Map<string, string>();
  for (const { row, no } of keepAscending(read)) if (!refs.has(no)) refs.set(no, row.code);
  return refs;
}

/**
 * 부품표 번호는 위에서 아래로 커진다. 잘못 읽은 줄(앞뒤와 순서가 안 맞는 번호)은 버린다:
 * 칸(가로 위치)별로 가장 긴 「줄어들지 않는」 번호 순서만 남긴다.
 */
export function keepAscending<T extends { row: Box; no: string }>(items: T[]): T[] {
  const cols: T[][] = [];
  for (const it of [...items].sort((a, b) => a.row.x - b.row.x)) {
    const col = cols.find((c) => Math.abs(c[0].row.x - it.row.x) < it.row.h * 2);
    if (col) col.push(it); else cols.push([it]);
  }
  const key = (no: string) => { const [a, b = "0"] = no.split("-"); return Number(a) * 100 + Number(b); };
  const out: T[] = [];
  for (const col of cols) {
    col.sort((a, b) => a.row.y - b.row.y);
    const len = col.map(() => 1), prev = col.map(() => -1);
    for (let i = 0; i < col.length; i++) {
      for (let j = 0; j < i; j++) {
        if (key(col[j].no) <= key(col[i].no) && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j; }
      }
    }
    let best = len.indexOf(Math.max(...len));
    const keep: T[] = [];
    while (best >= 0) { keep.unshift(col[best]); best = prev[best]; }
    out.push(...keep);
  }
  return out;
}

export type CalloutHotspot = {
  part_code: string; part_name: string | null; callout_no: string; notes: string;
  x: number; y: number; w: number; h: number; // %
};

const pct = (v: number, total: number) => Math.round((v / total) * 10000) / 100;

/** 찾은 번호 → 누를 수 있는 동그란 영역(%). 이미 같은 자리에 같은 번호가 있으면 건너뛴다. */
export function calloutHotspots(
  found: FoundCallout[],
  refs: Map<string, string>,
  width: number,
  height: number,
  existing: { callout_no?: string | null; x: number; y: number; w: number; h: number }[] = [],
): CalloutHotspot[] {
  const out: CalloutHotspot[] = [];
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const f of found) {
    const code = refs.get(f.no);
    if (!code) continue;
    const r = Math.max(f.w, f.h) / 2 + Math.max(4, f.h * 0.35);
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    const spot = {
      part_code: code, part_name: null, callout_no: f.no, notes: OCR_AUTO_NOTE,
      x: Math.max(0, pct(cx - r, width)), y: Math.max(0, pct(cy - r, height)),
      w: pct(r * 2, width), h: pct(r * 2, height),
    };
    if ([...existing, ...out].some((e) => e.callout_no === f.no && overlaps(e, spot))) continue;
    out.push(spot);
  }
  return out;
}

type SavedHotspot = { part_code: string; callout_no?: string | null; target_diagram_id?: string | null; notes?: string | null; x: number; y: number; w: number; h: number };

/**
 * 이미 등록된 도면에서 번호 찾기: 부품표 줄(번호 없는 부품 영역)의 왼쪽 「번호」 칸을 읽어 번호표를 만들고,
 * 표 왼쪽 그림에서 그 번호들을 찾아 새 영역을 돌려준다. 이미 있는 그림 번호 영역은 번호표에 먼저 쓴다.
 */
export async function findCalloutsForDiagram(
  canvas: HTMLCanvasElement,
  hotspots: SavedHotspot[],
  opts: { signal?: AbortSignal; onStep?: (msg: string) => void } = {},
): Promise<{ spots: CalloutHotspot[]; refs: number; reason?: string }> {
  const W = canvas.width, H = canvas.height;
  const px = (h: SavedHotspot) => ({ x: (h.x / 100) * W, y: (h.y / 100) * H, w: (h.w / 100) * W, h: (h.h / 100) * H });
  const rows = hotspots
    .filter((h) => !h.callout_no && !h.target_diagram_id && h.part_code)
    .map((h) => ({ ...px(h), code: h.part_code }));
  if (rows.length < 2) return { spots: [], refs: 0, reason: "부품표 줄(부품번호 영역)이 2개 이상 있어야 번호를 맞출 수 있어요" };
  const rowH = [...rows.map((r) => r.h)].sort((a, b) => a - b)[rows.length >> 1];
  // 부품표 칸: 줄 영역이 모인 가로 위치. 그림은 그 왼쪽(번호 칸 앞)까지.
  const xs = rows.map((r) => r.x).sort((a, b) => a - b);
  const medX = xs[xs.length >> 1];
  const tableRows = rows.filter((r) => Math.abs(r.x - medX) < W * 0.08);
  const tableX = Math.min(...tableRows.map((r) => r.x));
  const drawRight = tableX - rowH * 7;
  if (drawRight < W * 0.15) return { spots: [], refs: 0, reason: "부품표 왼쪽에 그림이 없어요" };

  const reader = await createDigitReader();
  try {
    const refs = new Map<string, string>();
    for (const h of hotspots) if (h.callout_no && !h.target_diagram_id && h.part_code && !refs.has(h.callout_no)) refs.set(h.callout_no, h.part_code);
    opts.onStep?.("부품표 번호 읽는 중…");
    const read = await readRefColumn(reader, canvas, tableRows, opts.signal);
    for (const [no, code] of read) if (!refs.has(no)) refs.set(no, code);
    if (!refs.size) return { spots: [], refs: 0, reason: "부품표의 번호 칸을 읽지 못했어요" };
    const found = await findCallouts(reader, canvas, {
      region: { x0: 0, y0: 0, x1: drawRight, y1: H },
      digitH: Math.max(8, rowH * 0.75),
      valid: new Set(refs.keys()),
      signal: opts.signal,
      onProgress: (d, t) => opts.onStep?.(`그림 번호 읽는 중… ${d}/${t}`),
    });
    return { spots: calloutHotspots(found, refs, W, H, hotspots), refs: refs.size };
  } finally {
    await reader.terminate();
  }
}
