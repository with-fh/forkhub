import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { ossRouter } from "./oss";
import { todoRouter } from "./todo";
import { workerRouter } from "./worker";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  todo: todoRouter,
  oss: ossRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
export type WorkerRouter = typeof workerRouter;
