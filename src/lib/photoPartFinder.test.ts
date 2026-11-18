import { describe, it, expect } from "vitest";
import { diagramIdsForModel, photoModelOptions } from "./photoPartFinder";

const ds = [
  { id: "a", kind: "diagram", model_name: "YH5101" },
  { id: "b", kind: "diagram", model_name: "YH470 / YH570 / YH5101" },
  { id: "c", kind: "photo", model_name: "YH5101" },
  { id: "d", kind: "diagram", model_name: "YH470 / YH570" },
];

describe("photoPartFinder", () => {
  it("YH5101 includes its own book and the shared cutter book, not machine photos", () => {
    expect(diagramIdsForModel(ds, "YH5101").sort()).toEqual(["a", "b"]);
  });
  it("shared book shows under both models", () => {
    expect(diagramIdsForModel(ds, "YH470 / YH570").sort()).toEqual(["b", "d"]);
  });
  it("model options come only from diagrams", () => {
    expect(photoModelOptions([{ id: "x", kind: "photo", model_name: "YH1150" }])).toEqual([]);
  });
});
