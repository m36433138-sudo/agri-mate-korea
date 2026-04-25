import { Link } from "react-router-dom";
import { ChevronRight, MessageSquare } from "lucide-react";

export default function AIInsightWidget() {
  return (
    <div
      className="lg:col-span-2 rounded-3xl overflow-hidden relative"
      style={{
        background: "linear-gradient(145deg, hsl(152 45% 18%) 0%, hsl(152 55% 24%) 40%, hsl(170 45% 22%) 100%)",
      }}
    >
      <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-[1px]" />
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/[0.04] blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-primary/10 blur-3xl" />

      <div className="p-6 flex flex-col h-full text-white min-h-[320px] relative z-10">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-sm block">AI 정비 어드바이저</span>
            <span className="text-[11px] text-white/50">Powered by AgriMate</span>
          </div>
        </div>

        <h4 className="text-xl font-extrabold mb-4 leading-snug">
          기계 증상을<br />분석해 드립니다
        </h4>

        <div className="space-y-3 flex-1">
          <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-4 text-xs border border-white/8 leading-relaxed text-white/85">
            💡 "유압 압력이 불규칙할 때는 펌프 입구 스트레이너 막힘을 먼저 확인하세요..."
          </div>
          <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-4 text-xs border border-white/8 leading-relaxed text-white/85">
            🔧 "엔진 과열 시 냉각수 순환 경로와 서모스탯 작동 상태를 점검하세요."
          </div>
        </div>

        <Link
          to="/chat"
          className="mt-5 w-full py-3 bg-white text-foreground font-bold rounded-2xl hover:bg-white/95 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-sm shadow-lg shadow-black/10"
        >
          AI 상담 시작 <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
