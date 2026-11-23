import { createContext } from "@forkhub/api/context";
import { appRouter } from "@forkhub/api/routers/index";
import { workerRouter } from "@forkhub/api/routers/worker";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";

// Workers (opennext build, OPENNEXT=1) serve the Postgres-free subset:
// healthcheck + oss catalog. Node/docker serves the full router.
const router = (process.env.OPENNEXT ? workerRouter : appRouter) as typeof appRouter;

const rpcHandler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

async function handle(request: Request) {
  const { response } = await rpcHandler.handle(request, {
    prefix: "/rpc",
    context: await createContext({ context: undefined }),
  });
  return response ?? new Response("Not Found", { status: 404 });
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
