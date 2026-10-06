import { publicProcedure } from "../../../create-context";
import { z } from "zod";

let db: { tiffins: any[]; customers: any[]; catering: any[] };
try {
  const dbModule = eval('require("../../../hono")');
  db = dbModule.db;
} catch {
  db = { tiffins: [], customers: [], catering: [] };
}

const TiffinEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  customerId: z.string(),
  noonQty: z.number(),
  eveningQty: z.number(),
  unitPrice: z.number(),
  deliveryCharge: z.number(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const syncTiffinsProcedure = publicProcedure
  .input(z.object({
    tiffins: z.array(TiffinEntrySchema),
    lastSyncTime: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    console.log('Syncing tiffins:', input.tiffins.length);
    
    const existingIds = new Set(db.tiffins.map((t: any) => t.id));
    const newTiffins = input.tiffins.filter(t => !existingIds.has(t.id));
    
    const updatedTiffins = input.tiffins.filter(t => {
      const existing = db.tiffins.find((e: any) => e.id === t.id);
      return existing && new Date(t.updatedAt) > new Date(existing.updatedAt);
    });
    
    db.tiffins = db.tiffins.filter((t: any) => !updatedTiffins.find(u => u.id === t.id));
    db.tiffins.push(...newTiffins, ...updatedTiffins);
    
    console.log('Tiffins synced. Total:', db.tiffins.length);
    
    return {
      success: true,
      synced: newTiffins.length + updatedTiffins.length,
      total: db.tiffins.length,
    };
  });

export const getTiffinsProcedure = publicProcedure
  .input(z.object({
    lastSyncTime: z.string().optional(),
  }))
  .query(async ({ input }) => {
    console.log('Getting tiffins, lastSyncTime:', input.lastSyncTime);
    
    let tiffins = db.tiffins;
    
    if (input.lastSyncTime) {
      tiffins = tiffins.filter((t: any) => 
        new Date(t.updatedAt) > new Date(input.lastSyncTime!)
      );
    }
    
    console.log('Returning tiffins:', tiffins.length);
    return { tiffins };
  });

export default {
  sync: syncTiffinsProcedure,
  get: getTiffinsProcedure,
};
