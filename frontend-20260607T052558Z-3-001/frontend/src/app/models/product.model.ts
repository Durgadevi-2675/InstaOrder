export interface Product {
  id: string;
  sellerId: string;
  shopId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  quantity: number;
  isAvailable: boolean;
  tags: string[];
  shopName: string;
  district: string;
  city: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductFilter {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  searchTerm?: string;
  location?: string;
  isAvailable?: boolean;
  district?: string;
  city?: string;
}