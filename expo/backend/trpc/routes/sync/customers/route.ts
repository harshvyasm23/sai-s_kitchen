import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { Customer } from "@/types";

let db: { tiffins: any[]; customers: any[]; catering: any[] };
try {
  const dbModule = eval('require("../../../hono")');
  db = dbModule.db;
} catch {
  db = { tiffins: [], customers: [], catering: [] };
}

const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  address: z.string().optional(),
  type: z.enum(['Regular', 'Occasional']),
  createdAt: z.string(),
  updatedAt: z.string(),
  active: z.boolean(),
});

export const syncCustomersProcedure = publicProcedure
  .input(z.object({
    customers: z.array(CustomerSchema),
    lastSyncTime: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    console.log('Syncing customers:', input.customers.length);
    
    const existingIds = new Set(db.customers.map((c: Customer) => c.id));
    const newCustomers = input.customers.filter(c => !existingIds.has(c.id));
    
    const updatedCustomers = input.customers.filter(c => {
      const existing = db.customers.find((e: Customer) => e.id === c.id);
      return existing && new Date(c.updatedAt) > new Date(existing.updatedAt);
    });
    
    db.customers = db.customers.filter((c: Customer) => !updatedCustomers.find(u => u.id === c.id));
    db.customers.push(...newCustomers, ...updatedCustomers);
    
    console.log('Customers synced. Total:', db.customers.length);
    
    return {
      success: true,
      synced: newCustomers.length + updatedCustomers.length,
      total: db.customers.length,
    };
  });

export const getCustomersProcedure = publicProcedure
  .input(z.object({
    lastSyncTime: z.string().optional(),
  }))
  .query(async ({ input }) => {
    console.log('Getting customers, lastSyncTime:', input.lastSyncTime);
    
    let customers = db.customers;
    
    if (input.lastSyncTime) {
      customers = customers.filter((c: Customer) => 
        new Date(c.updatedAt) > new Date(input.lastSyncTime!)
      );
    }
    
    console.log('Returning customers:', customers.length);
    return { customers };
  });

export default {
  sync: syncCustomersProcedure,
  get: getCustomersProcedure,
};
