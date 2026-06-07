import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Product, ProductFilter } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  constructor(private apiService: ApiService) {}

  getAllProducts(): Observable<Product[]> {
    return this.apiService.get<Product[]>('product');
  }

  getProductById(id: string): Observable<Product> {
    return this.apiService.get<Product>(`product/${id}`);
  }

  getProductsByShop(shopId: string): Observable<Product[]> {
    return this.apiService.get<Product[]>(`product/shop/${shopId}`);
  }

  getProductsBySeller(sellerId: string): Observable<Product[]> {
    return this.apiService.get<Product[]>(`product/seller/${sellerId}`);
  }

  searchProducts(filter: ProductFilter): Observable<Product[]> {
    return this.apiService.post<Product[]>('product/search', filter);
  }

  createProduct(product: Partial<Product>): Observable<Product> {
    return this.apiService.post<Product>('product', product);
  }

  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    return this.apiService.put<Product>(`product/${id}`, product);
  }

  deleteProduct(id: string): Observable<void> {
    return this.apiService.delete<void>(`product/${id}`);
  }

  getCategories(): Observable<string[]> {
    return this.apiService.get<string[]>('product/categories');
  }
}
