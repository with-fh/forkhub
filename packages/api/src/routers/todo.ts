import { todo } from "@forkhub/db/schema/todo";
import { eq } from "drizzle-orm";
import z from "zod";

import { publicProcedure } from "../index";

// NOTE: the db module is imported through a runtime-built specifier (not
// a string literal or const) so that server bundlers (Next/Turbopack,
// OpenNext esbuild for Cloudflare Workers) cannot statically trace
// node-postgres (`pg`) into the bundle. In node/docker it resolves
// normally; on Workers the todo procedures (the only db users) fail at
// call time while healthcheck + oss keep working.
function dbModuleSpecifier(): string {
  return ["@forkhub", "db"].join("/");
}

async function getDb() {
  const mod = (await import(dbModuleSpecifier())) as typeof import("@forkhub/db");
  return mod.db;
}

export const todoRouter = {
  getAll: publicProcedure.handler(async () => {
    return await (await getDb()).select().from(todo);
  }),

  create: publicProcedure
    .input(z.object({ text: z.string().min(1) }))
    .handler(async ({ input }) => {
      return await (await getDb()).insert(todo).values({
        text: input.text,
      });
    }),

  toggle: publicProcedure
    .input(z.object({ id: z.number(), completed: z.boolean() }))
    .handler(async ({ input }) => {
      return await (
        await getDb()
      )
        .update(todo)
        .set({ completed: input.completed })
        .where(eq(todo.id, input.id));
    }),

  delete: publicProcedure.input(z.object({ id: z.number() })).handler(async ({ input }) => {
    return await (await getDb()).delete(todo).where(eq(todo.id, input.id));
  }),
};
