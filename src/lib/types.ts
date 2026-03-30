// Client-side types matching API responses from storage.ts

export interface OrderItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  price: number;
  processingStatus: string | null;
  comment: string | null;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  status: string;
  invoiceNumber: string;
  notes: string;
  orderDate: string;
  serviceDate: string | null;
  shippingCost: number | null;
  total: number;
  processingStatus: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface MarketEvent {
  id: string;
  userId: string;
  name: string;
  date: string;
  location: string;
  standFee: number;
  travelCost: number;
  notes: string;
  status: string | null;
  quickItems: { name: string; price: number }[] | null;
  createdAt: string;
}

export interface MarketSale {
  id: string;
  userId: string;
  marketId: string;
  description: string;
  amount: number;
  quantity: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  userId: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
  createdAt: string;
}

export interface CompanyProfile {
  id: string;
  userId: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  taxNote: string;
  smallBusinessNote: string | null;
  defaultShippingCost: number | null;
}

export interface AppSettings {
  id: string;
  userId: string;
  theme: string;
  currency: string;
}

export interface SubscriptionInfo {
  status: "trial" | "active" | "expired" | "cancelled";
  isActive: boolean;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  daysRemaining: number | null;
}
