import { describe, expect, it } from "vitest";
import { errorCodeKey, errorCodeMatches, parseErrorCodes } from "./errorCodes";

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
  it("keeps a spaced Yanmar code as one code instead of splitting it in three", () => {
    expect(parseErrorCodes("03 02000 03, 28 03B00 . 00\nC1-220")).toEqual(["03 02000.03", "28 03B00.00", "C1-220"]);
  });
});

describe("matching recorded codes to the manual", () => {
  it("treats spacing and dot differences as the same code", () => {
    expect(errorCodeMatches("28 03B00.00", "28 03B00 . 00")).toBe(true);
    expect(errorCodeMatches("85 06530.03", "8506530.03")).toBe(true);
  });
  it("matches any FMI when the manual writes **", () => {
    expect(errorCodeMatches("84 04610.**", "84 04610.12")).toBe(true);
  });
  it("does not match a different FMI", () => {
    expect(errorCodeMatches("03 02000.03", "03 02000.04")).toBe(false);
  });
  it("reads the letter O in CO-920 as zero", () => {
    expect(errorCodeKey("CO-920").key).toBe(errorCodeKey("c0-920").key);
  });
});
