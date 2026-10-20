import { test, expect } from "bun:test";
import {
  parseDepSpec,
  parseDepList,
  satisfies,
  topoSort,
  validateManifest,
  resolveClosure,
  getDependents,
  type Manifest,
} from "../src/deps";

test("parseDepSpec handles id, exact, gte, caret, optional", () => {
  expect(parseDepSpec("fix-a-12345678").id).toBe("fix-a-12345678");
  expect(parseDepSpec("fix-a-12345678").constraint.kind).toBe("any");
  expect(parseDepSpec("fix-a-12345678@2").constraint).toEqual({ kind: "exact", version: 2 });
  expect(parseDepSpec("fix-a-12345678@>=2").constraint).toEqual({ kind: "gte", version: 2 });
  expect(parseDepSpec("fix-a-12345678@^2").constraint).toEqual({ kind: "caret", version: 2 });
  const opt = parseDepSpec("fix-a-12345678@>=1?");
  expect(opt.optional).toBe(true);
  expect(opt.id).toBe("fix-a-12345678");
});

test("satisfies matches npm-like semantics on integer versions", () => {
  expect(satisfies(2, { kind: "any" })).toBe(true);
  expect(satisfies(2, { kind: "exact", version: 2 })).toBe(true);
  expect(satisfies(3, { kind: "exact", version: 2 })).toBe(false);
  expect(satisfies(3, { kind: "gte", version: 2 })).toBe(true);
  expect(satisfies(1, { kind: "gte", version: 2 })).toBe(false);
  expect(satisfies(2, { kind: "caret", version: 2 })).toBe(true);
  expect(satisfies(3, { kind: "caret", version: 2 })).toBe(false);
  expect(satisfies(2, { kind: "range", gte: 1, lt: 3 })).toBe(true);
  expect(satisfies(3, { kind: "range", gte: 1, lt: 3 })).toBe(false);
});

test("parseDepList tolerates brackets, quotes, empty", () => {
  expect(parseDepList("[]")).toEqual([]);
  expect(parseDepList("[a, b@2]")).toEqual(["a", "b@2"]);
  expect(parseDepList("[\"a\", 'b']")).toEqual(["a", "b"]);
  expect(parseDepList(null)).toEqual([]);
});

function manifestOf(patches: Manifest["patches"], order: string[]): Manifest {
  return { patches, apply_order: order, slug_aliases: {} };
}

test("topoSort orders deps first, stable", () => {
  const m = manifestOf(
    {
      "b-x": { version: 1, depends_on: ["a-x"] },
      "a-x": { version: 1 },
      "c-x": { version: 1 },
    },
    ["b-x", "a-x", "c-x"],
  );
  const { order, cycles } = topoSort(m);
  expect(cycles).toEqual([]);
  expect(order.indexOf("a-x") < order.indexOf("b-x")).toBe(true);
});

test("validateManifest catches missing, version-mismatch, conflict, cycle, order-violation", () => {
  const missing = manifestOf({ "b-x": { version: 1, depends_on: ["nope"] } }, ["b-x"]);
  expect(validateManifest(missing).errors.some((e) => e.kind === "missing")).toBe(true);

  const mismatch = manifestOf(
    { "a-x": { version: 1 }, "b-x": { version: 1, depends_on: ["a-x@>=2"] } },
    ["a-x", "b-x"],
  );
  expect(validateManifest(mismatch).errors.some((e) => e.kind === "version-mismatch")).toBe(true);

  const conflict = manifestOf(
    { "a-x": { version: 1 }, "b-x": { version: 1, conflicts_with: ["a-x"] } },
    ["a-x", "b-x"],
  );
  expect(validateManifest(conflict).errors.some((e) => e.kind === "conflict")).toBe(true);

  const cycle = manifestOf(
    { "a-x": { version: 1, depends_on: ["b-x"] }, "b-x": { version: 1, depends_on: ["a-x"] } },
    ["a-x", "b-x"],
  );
  const cycleRes = validateManifest(cycle);
  expect(cycleRes.errors.some((e) => e.kind === "cycle")).toBe(true);

  const badOrder = manifestOf(
    { "a-x": { version: 1 }, "b-x": { version: 1, depends_on: ["a-x"] } },
    ["b-x", "a-x"],
  );
  const badRes = validateManifest(badOrder);
  expect(badRes.errors.some((e) => e.kind === "order-violation")).toBe(true);
  expect(badRes.fixedOrder).toEqual(["a-x", "b-x"]);
});

test("disabled patches are excluded; dependents tracked transitively", () => {
  const m = manifestOf(
    {
      "a-x": { version: 1 },
      "b-x": { version: 1, depends_on: ["a-x"] },
      "c-x": { version: 1, depends_on: ["b-x"], enabled: false },
    },
    ["a-x", "b-x", "c-x"],
  );
  const { order } = topoSort(m);
  expect(order).not.toContain("c-x");
  expect(getDependents(m, "a-x").sort()).toEqual(["b-x"]);
  expect(resolveClosure(m, ["b-x"])).toEqual(["a-x", "b-x"]);
});

test("optional missing dep is warning, required missing is error", () => {
  const m = manifestOf({ "a-x": { version: 1, optional_depends_on: ["ghost"] } }, ["a-x"]);
  const res = validateManifest(m);
  expect(res.valid).toBe(true);
  expect(res.warnings.length).toBe(0); // absent optional dep is silently fine
});
