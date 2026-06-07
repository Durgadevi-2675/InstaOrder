// models/order.model.ts
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export type PaymentMethod = 'cash_on_delivery' | 'online' | 'card';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  totalPrice: number;
  productImage?: string;
  sellerId: string;
  shopName: string;
}

export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  // Keep the structured address for backend/API
  address: {
    street: string;
    city: string;
    district: string;
    postalCode: string;
    state: string;
  };
  // Add this for template compatibility - will be computed from address object
  addressString?: string;
}

export interface ProductInfo {
  image: string;
  name: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerInfo: CustomerInfo;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  deliveryFee: number;
  orderDate: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  notes?: string;
  isNewOrder?: boolean;
  sellerId?: string;
  shopName?: string;
  createdAt?: string;
  updatedAt?: string;
  
  // Add missing properties that template expects
  productInfo?: ProductInfo;
  specialInstructions?: string;
}

export interface CreateOrderRequest {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  paymentMethod: PaymentMethod;
  customerInfo: CustomerInfo;
  notes?: string;
  deliveryFee?: number;
}

export interface OrderStatusUpdate {
  status: OrderStatus;
  notes?: string;
  estimatedDeliveryTime?: string;
}

export interface OrderResponse {
  success: boolean;
  message: string;
  order: Order;
}

export interface OrdersListResponse {
  success: boolean;
  orders: Order[];
  totalOrders: number;
  totalRevenue?: number;
}

// Additional interfaces for enhanced functionality
export interface OrderFilters {
  status?: OrderStatus | 'all';
  isNew?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  minAmount?: number;
  maxAmount?: number;
  customerId?: string;
  sellerId?: string;
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  newOrders: number;
  cancelledOrders: number;
}

export interface OrderNotification {
  orderId: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  type: 'new_order' | 'status_update' | 'payment_update';
}

// Seller-specific response interfaces
export interface SellerOrdersResponse extends OrdersListResponse {
  newOrdersCount: number;
  hasNewOrders: boolean;
}

export interface NewOrdersResponse {
  newOrders: Order[];
  count: number;
}

// Utility type for order status transitions
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['preparing', 'cancelled'],
  'preparing': ['ready', 'cancelled'],
  'ready': ['completed'],
  'completed': [],
  'cancelled': []
};

// Order status display configurations
export const ORDER_STATUS_CONFIG: Record<OrderStatus, { 
  label: string; 
  color: string; 
  bgColor: string;
  canEdit: boolean;
}> = {
  'pending': { 
    label: 'Order Placed', 
    color: '#856404', 
    bgColor: '#fff3cd',
    canEdit: true
  },
  'confirmed': { 
    label: 'Confirmed', 
    color: '#004085', 
    bgColor: '#cce7ff',
    canEdit: true
  },
  'preparing': { 
    label: 'Preparing', 
    color: '#8b4513', 
    bgColor: '#ffe4cc',
    canEdit: true
  },
  'ready': { 
    label: 'Ready for Pickup', 
    color: '#155724', 
    bgColor: '#d1f2eb',
    canEdit: true
  },
  'completed': { 
    label: 'Completed', 
    color: '#4b0c5a', 
    bgColor: '#e2d5f3',
    canEdit: false
  },
  'cancelled': { 
    label: 'Cancelled', 
    color: '#721c24', 
    bgColor: '#f8d7da',
    canEdit: false
  }
};