import { z } from "zod";

export const MACHINE_TYPE_VALUES = ["새기계", "중고기계", "타사기계"] as const;
export const KNOWN_CLASSIFICATIONS = [
  "농업용트랙터",
  "콤바인",
  "이앙기",
  "관리기",
  "약제살포기",
  "묘매트살포기",
  "측조시비기",
  "이식기",
  "승용방제기",
  "콩정선기",
  "BALER",
  "기타",
];

export const machineTypeClassificationSchema = z
  .object({
    machine_type: z.string().trim().min(1, "구분을 선택해주세요."),
    classification: z.string().trim().min(1, "기종을 선택해주세요."),
  })
  .superRefine((val, ctx) => {
    if (!MACHINE_TYPE_VALUES.includes(val.machine_type as any)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["machine_type"],
        message: `구분은 ${MACHINE_TYPE_VALUES.join(" / ")} 중 하나여야 합니다.`,
      });
    }
    if (MACHINE_TYPE_VALUES.includes(val.classification as any)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["classification"],
        message: "기종 자리에 구분값(새기계/중고기계/타사기계)이 들어갈 수 없습니다. 트랙터·콤바인·이앙기 등 기계 종류를 선택하세요.",
      });
    }
  });

export type MachineTypeCheckResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateMachineTypeClassification(input: {
  machine_type: string;
  classification: string;
}): MachineTypeCheckResult {
  const res = machineTypeClassificationSchema.safeParse(input);
  if (res.success) return { ok: true };
  return { ok: false, message: res.error.issues[0]?.message ?? "잘못된 값입니다." };
}
