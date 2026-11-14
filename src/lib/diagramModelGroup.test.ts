import { describe, it, expect } from "vitest";
import { modelGroup, modelsOf } from "./diagramModelGroup";
describe("modelGroup", () => {
  it("keeps YT357 separate", () => expect(modelGroup("YT357")).toBe("YT357"));
  it("groups YT490 family", () => expect(modelGroup("YT5101")).toBe("YT490 / YT5101 / YT5113"));
  it("keeps YT488", () => expect(modelGroup("YT488")).toBe("YT488"));
});

describe("modelsOf", () => {
  it("YH470·570·5101 공용 커터는 두 기종 모두에 속한다", () =>
    expect(modelsOf("YH470 / YH570 / YH5101")).toEqual(["YH470 / YH570", "YH5101"]));
  it("YT488·490·5101·5113 공용 엔진은 YT488과 YT490 묶음 모두에 속한다", () =>
    expect(modelsOf("YT488 / YT490 / YT5101 / YT5113")).toEqual(["YT488", "YT490 / YT5101 / YT5113"]));
  it("한 기종 책은 그 기종에만 속한다", () => expect(modelsOf("YH5101")).toEqual(["YH5101"]));
});
