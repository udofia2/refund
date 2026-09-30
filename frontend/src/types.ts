export type Decision = "approved" | "denied" | "escalated";

export interface Customer {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface OrderItem {
  id: number;
  product_name: string;
  price: number;
  quantity: number;
  is_final_sale: boolean;
  condition: string;
}

export interface Order {
  id: number;
  customer_id: number;
  order_date: string;
  total_amount: number;
  status: string;
  items: OrderItem[];
}

export interface ExtractedRefundData {
  reason: string;
  requested_amount: number | null;
  order_id: number | null;
  item_condition: string | null;
  suspicious_indicators: string[];
  confidence: number;
}

export interface RefundRequestResponse {
  id: number;
  customer_id: number;
  order_id: number | null;
  request_text: string;
  extracted_data: ExtractedRefundData | null;
  decision: Decision | null;
  decision_reason: string | null;
  ai_response: string | null;
  ai_provider: string | null;
  created_at: string;
  updated_at: string | null; // null until first update (onupdate doesn't fire on insert)
  customer: Customer;
  order: Order | null;
}

export interface RefundRequestCreate {
  customer_id: number;
  request_text: string;
  order_id?: number | null;
}
