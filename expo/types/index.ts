export type CustomerType = 'Regular' | 'Occasional';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  type: CustomerType;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export interface TiffinEntry {
  id: string;
  date: string;
  customerId: string;
  noonQty: number;
  eveningQty: number;
  unitPrice: number;
  deliveryCharge: number;
  notes?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CateringItem {
  id: string;
  cateringOrderId: string;
  itemName: string;
  name?: string;
  qty: number;
  unitPrice: number;
  note?: string;
}

export interface CateringOrder {
  id: string;
  date: string;
  customerId: string;
  deliveryCharge: number;
  notes?: string;
  comment?: string;
  items: CateringItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  sourceType: 'tiffin' | 'catering';
  description: string;
  qty: number;
  price: number;
  total: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  periodStart: string;
  periodEnd: string;
  subtotalTiffin: number;
  subtotalCatering: number;
  deliveryTotal: number;
  grandTotal: number;
  lines: InvoiceLine[];
  createdAt: string;
}

export interface AppSettings {
  currency: string;
  defaultTiffinPrice: number;
  defaultDeliveryCharge: number;
  companyName: string;
  companyPhone: string;
  companyAddress: string;
}

export interface DashboardMetrics {
  totalTiffins: number;
  totalRevenue: number;
  deliveryTotal: number;
  cateringOrders: number;
  cateringRevenue: number;
}

export interface DateFilter {
  type: 'today' | 'yesterday' | 'week' | 'custom';
  startDate: string;
  endDate: string;
}
