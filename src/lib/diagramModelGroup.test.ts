import { describe, it, expect } from "vitest";
import { canonicalModelName, categoryOf, modelGroup, modelsOf } from "./diagramModelGroup";
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
  it("AW465·473·573 공용 커터는 AW465/AW573과 AW473 모두에 속한다", () =>
    expect(modelsOf("AW465 / AW473 / AW573")).toEqual(["AW465 / AW573", "AW473"]));
  it("여러 기종이 함께 나온 트랙터 책은 버튼 하나로 둔다", () => {
    expect(modelsOf("YT6135 / YT6145")).toEqual(["YT6135 / YT6145"]);
    expect(modelsOf("YT4105 / YT5115 / YT5125")).toEqual(["YT4105 / YT5115 / YT5125"]);
  });
  it("한 기종 책은 그 기종에만 속한다", () => expect(modelsOf("YH5101")).toEqual(["YH5101"]));
});

describe("categoryOf", () => {
  it("YH·AW로 시작하면 콤바인", () => {
    expect(categoryOf("YH6140 / YH7140", "콤바인")).toBe("콤바인");
    expect(categoryOf("AW465 / AW473 / AW573", null)).toBe("콤바인");
  });
  it("YT·EG로 시작하면 트랙터", () => {
    expect(categoryOf("YT488", null)).toBe("트랙터");
    expect(categoryOf("EG105", null)).toBe("트랙터");
  });
  it("VP·YR로 시작하면 이앙기", () => {
    expect(categoryOf("VP8D", null)).toBe("이앙기");
    expect(categoryOf("YR60DZ-F", null)).toBe("이앙기");
  });
  it("앞글자로 모르면 기계 종류를 따른다", () => expect(categoryOf("YM359", "트랙터")).toBe("트랙터"));
  it("로타리·방제기 등은 부속장치", () => {
    expect(categoryOf("EL 로타리", "로타리")).toBe("부속장치");
    expect(categoryOf("RVHC650W", "방제기")).toBe("부속장치");
    expect(categoryOf(null, null)).toBe("부속장치");
  });
});

describe("canonicalModelName (같은 책을 여러 방식으로 적어도 한 기종 버튼으로)", () => {
  it("숫자만 쓴 기종에 앞 기종 영문자를 붙인다", () => {
    expect(canonicalModelName("YH6140/7140")).toBe("YH6140 / YH7140");
    expect(canonicalModelName("YH6140, 7140")).toBe("YH6140 / YH7140");
    expect(canonicalModelName("yh6140 / yh7140")).toBe("YH6140 / YH7140");
    expect(canonicalModelName("EG765,775,782")).toBe("EG765 / EG775 / EG782");
    expect(canonicalModelName("MXK2000,2200")).toBe("MXK2000 / MXK2200");
    expect(canonicalModelName("PS6D,PS8D")).toBe("PS6D / PS8D");
    expect(canonicalModelName("WLZ5700NX / WLZ6100NX / WLZ6500NW")).toBe("WLZ5700NX / WLZ6100NX / WLZ6500NW");
  });
  it("기종 번호가 아닌 이름과 한 기종은 그대로", () => {
    expect(canonicalModelName("어라운드 뷰 카메라")).toBe("어라운드 뷰 카메라");
    expect(canonicalModelName("EL 로타리")).toBe("EL 로타리");
    expect(canonicalModelName("YR06")).toBe("YR06");
    expect(canonicalModelName("SRF5000 / SRF6000 / SRF7000")).toBe("SRF5000 / SRF6000 / SRF7000");
  });
  it("「YH6140/7140」로 올린 책도 기존 「YH6140 / YH7140」 버튼에 들어간다", () => {
    expect(modelsOf("YH6140/7140")).toEqual(modelsOf("YH6140 / YH7140"));
    expect(modelsOf("YH470/570/5101")).toEqual(["YH470 / YH570", "YH5101"]);
  });
});
