export interface Reservation {
  id: string;
  customerId: string;
  sellerId: string;
  shopId: string;
  productId: string;
  quantity: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled';
  reservationTime: Date;
  pickupTime: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
