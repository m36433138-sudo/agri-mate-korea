import { describe, it, expect } from "vitest";
import { modelGroup } from "./diagramModelGroup";
describe("modelGroup", () => {
  it("keeps YT357 separate", () => expect(modelGroup("YT357")).toBe("YT357"));
  it("groups YT490 family", () => expect(modelGroup("YT5101")).toBe("YT490 / YT5101 / YT5113"));
  it("keeps YT488", () => expect(modelGroup("YT488")).toBe("YT488"));
});
