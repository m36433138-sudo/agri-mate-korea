/**
 * 은행 입금 문자(SMS/알림) → 입금 정보.
 * 앱 화면(붙여넣기)과 deposit-sms 서버 기능이 같은 규칙을 쓰도록 의존성 없이 작성.
 */
export interface ParsedDeposit {
  bank: string;
  amount: number;
  depositorName: string | null;
  /** ISO (KST 기준 시각을 +09:00 으로 표기) */
  depositedAt: string;
  balance: number | null;
  /** 같은 문자가 두 번 들어와도 한 번만 저장하기 위한 키 */
  dedupeKey: string;
}

const BANKS: [RegExp, string][] = [
  [/(NH|농협|nh)/, "농협"],
  [/(수협|Sh|SH)/, "수협"],
  [/(KB|국민)/, "국민"],
  [/신한/, "신한"],
  [/우리/, "우리"],
  [/하나/, "하나"],
  [/(IBK|기업)/, "기업"],
  [/카카오/, "카카오뱅크"],
  [/토스/, "토스뱅크"],
  [/새마을|MG/, "새마을금고"],
  [/신협/, "신협"],
  [/우체국/, "우체국"],
  [/광주/, "광주은행"],
];

const STOP = new Set([
  "입금", "출금", "잔액", "원", "님", "계좌", "알림", "이체", "입금액", "거래", "체크", "카드",
  "전자금융", "타행", "모바일", "인터넷", "대체", "펌뱅킹", "CMS", "스마트", "보통예금", "저축예금",
  "농협", "농협은행", "지역농협", "수협", "수협은행", "은행", "NH", "Sh", "KB", "국민", "신한", "우리",
  "하나", "기업", "IBK", "카카오뱅크", "토스", "토스뱅크", "새마을금고", "신협", "우체국", "광주은행",
  "Web발신", "국외발신", "입금되었습니다", "입금완료", "안내", "광고", "오픈뱅킹", "자동이체",
]);

const num = (s: string) => Number(s.replace(/[^0-9]/g, ""));

function kstNow(now: Date) {
  const k = new Date(now.getTime() + 9 * 3600_000);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate(), hh: k.getUTCHours(), mm: k.getUTCMinutes() };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseDepositSms(raw: string, now: Date = new Date()): ParsedDeposit | null {
  if (!raw) return null;
  const text = raw.replace(/\[(Web발신|국외발신)\]/g, " ").replace(/\r/g, "").trim();
  if (!/입금/.test(text)) return null;
  // 「출금」만 있고 입금 금액이 없는 문자는 제외
  const amtMatch =
    text.match(/입금(?:액)?\s*[:：]?\s*([0-9][0-9,]{0,14})\s*원?/) ??
    text.match(/([0-9][0-9,]{0,14})\s*원\s*입금/);
  if (!amtMatch) return null;
  const amount = num(amtMatch[1]);
  if (!amount || amount <= 0) return null;

  let bank = "은행";
  for (const [re, name] of BANKS) if (re.test(text)) { bank = name; break; }

  const balMatch = text.match(/잔액\s*[:：]?\s*(-?[0-9][0-9,]*)/);
  const balance = balMatch ? Number(balMatch[1].replace(/,/g, "")) : null;

  // 날짜·시각: 11/20 14:23, 11-20 14:23, 11월20일 14:23, 2026/11/20 14:23
  const n = kstNow(now);
  let y = n.y, m = n.m, d = n.d, hh = n.hh, mi = n.mm;
  const dm =
    text.match(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\s*(\d{1,2}):(\d{2})/) ??
    text.match(/(?<![0-9])(\d{1,2})[/-](\d{1,2})\s*(\d{1,2}):(\d{2})/) ??
    text.match(/(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}):(\d{2})/);
  if (dm) {
    if (dm.length === 6) { y = +dm[1]; m = +dm[2]; d = +dm[3]; hh = +dm[4]; mi = +dm[5]; }
    else {
      m = +dm[1]; d = +dm[2]; hh = +dm[3]; mi = +dm[4];
      // 연초에 받은 작년 12월 문자 등: 올해로 보면 하루 넘게 미래이면 작년 문자
      const asThisYear = Date.UTC(y, m - 1, d, hh, mi) - 9 * 3600_000;
      if (asThisYear > now.getTime() + 86_400_000) y -= 1;
    }
  } else {
    const t = text.match(/(?<![0-9])(\d{1,2}):(\d{2})(?![0-9])/);
    if (t) { hh = +t[1]; mi = +t[2]; }
  }
  const depositedAt = `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mi)}:00+09:00`;

  // 입금자명: 금액·날짜·계좌번호·은행명을 지운 뒤 남는 이름 조각
  const stripped = text
    .replace(dm?.[0] ?? "\u0000", " ")
    .replace(amtMatch[0], " 입금 ")
    .replace(/잔액\s*[:：]?\s*-?[0-9][0-9,]*\s*원?/g, " ")
    .replace(/[0-9*][0-9*\-]{4,}/g, " ")
    .replace(/[0-9,]+\s*원/g, " ")
    .replace(/[\[\]<>:：|]/g, " ");
  let depositorName: string | null = null;
  for (let tok of stripped.split(/\s+/)) {
    tok = tok.replace(/님$/, "").replace(/^입금/, "").replace(/입금$/, "").trim();
    if (tok.length < 2 || tok.length > 20) continue;
    if (STOP.has(tok)) continue;
    if (BANKS.some(([re]) => re.test(tok) && tok.length <= 5)) continue;
    if (!/^[가-힣A-Za-z()（）.&·]+$/.test(tok)) continue;
    if (!/[가-힣A-Za-z]{2,}/.test(tok.replace(/[()（）]/g, ""))) continue;
    depositorName = tok;
    break;
  }

  const dedupeKey = [bank, depositedAt, amount, depositorName ?? "", balance ?? ""].join("|");
  return { bank, amount, depositorName, depositedAt, balance, dedupeKey };
}

/** 붙여넣은 여러 문자를 한 건씩 나눈다 (빈 줄 또는 [Web발신] 기준) */
export function splitSmsBatch(raw: string): string[] {
  return raw
    .replace(/\r/g, "")
    .split(/\n\s*\n|(?=\[Web발신\])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 전달 앱마다 본문을 담는 칸 이름이 달라서: 흔한 이름 → 「입금」이 든 아무 글자 칸(안쪽까지) → 원문 */
const TEXT_KEYS = ["text", "message", "msg", "body", "content", "sms", "smsBody", "sms_body", "messageBody", "Text", "Message", "Body", "Content"];
/** 줄바꿈을 이스케이프하지 않고 보내 JSON이 깨진 경우: "text":"…" 칸만 꺼낸다 */
function textFromBrokenJson(s: string): string | null {
  if (!s.trim().startsWith("{")) return null;
  for (const k of TEXT_KEYS) {
    const m = s.match(new RegExp(`"${k}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"[A-Za-z_]+"\\s*:|\\})`));
    if (m && /입금/.test(m[1])) return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  return null;
}

export function pickSmsText(body: unknown, raw = ""): string {
  if (typeof body === "string") return textFromBrokenJson(body) ?? body;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const k of TEXT_KEYS) if (typeof b[k] === "string" && (b[k] as string).trim()) return b[k] as string;
    const strings: string[] = [];
    const walk = (v: unknown, depth: number) => {
      if (depth > 4) return;
      if (typeof v === "string") strings.push(v);
      else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
      else if (v && typeof v === "object") Object.values(v).forEach((x) => walk(x, depth + 1));
    };
    walk(b, 0);
    const hit = strings.filter((x) => /입금/.test(x)).sort((a, c) => c.length - a.length)[0];
    if (hit) return hit;
  }
  return /입금/.test(raw) ? (textFromBrokenJson(raw) ?? raw) : "";
}

