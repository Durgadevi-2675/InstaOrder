// services/order.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

// Backend API interfaces (what we send/receive from backend)
export interface CreateOrderRequest {
  customerId: string;
  productId: string;
  sellerId: string;
  quantity: number;
  customerInfo: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  specialInstructions?: string;
  paymentMethod: string;
}

interface BackendOrder {
  id: string;
  customerId: string;
  productId: string;
  sellerId: string;
  quantity: number;
  totalAmount: number;
  status: string;
  customerInfo: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  productInfo: {
    name: string;
    price: number;
    image: string;
    category: string;
    shopName: string;
  };
  orderDate: string;
  estimatedReadyTime?: string;
  specialInstructions?: string;
  paymentStatus: string;
  paymentMethod: string;
  isNewOrder: boolean;
  notificationSent: boolean;
}

export interface OrderResponse {
  message: string;
  order: BackendOrder;
}

// Import the Order interface from the model to maintain compatibility
import { 
  Order, 
  OrderItem, 
  CustomerInfo,
  OrdersListResponse,
  OrderStatusUpdate,
  OrderStatus 
} from '../models/order.model';

type BackendOrdersListResponse = {
  orders: BackendOrder[];
  totalOrders: number;
  newOrdersCount?: number;
  hasNewOrders?: boolean;
};

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private baseUrl = 'http://localhost:5000/api/order';
  private newOrdersSubject = new BehaviorSubject<Order[]>([]);
  public newOrders$ = this.newOrdersSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Transform backend order to frontend model
  private transformBackendOrder(backendOrder: BackendOrder): Order {
    // Create an OrderItem from the backend order data
    const orderItem: OrderItem = {
      id: backendOrder.id, // Using order ID as item ID for single item orders
      productId: backendOrder.productId,
      productName: backendOrder.productInfo.name,
      price: backendOrder.productInfo.price,
      quantity: backendOrder.quantity,
      totalPrice: backendOrder.totalAmount,
      productImage: backendOrder.productInfo.image,
      sellerId: backendOrder.sellerId,
      shopName: backendOrder.productInfo.shopName
    };

    // Create CustomerInfo with proper address structure
    const customerInfo: CustomerInfo = {
      id: backendOrder.customerId,
      name: backendOrder.customerInfo.name,
      email: backendOrder.customerInfo.email,
      phone: backendOrder.customerInfo.phone,
      address: {
        street: backendOrder.customerInfo.address,
        city: '',
        district: '',
        postalCode: '',
        state: ''
      },
      addressString: backendOrder.customerInfo.address
    };

    // Transform to frontend Order model
    const frontendOrder: Order = {
      id: backendOrder.id,
      customerId: backendOrder.customerId,
      customerInfo: customerInfo,
      items: [orderItem],
      status: backendOrder.status as OrderStatus,
      paymentStatus: backendOrder.paymentStatus as any,
      paymentMethod: backendOrder.paymentMethod as any,
      totalAmount: backendOrder.totalAmount,
      deliveryFee: 0, // Default to 0 since backend doesn't send this
      orderDate: backendOrder.orderDate,
      estimatedDeliveryTime: backendOrder.estimatedReadyTime,
      notes: backendOrder.specialInstructions,
      isNewOrder: backendOrder.isNewOrder,
      sellerId: backendOrder.sellerId,
      shopName: backendOrder.productInfo.shopName,
      // Add productInfo for backward compatibility
      productInfo: {
        image: backendOrder.productInfo.image,
        name: backendOrder.productInfo.name
      },
      specialInstructions: backendOrder.specialInstructions
    };

    return frontendOrder;
  }

  // Create a new order
  createOrder(orderData: CreateOrderRequest): Observable<{ message: string; order: Order }> {
    return this.http.post<OrderResponse>(`${this.baseUrl}/create`, orderData)
      .pipe(
        map(response => ({
          message: response.message,
          order: this.transformBackendOrder(response.order)
        }))
      );
  }

  // Get orders for a seller with enhanced response including notification data
  getSellerOrders(sellerId: string, statusFilter?: string, newOnly?: boolean): Observable<OrdersListResponse & { newOrdersCount: number; hasNewOrders: boolean }> {
    let params: any = {};
    
    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter;
    }
    
    if (newOnly) {
      params.new_only = 'true';
    }

    return this.http.get<BackendOrdersListResponse>(`${this.baseUrl}/seller/${sellerId}`, { params })
      .pipe(
        map(response => ({
          success: true, // Add success flag for compatibility
          orders: response.orders.map(order => this.transformBackendOrder(order)),
          totalOrders: response.totalOrders,
          newOrdersCount: response.newOrdersCount || 0,
          hasNewOrders: response.hasNewOrders || false
        }))
      );
  }

  // Get only new orders for notifications
  getNewOrders(sellerId: string): Observable<{ newOrders: Order[]; count: number }> {
    return this.http.get<{ newOrders: BackendOrder[]; count: number }>(`${this.baseUrl}/seller/${sellerId}/new`)
      .pipe(
        map(response => ({
          newOrders: response.newOrders.map(order => this.transformBackendOrder(order)),
          count: response.count
        }))
      );
  }

  // Mark order as read (remove new order flag)
  markOrderAsRead(orderId: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/${orderId}/mark-read`, {});
  }

  // Get orders for a customer
  getCustomerOrders(customerId: string): Observable<OrdersListResponse> {
    return this.http.get<BackendOrdersListResponse>(`${this.baseUrl}/customer/${customerId}`)
      .pipe(
        map(response => ({
          success: true,
          orders: response.orders.map(order => this.transformBackendOrder(order)),
          totalOrders: response.totalOrders
        }))
      );
  }

  // Update order status
  updateOrderStatus(orderId: string, statusData: OrderStatusUpdate): Observable<{message: string}> {
    return this.http.put<{message: string}>(`${this.baseUrl}/${orderId}/status`, statusData);
  }

  // Get order details
  getOrderDetails(orderId: string): Observable<{order: Order}> {
    return this.http.get<{order: BackendOrder}>(`${this.baseUrl}/${orderId}`)
      .pipe(
        map(response => ({
          order: this.transformBackendOrder(response.order)
        }))
      );
  }

  // Notification management for sellers
  addNewOrder(order: Order): void {
    const currentOrders = this.newOrdersSubject.value;
    this.newOrdersSubject.next([order, ...currentOrders]);
  }

  markOrderAsReadLocally(orderId: string): void {
    const currentOrders = this.newOrdersSubject.value;
    const updatedOrders = currentOrders.filter(order => order.id !== orderId);
    this.newOrdersSubject.next(updatedOrders);
  }

  getNewOrdersCount(): number {
    return this.newOrdersSubject.value.length;
  }

  // Helper methods for order status
  getStatusColor(status: string): string {
    const statusColors: Record<OrderStatus, string> = {
      'pending': '#ffc107',
      'confirmed': '#007bff',
      'preparing': '#fd7e14',
      'ready': '#28a745',
      'completed': '#6f42c1',
      'cancelled': '#dc3545'
    };
    return statusColors[status as OrderStatus] || '#6c757d';
  }

  getStatusText(status: string): string {
    const statusTexts: Record<OrderStatus, string> = {
      'pending': 'Order Placed',
      'confirmed': 'Confirmed',
      'preparing': 'Preparing',
      'ready': 'Ready for Pickup',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusTexts[status as OrderStatus] || status;
  }

  canUpdateStatus(currentStatus: string, newStatus: string): boolean {
    const statusFlow: Record<OrderStatus, OrderStatus[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['completed'],
      'completed': [],
      'cancelled': []
    };
    return statusFlow[currentStatus as OrderStatus]?.includes(newStatus as OrderStatus) || false;
  }

  getNextPossibleStatuses(currentStatus: string): string[] {
    const statusFlow: Record<OrderStatus, OrderStatus[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['completed'],
      'completed': [],
      'cancelled': []
    };
    return statusFlow[currentStatus as OrderStatus] || [];
  }

  // Format currency for Indian Rupee
  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price || 0);
  }

  // Format date for display
  formatOrderDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Get relative time (e.g., "2 hours ago")
  getRelativeTime(dateString: string): string {
    const now = new Date();
    const orderDate = new Date(dateString);
    const diffInMs = now.getTime() - orderDate.getTime();
    
    const minutes = Math.floor(diffInMs / (1000 * 60));
    const hours = Math.floor(diffInMs / (1000 * 60 * 60));
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return this.formatOrderDate(dateString);
  }

  // Order analytics and statistics
  getOrderStats(orders: Order[]): {
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    totalRevenue: number;
    newOrders: number;
    cancelledOrders: number;
  } {
    return {
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
      completedOrders: orders.filter(o => o.status === 'completed').length,
      totalRevenue: orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.totalAmount, 0),
      newOrders: orders.filter(o => o.isNewOrder).length,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length
    };
  }

  // Filter orders by various criteria
  filterOrders(orders: Order[], criteria: {
    status?: string;
    isNew?: boolean;
    dateRange?: { start: Date; end: Date };
    minAmount?: number;
    maxAmount?: number;
  }): Order[] {
    let filtered = [...orders];

    if (criteria.status && criteria.status !== 'all') {
      filtered = filtered.filter(order => order.status === criteria.status);
    }

    if (criteria.isNew !== undefined) {
      filtered = filtered.filter(order => order.isNewOrder === criteria.isNew);
    }

    if (criteria.dateRange) {
      const { start, end } = criteria.dateRange;
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= start && orderDate <= end;
      });
    }

    if (criteria.minAmount !== undefined) {
      filtered = filtered.filter(order => order.totalAmount >= criteria.minAmount!);
    }

    if (criteria.maxAmount !== undefined) {
      filtered = filtered.filter(order => order.totalAmount <= criteria.maxAmount!);
    }

    return filtered;
  }

  // Sort orders by various criteria
  sortOrders(orders: Order[], criteria: 'date' | 'amount' | 'status' | 'customer', ascending = false): Order[] {
    const sorted = [...orders];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (criteria) {
        case 'date':
          comparison = new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
          break;
        case 'amount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'customer':
          comparison = a.customerInfo.name.localeCompare(b.customerInfo.name);
          break;
      }

      return ascending ? comparison : -comparison;
    });

    return sorted;
  }

  // Get orders summary for dashboard
  getOrdersSummary(orders: Order[]): {
    todaysOrders: Order[];
    weeklyOrders: Order[];
    monthlyOrders: Order[];
    recentOrders: Order[];
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      todaysOrders: orders.filter(order => new Date(order.orderDate) >= today),
      weeklyOrders: orders.filter(order => new Date(order.orderDate) >= weekAgo),
      monthlyOrders: orders.filter(order => new Date(order.orderDate) >= monthAgo),
      recentOrders: this.sortOrders(orders, 'date').slice(0, 10)
    };
  }
}