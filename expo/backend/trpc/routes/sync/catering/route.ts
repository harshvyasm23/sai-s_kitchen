import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { CateringOrder } from "@/types";

let db: { tiffins: any[]; customers: any[]; catering: any[] };
try {
  const dbModule = eval('require("../../../hono")');
  db = dbModule.db;
} catch {
  db = { tiffins: [], customers: [], catering: [] };
}

const CateringItemSchema = z.object({
  id: z.string(),
  cateringOrderId: z.string(),
  itemName: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  note: z.string().optional(),
});

const CateringOrderSchema = z.object({
  id: z.string(),
  date: z.string(),
  customerId: z.string(),
  deliveryCharge: z.number(),
  notes: z.string().optional(),
  items: z.array(CateringItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const syncCateringProcedure = publicProcedure
  .input(z.object({
    orders: z.array(CateringOrderSchema),
    lastSyncTime: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    console.log('Syncing catering orders:', input.orders.length);
    
    const existingIds = new Set(db.catering.map((o: CateringOrder) => o.id));
    const newOrders = input.orders.filter(o => !existingIds.has(o.id));
    
    const updatedOrders = input.orders.filter(o => {
      const existing = db.catering.find((e: CateringOrder) => e.id === o.id);
      return existing && new Date(o.updatedAt) > new Date(existing.updatedAt);
    });
    
    db.catering = db.catering.filter((o: CateringOrder) => !updatedOrders.find(u => u.id === o.id));
    db.catering.push(...newOrders, ...updatedOrders);
    
    console.log('Catering orders synced. Total:', db.catering.length);
    
    return {
      success: true,
      synced: newOrders.length + updatedOrders.length,
      total: db.catering.length,
    };
  });

export const getCateringProcedure = publicProcedure
  .input(z.object({
    lastSyncTime: z.string().optional(),
  }))
  .query(async ({ input }) => {
    console.log('Getting catering orders, lastSyncTime:', input.lastSyncTime);
    
    let orders = db.catering;
    
    if (input.lastSyncTime) {
      orders = orders.filter((o: CateringOrder) => 
        new Date(o.updatedAt) > new Date(input.lastSyncTime!)
      );
    }
    
    console.log('Returning catering orders:', orders.length);
    return { orders };
  });

export default {
  sync: syncCateringProcedure,
  get: getCateringProcedure,
};
