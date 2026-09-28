import { BladeSharpeningPanel } from "@/components/blades/BladeSharpeningPanel";

export default function BladeSharpening() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">예취 칼날 연마</h1>
      <BladeSharpeningPanel />
    </div>
  );
}
