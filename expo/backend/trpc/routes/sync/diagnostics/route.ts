import { publicProcedure } from "../../../create-context";

let db: { tiffins: any[]; customers: any[]; catering: any[] };
try {
  const dbModule = eval('require("../../../hono")');
  db = dbModule.db;
} catch {
  db = { tiffins: [], customers: [], catering: [] };
}

export const getDiagnosticsProcedure = publicProcedure
  .query(async () => {
    console.log('=== BACKEND DIAGNOSTICS ===');
    console.log('Customers count:', db.customers.length);
    console.log('Tiffins count:', db.tiffins.length);
    console.log('Catering count:', db.catering.length);
    
    const customerIds = db.customers.map((c: any) => ({ id: c.id, name: c.name }));
    const tiffinsByCustomer = db.tiffins.reduce((acc: any, t: any) => {
      acc[t.customerId] = (acc[t.customerId] || 0) + 1;
      return acc;
    }, {});
    const cateringByCustomer = db.catering.reduce((acc: any, c: any) => {
      acc[c.customerId] = (acc[c.customerId] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Customers:', customerIds);
    console.log('Tiffins by customer:', tiffinsByCustomer);
    console.log('Catering by customer:', cateringByCustomer);
    
    return {
      backend: {
        customers: db.customers.length,
        tiffins: db.tiffins.length,
        catering: db.catering.length,
        customersList: customerIds,
        tiffinsByCustomer,
        cateringByCustomer,
      },
      timestamp: new Date().toISOString(),
    };
  });

export const clearBackendDataProcedure = publicProcedure
  .mutation(async () => {
    console.log('Clearing backend data...');
    db.customers = [];
    db.tiffins = [];
    db.catering = [];
    console.log('Backend data cleared');
    return { success: true };
  });

export default {
  get: getDiagnosticsProcedure,
  clear: clearBackendDataProcedure,
};
