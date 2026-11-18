/** Yanmar diagnostic codes are written as "<controller 2> <code 5>.<FMI 2>", often with spaces. */
const YANMAR_SPACED = /\b([0-9A-F]{2})\s+([0-9A-F]{5})(?:\s*\.\s*|\s+)(\*\*|\d{1,2})(?![0-9A-Z])/giu;

function toAscii(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[＊]/gu, "*")
    .replace(/[–—−]/gu, "-")
    .toUpperCase();
}

/** Keep hyphens and spaced Yanmar codes together; accept pasted lists without duplicate records. */
export function parseErrorCodes(value: string): string[] {
  const found: string[] = [];
  const rest = toAscii(value).replace(YANMAR_SPACED, (_m, p: string, code: string, fmi: string) => {
    found.push(`${p} ${code}.${fmi === "**" ? "**" : fmi.padStart(2, "0")}`);
    return " ";
  });
  rest.split(/[\s,;、，]+/u).map((code) => code.trim()).filter(Boolean).forEach((code) => found.push(code));
  return [...new Set(found)];
}

export type ErrorCodeKey = { key: string; wildcard: boolean };

/**
 * Normalized key used to match what technicians typed against the manual.
 * "28 03B00 . 00", "2803B00.0" and "28 03B00.00" share one key; "84 04610.**" matches any FMI.
 */
export function errorCodeKey(raw: string): ErrorCodeKey {
  const s = toAscii(raw).trim();
  // VP/GS 계열 "C1-220", "CO-920"(영문 O 오타), "C2 – 22"
  const vp = s.replace(/\s+/g, "").match(/^C([0-9O])-?(\d{2,3})$/u);
  if (vp) return { key: `C${vp[1] === "O" ? "0" : vp[1]}-${vp[2]}`, wildcard: false };
  const y = s.match(/^([0-9A-F]{2})\s*([0-9A-F]{5})\s*(?:\.\s*)?(\*\*|\*|\d{1,2})?$/u);
  if (y && /\d/.test(y[1] + y[2])) {
    const fmi = y[3];
    if (!fmi || fmi.startsWith("*")) return { key: `${y[1]}${y[2]}`, wildcard: true };
    return { key: `${y[1]}${y[2]}${fmi.padStart(2, "0")}`, wildcard: false };
  }
  return { key: s.replace(/[^0-9A-Z가-힣·]/gu, ""), wildcard: false };
}

/** Does a recorded code belong to a manual entry? */
export function errorCodeMatches(manualCode: string, recordedCode: string): boolean {
  const m = errorCodeKey(manualCode);
  const r = errorCodeKey(recordedCode);
  if (!m.key || !r.key) return false;
  if (m.key === r.key) return true;
  if (m.wildcard) return r.key.startsWith(m.key);
  if (r.wildcard) return m.key.startsWith(r.key);
  return false;
}

/** Search text: "04610", "c1 220" or "02000 03" should all find their codes. */
export function errorCodeSearchText(code: string): string {
  const { key } = errorCodeKey(code);
  return `${toAscii(code)} ${key}`.replace(/[\s.\-*]/g, "");
}

export async function compressErrorCodePhoto(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진 변환을 시작할 수 없습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("사진 변환 실패")), "image/jpeg", 0.82,
    ));
  } finally {
    image.close();
  }
}
