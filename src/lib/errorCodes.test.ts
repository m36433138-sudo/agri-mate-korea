import { describe, expect, it } from "vitest";
import { parseErrorCodes } from "./errorCodes";

describe("bulk error code input", () => {
  it("creates separate codes from a pasted list while preserving hyphens", () => {
    expect(parseErrorCodes("e-102, P0217\nE-103; p0401")).toEqual(["E-102", "P0217", "E-103", "P0401"]);
  });
  it("avoids duplicate entries within the same submission", () => {
    expect(parseErrorCodes("e-102 E-102, e-102")).toEqual(["E-102"]);
  });
  it("does not create records from empty input", () => {
    expect(parseErrorCodes(" , ; \n ")).toEqual([]);
  });
});