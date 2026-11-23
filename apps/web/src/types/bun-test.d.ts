// Minimal bun:test typings for apps/web (no @types/bun here; tests run via
// `bun test` from the worktree root, tsc only needs the shapes).
declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(item: unknown): void;
    toHaveLength(n: number): void;
    toMatch(re: RegExp | string): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeTruthy(): void;
    toMatchObject(obj: Record<string, unknown>): void;
  };
}
