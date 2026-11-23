import z from "zod";

import { publicProcedure } from "../index";
import { getOss, listOss } from "../oss/data";

const maintainerSchema = z.enum(["all", "forkhub", "third-party", "community"]);
const statusSchema = z.enum(["all", "active", "draft", "coming-soon"]);
const sortSchema = z.enum(["stars", "updated", "patches", "name"]);

export const ossRouter = {
  list: publicProcedure
    .input(
      z
        .object({
          q: z.string().max(120),
          maintainer: maintainerSchema,
          status: statusSchema,
          sort: sortSchema,
        })
        .partial()
        .optional()
        .default({}),
    )
    .handler(async ({ input }) => {
      return listOss(input ?? {});
    }),

  get: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(80) }))
    .handler(async ({ input }) => {
      const entry = getOss(input.slug);
      if (!entry) {
        throw new Error(`Unknown OSS entry: ${input.slug}`);
      }
      return entry;
    }),
};
