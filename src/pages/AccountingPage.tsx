import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── 샘플 데이터 ─────────────────────────────────────
const CASH_FLOW_DATA = [
  { date: "2026-01", balance: 68000000, inflow: 12000000, outflow: 8500000 },
  { date: "2026-02", balance: 71500000, inflow: 15000000, outflow: 11000000 },
  { date: "2026-03", balance: 82000000, inflow: 18000000, outflow: 7500000 },
  { date: "2026-04", balance: 91000000, inflow: 22000000, outflow: 13000000 },
  { date: "2026-05", balance: 98000000, inflow: 19000000, outflow: 12000000 },
  { date: "2026-06", balance: 105000000, inflow: 24000000, outflow: 17000000 },
];

const TRANSACTIONS = [
  { id: 1, type: "입금", date: "04-05", party: "대동농기계(주)", amount: 3700000, note: "부품대금 입금", status: "확인", tech: "" },
  { id: 2, type: "입금", date: "04-08", party: "얀마코리아", amount: 15000000, note: "인센티브 정산", status: "확인", tech: "" },
  { id: 3, type: "출금", date: "04-10", party: "이동진", amount: 2800000, note: "4월 급여", status: "확인", tech: "이동진" },
  { id: 4, type: "출금", date: "04-10", party: "김영일", amount: 2800000, note: "4월 급여", status: "확인", tech: "김영일" },
  { id: 5, type: "출금", date: "04-10", party: "마성수", amount: 2800000, note: "4월 급여", status: "확인", tech: "마성수" },
  { id: 6, type: "출금", date: "04-10", party: "유호상", amount: 2800000, note: "4월 급여", status: "확인", tech: "유호상" },
  { id: 7, type: "출금", date: "04-10", party: "이재현", amount: 2800000, note: "4월 급여", status: "확인", tech: "이재현" },
  { id: 8, type: "출금", date: "04-10", party: "주희로", amount: 2800000, note: "4월 급여", status: "확인", tech: "주희로" },
  { id: 9, type: "출금", date: "04-12", party: "하나카드", amount: 438000, note: "법인카드 결제", status: "검토필요", tech: "" },
  { id: 10, type: "입금", date: "04-15", party: "강길영", amount: 1800000, note: "수리비 입금", status: "확인", tech: "" },
  { id: 11, type: "출금", date: "04-18", party: "얀마 부품창고", amount: 5600000, note: "부품 매입", status: "확인", tech: "" },
  { id: 12, type: "입금", date: "04-20", party: "마현준", amount: 4200000, note: "트랙터 수리비", status: "대기중", tech: "" },
];

const AI_TASKS = [
  { id: 1, title: "4월 급여 전표 분개", status: "완료", time: "09:12", agent: "ManagerAgent" },
  { id: 2, title: "얀마 세금계산서 처리", status: "검토중", time: "10:34", agent: "ManagerAgent" },
  { id: 3, title: "부품 매입 원가 배부", status: "대기", time: "11:00", agent: "ManagerAgent" },
  { id: 4, title: "미수금 잔액 확인", status: "완료", time: "08:45", agent: "ManagerAgent" },
];

const KPI = [
  { label: "이번달 매출", value: "₩98,400,000", change: "+12.3%", up: true },
  { label: "이번달 지출", value: "₩41,200,000", change: "+3.1%", up: false },
  { label: "현재 잔고", value: "₩105,000,000", change: "+8.7%", up: true },
  { label: "미수금", value: "₩27,180,000", change: "-5.2%", up: true },
];

const INIT_MESSAGES = [
  {
    role: "assistant", agent: "ManagerAgent", time: "09:00",
    text: "안녕하세요, 대표님. 오늘 처리할 업무를 확인했습니다.\n\n📋 **오늘 처리 항목**\n1. ✅ 4월 거래내역 엑셀 검토\n2. 📊 수리 건별 수익률 산출\n3. 💰 분개 자동 생성\n4. 📄 얀마 정산 전표 작성\n\n승인 후 진행하겠습니다.",
  },
  {
    role: "user", time: "09:05",
    text: "얀마 세금계산서 처리 먼저 해줘",
  },
  {
    role: "assistant", agent: "ManagerAgent", time: "09:06", approval: true,
    text: "얀마코리아 세금계산서를 확인했습니다.\n\n**공급가액**: ₩13,636,364\n**세액**: ₩1,363,636\n**합계**: ₩15,000,000\n\n분개를 생성하겠습니까?\n\n```\n(차) 매입채무  15,000,000\n(대) 보통예금  13,636,364\n     부가세대급금 1,363,636\n```",
  },
];

const fmt = (n: number) =>
  n >= 100000000 ? `${(n / 100000000).toFixed(1)}억`
  : n >= 10000 ? `${(n / 10000).toFixed(0)}만`
  : n.toLocaleString();

// ── Chart ────────────────────────────────────────
function CashFlowChart({ data }: { data: typeof CASH_FLOW_DATA }) {
  const max = Math.max(...data.map(d => d.balance));
  const min = Math.min(...data.map(d => d.balance)) * 0.9;
  const range = max - min;

  const pts = data.map((d, i) => {
    const x = 40 + (i / (data.length - 1)) * 560;
    const y = 180 - ((d.balance - min) / range) * 140;
    return `${x},${y}`;
  }).join(" L ");

  const areaPts = [
    "40,185",
    ...data.map((d, i) => {
      const x = 40 + (i / (data.length - 1)) * 560;
      const y = 180 - ((d.balance - min) / range) * 140;
      return `${x},${y}`;
    }),
    "600,185",
  ].join(" L ");

  return (
    <svg viewBox="0 0 640 200" className="w-full h-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      {[0,1,2,3].map(i => (
        <line key={i} x1="40" y1={45+i*45} x2="600" y2={45+i*45} stroke="#1E3A5F" strokeWidth="0.5" strokeDasharray="4,4" />
      ))}
      {[0,1,2,3].map(i => {
        const val = max - (i/3) * range;
        return <text key={i} x="35" y={48+i*45} textAnchor="end" fontSize="9" fill="#64748B">{fmt(val)}</text>;
      })}
      <path d={`M ${areaPts} Z`} fill="url(#ag)" />
      <path d={`M ${pts}`} fill="none" stroke="url(#lg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = 40 + (i / (data.length - 1)) * 560;
        const y = 180 - ((d.balance - min) / range) * 140;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill="#0F1E38" stroke="#3B82F6" strokeWidth="2" />
            <text x={x} y={y-10} textAnchor="middle" fontSize="9" fill="#94A3B8">{fmt(d.balance)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = 40 + (i / (data.length - 1)) * 560;
        return <text key={i} x={x} y="198" textAnchor="middle" fontSize="9" fill="#64748B">{d.date}</text>;
      })}
    </svg>
  );
}

// ── Main ──────────────────────────────────────────
type Message = { role: string; agent?: string; text: string; time: string; approval?: boolean };

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [txFilter, setTxFilter] = useState("전체");
  const [messages, setMessages] = useState<Message[]>(INIT_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [approvedIds, setApprovedIds] = useState<number[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredTx = TRANSACTIONS.filter(t => txFilter === "전체" ? true : t.type === txFilter);

  const now = () => new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", text: input, time: now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("accounting-chat", {
        body: {
          messages: [...messages, userMsg].map(m => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text,
          })),
        },
      });
      if (error) throw error;
      setMessages(prev => [...prev, {
        role: "assistant", agent: "ManagerAgent",
        text: data.reply || "처리 중 오류가 발생했습니다.",
        time: now(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant", agent: "ManagerAgent",
        text: "연결 오류가 발생했습니다. 다시 시도해 주세요.",
        time: now(),
      }]);
    }
    setLoading(false);
  };

  const handleApprove = (msgIdx: number) => {
    setApprovedIds(prev => [...prev, msgIdx]);
    setMessages(prev => [...prev, {
      role: "assistant", agent: "ManagerAgent",
      text: `✅ 승인 완료되었습니다. 전표를 ERP에 등록하겠습니다.\n\n전표번호: JE-2026-04-0012\n등록일시: ${new Date().toLocaleDateString("ko-KR")}`,
      time: now(),
    }]);
  };

  const S: Record<string, React.CSSProperties> = {
    page: { fontFamily: "'Pretendard Variable', sans-serif", background: "#060F1E", minHeight: "100vh", color: "#E2E8F0" },
    card: { background: "#0B1D30", border: "1px solid #1E3A5F", borderRadius: 12, padding: 20 },
    btn: (active: boolean, color = "#1D4ED8") => ({
      padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      fontSize: 13, fontWeight: active ? 700 : 500,
      background: active ? `linear-gradient(135deg,${color},${color}BB)` : "transparent",
      color: active ? "#fff" : "#94A3B8", transition: "all 0.15s",
    }) as React.CSSProperties,
  };

  const tabs = [
    { id: "dashboard", label: "대시보드" },
    { id: "cashflow",  label: "자금 예측" },
    { id: "transactions", label: "거래내역" },
    { id: "agent",    label: "AI 에이전트" },
  ];

  return (
    <div style={S.page}>
      {/* 탭 헤더 */}
      <div style={{ borderBottom: "1px solid #1E3A5F", padding: "0 0 0 0", marginBottom: 24, display: "flex", gap: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={S.btn(activeTab === t.id)}>
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px #22C55E" }} />
          <span style={{ fontSize: 12, color: "#64748B" }}>실시간 연동</span>
        </div>
      </div>

      {/* ── 대시보드 ── */}
      {activeTab === "dashboard" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {KPI.map((k, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#F1F5F9", marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: k.up ? "#22C55E" : "#EF4444" }}>
                  {k.change} 전월 대비
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>자금 잔고 추이</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>2026년 1~6월 실적 및 예측</div>
                </div>
              </div>
              <div style={{ height: 200 }}><CashFlowChart data={CASH_FLOW_DATA} /></div>
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>🤖 AI 에이전트 작업</div>
              {AI_TASKS.map(task => (
                <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1E3A5F" }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: task.status === "완료" ? "#22C55E" : task.status === "검토중" ? "#F59E0B" : "#3B82F6",
                    boxShadow: `0 0 6px ${task.status === "완료" ? "#22C55E" : task.status === "검토중" ? "#F59E0B" : "#3B82F6"}`,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#CBD5E1" }}>{task.title}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>{task.agent} · {task.time}</div>
                  </div>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 10,
                    background: task.status === "완료" ? "#052e16" : task.status === "검토중" ? "#451a03" : "#1e1b4b",
                    color: task.status === "완료" ? "#22C55E" : task.status === "검토중" ? "#F59E0B" : "#818CF8",
                  }}>{task.status}</span>
                </div>
              ))}
              <button onClick={() => setActiveTab("agent")} style={{
                ...S.btn(true), width: "100%", marginTop: 14, padding: "10px",
              }}>AI 에이전트 열기 →</button>
            </div>
          </div>

          {/* 최근 거래 */}
          <div style={{ ...S.card, marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 14 }}>최근 거래내역</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>{["구분","일자","거래처","금액","적요","상태"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#64748B", fontWeight: 600, borderBottom: "1px solid #1E3A5F", fontSize: 11 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {TRANSACTIONS.slice(0, 6).map(tx => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #0A1628" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: tx.type === "입금" ? "#052e16" : "#450a0a", color: tx.type === "입금" ? "#22C55E" : "#F87171" }}>{tx.type}</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#94A3B8" }}>{tx.date}</td>
                    <td style={{ padding: "10px 12px", color: "#CBD5E1", fontWeight: 500 }}>{tx.party}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: tx.type === "입금" ? "#4ADE80" : "#F87171" }}>
                      {tx.type === "입금" ? "+" : "-"}₩{tx.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748B" }}>{tx.note}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 10,
                        background: tx.status === "확인" ? "#1e3a5f" : tx.status === "검토필요" ? "#451a03" : "#1e1b4b",
                        color: tx.status === "확인" ? "#60A5FA" : tx.status === "검토필요" ? "#F59E0B" : "#818CF8",
                      }}>{tx.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 자금 예측 ── */}
      {activeTab === "cashflow" && (
        <div>
          <div style={{ background: "linear-gradient(135deg, #1D4ED8, #1E40AF)", borderRadius: 12, padding: "20px 24px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12, color: "#93C5FD", marginBottom: 4 }}>현재 법인 잔고</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>₩105,000,000</div>
              <div style={{ fontSize: 12, color: "#BFDBFE", marginTop: 4 }}>전월 대비 +₩7,000,000 (↑7.1%)</div>
            </div>
          </div>
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ height: 220 }}><CashFlowChart data={CASH_FLOW_DATA} /></div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 14 }}>월별 수입/지출 상세</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>{["월","수입","지출","순증감","누적잔고"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: "#64748B", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #1E3A5F" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {CASH_FLOW_DATA.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1E3A5F" }}>
                    <td style={{ padding: "12px 14px", color: "#94A3B8", textAlign: "right" }}>{d.date}</td>
                    <td style={{ padding: "12px 14px", color: "#4ADE80", fontWeight: 600, textAlign: "right" }}>+₩{d.inflow.toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", color: "#F87171", fontWeight: 600, textAlign: "right" }}>-₩{d.outflow.toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, textAlign: "right", color: d.inflow - d.outflow > 0 ? "#4ADE80" : "#F87171" }}>
                      {d.inflow - d.outflow > 0 ? "+" : ""}₩{(d.inflow - d.outflow).toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#60A5FA", fontWeight: 800, textAlign: "right" }}>₩{d.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 거래내역 ── */}
      {activeTab === "transactions" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#F1F5F9", marginBottom: 2 }}>거래내역</h2>
              <p style={{ fontSize: 12, color: "#64748B" }}>2026년 4월 기준 · 장흥+강진 통합</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["전체","입금","출금"].map(f => (
                <button key={f} onClick={() => setTxFilter(f)} style={S.btn(txFilter === f)}>{f}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { label: "총 입금", value: TRANSACTIONS.filter(t=>t.type==="입금").reduce((a,b)=>a+b.amount,0), color: "#22C55E" },
              { label: "총 출금", value: TRANSACTIONS.filter(t=>t.type==="출금").reduce((a,b)=>a+b.amount,0), color: "#EF4444" },
              { label: "순 증감", value: TRANSACTIONS.filter(t=>t.type==="입금").reduce((a,b)=>a+b.amount,0) - TRANSACTIONS.filter(t=>t.type==="출금").reduce((a,b)=>a+b.amount,0), color: "#60A5FA" },
            ].map((s,i) => (
              <div key={i} style={{ ...S.card, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>
                  {s.value < 0 ? "-" : ""}₩{Math.abs(s.value).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#060F1E" }}>
                  {["No","구분","일자","거래처","금액","적요","상태"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #1E3A5F" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTx.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #060F1E", background: tx.status === "검토필요" ? "#160a00" : "transparent" }}>
                    <td style={{ padding: "12px 14px", color: "#475569" }}>{tx.id}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 10, fontWeight: 600, background: tx.type === "입금" ? "#052e16" : "#450a0a", color: tx.type === "입금" ? "#22C55E" : "#F87171" }}>{tx.type}</span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#94A3B8" }}>{tx.date}</td>
                    <td style={{ padding: "12px 14px", color: "#CBD5E1", fontWeight: 500 }}>{tx.party}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 800, color: tx.type === "입금" ? "#4ADE80" : "#F87171" }}>
                      {tx.type === "입금" ? "+" : "-"}₩{tx.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748B" }}>{tx.note}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        fontSize: 11, padding: "3px 9px", borderRadius: 10,
                        background: tx.status === "확인" ? "#0c2340" : tx.status === "검토필요" ? "#451a03" : "#1e1b4b",
                        color: tx.status === "확인" ? "#60A5FA" : tx.status === "검토필요" ? "#F59E0B" : "#818CF8",
                      }}>{tx.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AI 에이전트 ── */}
      {activeTab === "agent" && (
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, height: "calc(100vh - 200px)" }}>
          {/* 사이드바 */}
          <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, marginBottom: 4 }}>AI 에이전트</div>
            {[
              { name: "ManagerAgent", desc: "전표 검증·승인 담당", active: true },
              { name: "LeaseARAgent", desc: "금융리스채권 담당", active: false },
            ].map(a => (
              <div key={a.name} style={{
                padding: "10px 12px", borderRadius: 8,
                background: a.active ? "#1E40AF" : "transparent",
                border: `1px solid ${a.active ? "#3B82F6" : "#1E3A5F"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: a.active ? "#fff" : "#CBD5E1" }}>{a.name}</div>
                <div style={{ fontSize: 10, color: a.active ? "#93C5FD" : "#475569" }}>{a.desc}</div>
              </div>
            ))}

            <div style={{ marginTop: "auto", padding: 12, borderRadius: 8, background: "#060F1E", border: "1px solid #1E3A5F" }}>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 6 }}>빠른 명령</div>
              {["급여 전표 생성", "미수금 현황", "세금계산서 처리", "월 마감 체크"].map(cmd => (
                <button key={cmd} onClick={() => setInput(cmd)} style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "6px 8px", marginBottom: 4, borderRadius: 6,
                  border: "1px solid #1E3A5F", background: "transparent",
                  color: "#94A3B8", fontSize: 11, cursor: "pointer",
                }}>{cmd}</button>
              ))}
            </div>
          </div>

          {/* 채팅 */}
          <div style={{ ...S.card, padding: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((msg, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>
                    {msg.role === "assistant" ? `🤖 ${msg.agent} · ${msg.time}` : `대표님 · ${msg.time}`}
                  </div>
                  <div style={{
                    maxWidth: "78%", padding: "12px 16px", whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 13, color: "#E2E8F0",
                    borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: msg.role === "user" ? "linear-gradient(135deg,#1D4ED8,#1E40AF)" : "#060F1E",
                    border: msg.role === "assistant" ? "1px solid #1E3A5F" : "none",
                  }}>
                    {msg.text}
                  </div>
                  {msg.approval && !approvedIds.includes(idx) && (
                    <button onClick={() => handleApprove(idx)} style={{
                      marginTop: 10, padding: "10px 28px", borderRadius: 8, border: "none",
                      background: "linear-gradient(135deg,#16A34A,#15803D)",
                      color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
                    }}>✓ 승인</button>
                  )}
                  {approvedIds.includes(idx) && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#22C55E" }}>✅ 승인 완료</div>
                  )}
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 12 }}>
                  <span>AI 에이전트 처리 중...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: "16px 20px", borderTop: "1px solid #1E3A5F", display: "flex", gap: 10 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="회계 업무를 지시하세요... (예: 4월 급여 전표 만들어줘)"
                style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid #1E3A5F", background: "#060F1E", color: "#E2E8F0", fontSize: 13, outline: "none" }}
              />
              <button onClick={handleSend} disabled={loading} style={{
                padding: "12px 24px", borderRadius: 10, border: "none",
                background: loading ? "#1E3A5F" : "linear-gradient(135deg,#1D4ED8,#1E40AF)",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              }}>전송</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
