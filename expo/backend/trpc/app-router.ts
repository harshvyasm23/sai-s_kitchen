import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import customersRoute from "./routes/sync/customers/route";
import tiffinsRoute from "./routes/sync/tiffins/route";
import cateringRoute from "./routes/sync/catering/route";
import diagnosticsRoute from "./routes/sync/diagnostics/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  sync: createTRPCRouter({
    customers: customersRoute,
    tiffins: tiffinsRoute,
    catering: cateringRoute,
    diagnostics: diagnosticsRoute,
  }),
});

export type AppRouter = typeof appRouter;
