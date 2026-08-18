import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  on_hand: number;
  allocated: number;
  available: number;
  reorder_point: number;
  reorder_qty: number;
  location: string;
  unit_cost: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  updated_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  priority: 'critical' | 'high' | 'standard' | 'low';
  status: string;
  requested_ship_date: string | null;
  created_at: string;
  updated_at: string;
  total_value: number;
  notes: string | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  allocated_qty: number;
  picked_qty: number;
  packed_qty: number;
  status: string;
  product?: Product;
};

export type Exception = {
  id: string;
  order_id: string | null;
  product_id: string | null;
  type: 'damaged' | 'missing' | 'short_stock' | 'quality_fail' | 'overstock';
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'resolved' | 'escalated';
  description: string;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  order?: Order | null;
  product?: Product | null;
};

export type AllocationLog = {
  id: string;
  order_id: string;
  product_id: string;
  requested_qty: number;
  allocated_qty: number;
  action: 'full' | 'partial' | 'deferred' | 'steal';
  reason: string;
  created_at: string;
  product?: Product;
  order?: Order;
};

export type ActivityLog = {
  id: string;
  order_id: string;
  event: string;
  detail: string | null;
  created_at: string;
};

export const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  standard: 2,
  low: 3,
};

export const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  standard: 'Standard',
  low: 'Low',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  created: 'Created',
  pending_allocation: 'Pending Allocation',
  allocated: 'Allocated',
  picking: 'Picking',
  packing: 'Packing',
  quality_check: 'Quality Check',
  dispatched: 'Dispatched',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
};

export const FULFILLMENT_STAGES = [
  'created',
  'pending_allocation',
  'allocated',
  'picking',
  'packing',
  'quality_check',
  'dispatched',
];
