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
  customerStreet: string;
  customerZip: string;
  customerCity: string;
  customerCountry: string;
  status: string;
  invoiceNumber: string;
  notes: string;
  orderDate: string;
  serviceDate: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  shippingCost: number | null;
  total: number;
  processingStatus: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

export interface Invoice {
  id: string;
  userId: string | null;
  orderId: string | null;
  invoiceNumber: string;
  type: "invoice" | "cancellation";
  status: "issued" | "cancelled";
  cancelsInvoiceId: string | null;
  issueDate: string;
  serviceDate: string | null;
  sellerName: string;
  sellerAddress: string;
  sellerEmail: string;
  sellerPhone: string;
  customerName: string;
  customerEmail: string;
  customerStreet: string;
  customerZip: string;
  customerCity: string;
  customerCountry: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  taxNote: string;
  isSmallBusiness: boolean;
  notes: string;
  pdfUrl: string | null;
  archivedAt: string | null;
  retentionUntil: string | null;
  createdAt: string;
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
  applicationDeadline: string | null;
  quickItems: { name: string; price: number }[] | null;
  createdAt: string;
}

export interface MarketSale {
  id: string;
  userId: string;
  marketId: string;
  clientId: string | null;
  description: string;
  amount: number;
  quantity: number;
  paymentMethod: "cash" | "card" | null;
  createdAt: string;
}

export interface Expense {
  id: string;
  userId: string;
  marketId: string | null;
  description: string;
  amount: number;
  category: string;
  source: string;
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
  isSmallBusiness: boolean;
  defaultShippingCost: number | null;
}

export interface SubscriptionInfo {
  plan: "free" | "trial" | "pro";
  canCreate: boolean; // false = read-only (FREE)
  proActive: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  expiresAt: string | null;
}
