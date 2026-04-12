import { useState, useEffect } from "react";

const OPENBANKING_TEST = "https://testapi.openbanking.or.kr";

const DEMO_ACCOUNTS = {
  NH: [
    { bankCode: "011", bankName: "농협은행", accountNo: "302-****-****-81", accountName: "광문농기 법인계좌", balance: 105000000 },
    { bankCode: "011", bankName: "농협은행", accountNo: "302-****-****-22", accountName: "광문 장흥 지점", balance: 12500000 },
  ],
  SH: [
    { bankCode: "007", bankName: "수협은행", accountNo: "101-****-****-44", accountName: "광문 강진 지점", balance: 8300000 },
  ],
};

const DEMO_TRANSACTIONS = [
  { date: "2026-04-10", remark: "이동진 4월급여", inAmt: 0, outAmt: 2800000, balance: 102200000, bank: "NH" },
  { date: "2026-04-10", remark: "김영일 4월급여", inAmt: 0, outAmt: 2800000, balance: 99400000, bank: "NH" },
  { date: "2026-04-08", remark: "얀마코리아 인센티브", inAmt: 15000000, outAmt: 0, balance: 112000000, bank: "NH" },
  { date: "2026-04-07", remark: "강길영 수리비", inAmt: 1800000, outAmt: 0, balance: 97000000, bank: "NH" },
  { date: "2026-04-05", remark: "부품 매입", inAmt: 0, outAmt: 5600000, balance: 95200000, bank: "NH" },
  { date: "2026-04-03", remark: "마현준 트랙터 수리비", inAmt: 4200000, outAmt: 0, balance: 100800000, bank: "NH" },
  { date: "2026-04-02", remark: "하나카드 법인결제", inAmt: 0, outAmt: 438000, balance: 96600000, bank: "NH" },
  { date: "2026-04-05", remark: "존디어 부품", inAmt: 0, outAmt: 3200000, balance: 5100000, bank: "SH" },
  { date: "2026-04-01", remark: "강진 수리비 입금", inAmt: 2100000, outAmt: 0, balance: 8300000, bank: "SH" },
];

const OpenBankingAPI = {
  getAuthURL: (clientId: string, redirectUri: string) => {
    const params = new URLSearchParams({
      response_type: "code", client_id: clientId,
      redirect_uri: redirectUri, scope: "login inquiry transfer",
      state: crypto.randomUUID(), auth_type: "0",
    });
    return `${OPENBANKING_TEST}/oauth/2.0/authorize?${params}`;
  },
};

export default function BankingPage() {
  const [tab, setTab] = useState("accounts");
  const [bankConnStatus, setBankConnStatus] = useState<Record<string, boolean>>({ NH: false, SH: false });
  const [showSetup, setShowSetup] = useState(false);
  const [setupBank, setSetupBank] = useState("NH");
  const [credentials, setCredentials] = useState({
    NH: { clientId: "", clientSecret: "", accessToken: "", redirectUri: "https://agrimatekr.com/callback" },
    SH: { clientId: "", clientSecret: "", accessToken: "", redirectUri: "https://agrimatekr.com/callback" },
  });
  const [txFilter, setTxFilter] = useState("전체");
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState<{ time: string; msg: string; type: string }[]>([]);
  const [autoSync, setAutoSync] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!autoSync) return;
    const timer = setInterval(() => handleSync(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [autoSync]);

  const addLog = (msg: string, type = "info") => {
    const time = new Date().toLocaleTimeString("ko-KR");
    setSyncLog(prev => [{ time, msg, type }, ...prev].slice(0, 50));
  };

  const handleSync = async () => {
    setSyncing(true);
    addLog("동기화 시작...", "info");
    const banks = Object.entries(bankConnStatus).filter(([, v]) => v).map(([k]) => k);
    if (banks.length === 0) {
      addLog("연결된 은행이 없습니다.", "warn");
      setSyncing(false);
      return;
    }
    for (const bank of banks) {
      addLog(`[${bank}] 거래내역 조회 중...`, "info");
      await new Promise(r => setTimeout(r, 800));
      addLog(`  [데모] ${bank} 거래 ${DEMO_TRANSACTIONS.filter(t => t.bank === bank).length}건 불러옴`, "success");
    }
    setLastSync(new Date());
    addLog("동기화 완료", "success");
    setSyncing(false);
  };

  const handleTestConnect = async (bank: string) => {
    addLog(`[${bank}] 연결 테스트 중...`, "info");
    await new Promise(r => setTimeout(r, 1200));
    setBankConnStatus(prev => ({ ...prev, [bank]: true }));
    addLog(`✅ [${bank}] 연결 성공! (데모 모드)`, "success");
    setShowSetup(false);
  };

  const filteredTx = DEMO_TRANSACTIONS.filter(t => txFilter === "전체" || t.bank === txFilter);
  const totalIn = filteredTx.reduce((a, b) => a + b.inAmt, 0);
  const totalOut = filteredTx.reduce((a, b) => a + b.outAmt, 0);

  const S: Record<string, React.CSSProperties> = {
    page: { fontFamily: "'Pretendard Variable', sans-serif", background: "#060F1E", minHeight: "100vh", color: "#E2E8F0" },
    card: { background: "#0B1D30", border: "1px solid #1E3A5F", borderRadius: 12, padding: 20 },
    btn: (active: boolean, color = "#1D4ED8") => ({
      padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      fontSize: 13, fontWeight: active ? 700 : 500,
      background: active ? `linear-gradient(135deg,${color},${color}BB)` : "transparent",
      color: active ? "#fff" : "#94A3B8", transition: "all 0.15s",
    }) as React.CSSProperties,
    badge: (c: string) => ({ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: c + "22", color: c, fontWeight: 600 }) as React.CSSProperties,
    inp: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1E3A5F", background: "#060F1E", color: "#E2E8F0", fontSize: 13, outline: "none" } as React.CSSProperties,
  };

  function BankCard({ bank, name, color, logo }: { bank: string; name: string; color: string; logo: string }) {
    const connected = bankConnStatus[bank];
    const accs = DEMO_ACCOUNTS[bank as keyof typeof DEMO_ACCOUNTS] || [];
    const totalBal = accs.reduce((a, b) => a + b.balance, 0);
    return (
      <div style={{ ...S.card, borderColor: connected ? color + "44" : "#1E3A5F" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{logo}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#F1F5F9" }}>{name}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>기업인터넷뱅킹 · 오픈뱅킹</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {connected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E" }} />}
            <span style={S.badge(connected ? "#22C55E" : "#64748B")}>{connected ? "연결됨" : "미연결"}</span>
          </div>
        </div>
        {connected ? (
          <>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>총 잔액</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#F1F5F9", marginBottom: 14 }}>₩{totalBal.toLocaleString()}</div>
            {accs.map((a, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #1E3A5F" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#CBD5E1", fontWeight: 500 }}>{a.accountName}</div>
                  <div style={{ fontSize: 10, color: "#475569" }}>{a.accountNo}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#60A5FA" }}>₩{a.balance.toLocaleString()}</div>
              </div>
            ))}
            <button onClick={handleSync} style={{ ...S.btn(true, color), width: "100%", marginTop: 12, padding: 10, fontSize: 12 }}>
              {syncing ? "동기화 중..." : "지금 동기화"}
            </button>
          </>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14, lineHeight: 1.7 }}>
              {bank === "NH" ? (
                <>NH농협은행 오픈API 또는 금융결제원 오픈뱅킹으로 연동합니다.<br />
                <span style={{ color: "#F59E0B" }}>→ developers.nonghyup.com 에서 API 키 발급</span></>
              ) : (
                <>수협은행은 금융결제원 오픈뱅킹(bankCode: 007)으로 연동합니다.<br />
                <span style={{ color: "#F59E0B" }}>→ openbanking.or.kr 에서 사업자 등록 후 발급</span></>
              )}
            </div>
            <button onClick={() => { setSetupBank(bank); setShowSetup(true); setStep(1); }} style={{
              width: "100%", padding: "12px", borderRadius: 8, border: `1px solid ${color}`,
              background: color + "11", color, fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>연동 설정하기</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* 탭 */}
      <div style={{ borderBottom: "1px solid #1E3A5F", marginBottom: 24, display: "flex", gap: 4, alignItems: "center" }}>
        {[["accounts","계좌 현황"],["transactions","거래내역"],["logs","연동 로그"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={S.btn(tab === id)}>{label}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {lastSync && <span style={{ fontSize: 11, color: "#475569" }}>최근: {lastSync.toLocaleTimeString("ko-KR")}</span>}
          <button onClick={handleSync} disabled={syncing} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: syncing ? "#1E3A5F" : "linear-gradient(135deg,#1D4ED8,#1E40AF)",
            color: syncing ? "#475569" : "#fff", fontSize: 12, fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer",
          }}>↻ {syncing ? "동기화 중..." : "전체 동기화"}</button>
        </div>
      </div>

      {/* ── 계좌 현황 ── */}
      {tab === "accounts" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "전체 잔액 합계", value: `₩${[...DEMO_ACCOUNTS.NH, ...DEMO_ACCOUNTS.SH].reduce((a,b)=>a+b.balance,0).toLocaleString()}`, color: "#60A5FA" },
              { label: "연결 은행", value: `${Object.values(bankConnStatus).filter(Boolean).length} / 2`, color: "#22C55E" },
              { label: "연결 계좌", value: `${Object.values(bankConnStatus).filter(Boolean).length > 0 ? [...DEMO_ACCOUNTS.NH,...DEMO_ACCOUNTS.SH].length : 0} 개`, color: "#A78BFA" },
            ].map((k,i) => (
              <div key={i} style={S.card}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <BankCard bank="NH" name="NH농협은행" color="#22C55E" logo="🌾" />
            <BankCard bank="SH" name="수협은행" color="#3B82F6" logo="🐟" />
          </div>

          <div style={{ ...S.card, marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 14 }}>📋 실제 API 연동 절차</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { bank: "NH농협은행", color: "#22C55E", steps: ["1. developers.nonghyup.com 회원가입","2. 애플리케이션 등록 (사업자번호)","3. API Key 및 Secret 발급","4. 테스트 계좌로 연동 검증","5. 운영 전환 신청 (심사 3~5일)"] },
                { bank: "금융결제원 오픈뱅킹 (통합)", color: "#3B82F6", steps: ["1. openbanking.or.kr 사업자 등록","2. 서비스 심사 신청 (2~4주)","3. OAuth 2.0 Client ID/Secret 발급","4. 농협(011) · 수협(007) 계좌 연결","5. 거래내역 실시간 조회 시작"] },
              ].map((g, i) => (
                <div key={i} style={{ padding: 14, borderRadius: 8, border: `1px solid ${g.color}33`, background: g.color + "08" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginBottom: 10 }}>{g.bank}</div>
                  {g.steps.map((s, j) => (
                    <div key={j} style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6, display: "flex", gap: 6 }}>
                      <span style={{ color: g.color }}>›</span>{s}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 거래내역 ── */}
      {tab === "transactions" && (
        <div>
          <div style={{ ...S.card, marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["전체","NH","SH"].map(f => (
                <button key={f} onClick={() => setTxFilter(f)} style={S.btn(txFilter === f)}>
                  {f === "NH" ? "🌾 농협" : f === "SH" ? "🐟 수협" : "전체"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { label: "총 입금", val: totalIn, color: "#22C55E" },
              { label: "총 출금", val: totalOut, color: "#EF4444" },
              { label: "순 증감", val: totalIn - totalOut, color: "#60A5FA" },
            ].map((s,i) => (
              <div key={i} style={{ ...S.card, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>
                  {s.val < 0 ? "-" : ""}₩{Math.abs(s.val).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#060F1E" }}>
                  {["은행","날짜","거래내용","입금","출금","잔액"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #1E3A5F" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((tx, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #060F1E" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={S.badge(tx.bank === "NH" ? "#22C55E" : "#3B82F6")}>
                        {tx.bank === "NH" ? "🌾 농협" : "🐟 수협"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", color: "#94A3B8" }}>{tx.date}</td>
                    <td style={{ padding: "11px 14px", color: "#CBD5E1", fontWeight: 500 }}>{tx.remark}</td>
                    <td style={{ padding: "11px 14px", color: "#4ADE80", fontWeight: tx.inAmt > 0 ? 700 : 400 }}>
                      {tx.inAmt > 0 ? `+₩${tx.inAmt.toLocaleString()}` : "-"}
                    </td>
                    <td style={{ padding: "11px 14px", color: "#F87171", fontWeight: tx.outAmt > 0 ? 700 : 400 }}>
                      {tx.outAmt > 0 ? `-₩${tx.outAmt.toLocaleString()}` : "-"}
                    </td>
                    <td style={{ padding: "11px 14px", color: "#60A5FA", fontWeight: 600 }}>₩{tx.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 연동 로그 ── */}
      {tab === "logs" && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>📋 연동 로그</div>
            <button onClick={() => setSyncLog([])} style={{ ...S.btn(false), fontSize: 12, border: "1px solid #1E3A5F" }}>로그 지우기</button>
          </div>
          {syncLog.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#475569", fontSize: 13 }}>
              동기화를 실행하면 로그가 표시됩니다.
            </div>
          ) : (
            <div style={{ fontFamily: "monospace" }}>
              {syncLog.map((log, i) => (
                <div key={i} style={{
                  padding: "8px 12px", borderRadius: 4, marginBottom: 4,
                  background: log.type === "error" ? "#450a0a22" : log.type === "warn" ? "#451a0322" : log.type === "success" ? "#052e1622" : "#1E3A5F33",
                  borderLeft: `3px solid ${log.type === "error" ? "#EF4444" : log.type === "warn" ? "#F59E0B" : log.type === "success" ? "#22C55E" : "#3B82F6"}`,
                  display: "flex", gap: 12,
                }}>
                  <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{log.time}</span>
                  <span style={{ fontSize: 12, color: log.type === "error" ? "#F87171" : log.type === "warn" ? "#FCD34D" : log.type === "success" ? "#4ADE80" : "#94A3B8" }}>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 연동 설정 모달 ── */}
      {showSetup && (
        <div style={{ position: "fixed", inset: 0, background: "#000A", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#0B1D30", border: "1px solid #1E3A5F", borderRadius: 16, padding: 28, width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#F1F5F9" }}>
                {setupBank === "NH" ? "🌾 NH농협은행" : "🐟 수협은행"} 연동 설정
              </div>
              <button onClick={() => setShowSetup(false)} style={{ background: "none", border: "none", color: "#475569", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 0, marginBottom: 24 }}>
              {["API 키 입력","계좌 연결","테스트"].map((s, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", margin: "0 auto 6px",
                    background: step > i+1 ? "#22C55E" : step === i+1 ? "#1D4ED8" : "#1E3A5F",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: step >= i+1 ? "#fff" : "#475569",
                  }}>{step > i+1 ? "✓" : i+1}</div>
                  <div style={{ fontSize: 10, color: step === i+1 ? "#60A5FA" : "#475569" }}>{s}</div>
                </div>
              ))}
            </div>

            {step === 1 && (
              <div>
                {[
                  { key: "clientId", label: "Client ID", ph: "발급받은 Client ID" },
                  { key: "clientSecret", label: "Client Secret", ph: "발급받은 Client Secret", type: "password" },
                  { key: "accessToken", label: "Access Token (선택)", ph: "이미 발급된 토큰" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: "#64748B", marginBottom: 6, display: "block" }}>{f.label}</label>
                    <input
                      type={f.type || "text"}
                      placeholder={f.ph}
                      value={credentials[setupBank as keyof typeof credentials][f.key as keyof (typeof credentials)[keyof typeof credentials]]}
                      onChange={e => setCredentials(prev => ({
                        ...prev,
                        [setupBank]: { ...prev[setupBank as keyof typeof credentials], [f.key]: e.target.value },
                      }))}
                      style={S.inp}
                    />
                  </div>
                ))}
                <button onClick={() => setStep(2)} style={{ ...S.btn(true), width: "100%", padding: 12, marginTop: 4 }}>다음 단계 →</button>
              </div>
            )}

            {step === 2 && (
              <div>
                <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>연결할 계좌를 선택하세요.</div>
                {DEMO_ACCOUNTS[setupBank as keyof typeof DEMO_ACCOUNTS].map((acc, i) => (
                  <div key={i} style={{ padding: 14, borderRadius: 8, border: "1px solid #1D4ED8", background: "#1D4ED808", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1" }}>{acc.accountName}</div>
                      <div style={{ fontSize: 11, color: "#475569" }}>{acc.accountNo}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#60A5FA" }}>₩{acc.balance.toLocaleString()}</div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={() => setStep(1)} style={{ ...S.btn(false), flex: 1, border: "1px solid #1E3A5F", padding: 12 }}>← 이전</button>
                  <button onClick={() => setStep(3)} style={{ ...S.btn(true), flex: 2, padding: 12 }}>다음 단계 →</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>연결 테스트</div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>API 연결 상태를 확인합니다.</div>
                <button onClick={() => handleTestConnect(setupBank)} style={{
                  padding: "12px 40px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg,#16A34A,#15803D)",
                  color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", width: "100%",
                }}>연결 테스트 시작</button>
                <button onClick={() => setStep(2)} style={{ ...S.btn(false), marginTop: 10, width: "100%", border: "1px solid #1E3A5F", padding: 10 }}>← 이전</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
