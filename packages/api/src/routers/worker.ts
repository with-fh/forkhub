import { publicProcedure } from "../index";
import { ossRouter } from "./oss";

/**
 * Subset of procedures safe to run on Cloudflare Workers
 * (no node:net / TCP dependencies — the todo router needs Postgres).
 * The node/docker builds and the Elysia server keep using the full
 * appRouter in ./index.
 */
export const workerRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  oss: ossRouter,
};
