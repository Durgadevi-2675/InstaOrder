import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import { Product } from '../../models/product.model';
import { User } from '../../models/user.model';
import { SearchComponent } from '../search/search.component';
import { OrderModalComponent } from '../order-modal/order-modal.component';
import { Router } from '@angular/router';

interface SearchResult {
  products: any[];
  totalResults: number;
  totalSellers: number;
  location: {
    district: string;
    city: string;
  };
}

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
  standalone: true,
  imports: [CommonModule, SearchComponent, OrderModalComponent]
})
export class ProductListComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchResults: SearchResult | null = null;
  isLoading = false;
  error: string | null = null;
  hasSearched = false;
  hasLocationBasedSearch = false;
  selectedProduct: any = null;
  reservingProducts: Set<string> = new Set();

  // Order modal properties
  showOrderModal = false;
  selectedProductForOrder: Product | null = null;

  // Dropdown & Auth UI
  isUserDropdownOpen = false;
  showLoginModal = false;
  showLogoutModal = false;

  @Output() contactSellerEvent = new EventEmitter<any>();
  @Output() viewProductDetailsEvent = new EventEmitter<any>();

  private destroy$ = new Subject<void>();

  constructor(
    private productService: ProductService,
    private authService: AuthService,
    private router: Router
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: any) {
    if (!event.target.closest('.user-menu')) {
      this.isUserDropdownOpen = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onEscapeKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.showLogoutModal) {
        this.hideLogoutConfirmation();
      }
      if (this.showLoginModal) {
        this.hideLogin();
      }
      if (this.selectedProduct) {
        this.closeProductModal();
      }
      if (this.showOrderModal) {
        this.closeOrderModal();
      }
    }
  }

  ngOnInit(): void {
    // Subscribe to auth state changes
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user: User | null) => {
      this.currentUser = user;
      console.log('Auth state changed:', user);
    });
    
    this.currentUser = this.authService.getCurrentUser();
    console.log('Initial user state:', this.currentUser);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Updated method to get display name consistently across the app
  getUserDisplayName(): string {
    const user = this.authService.getCurrentUser();
    console.log('getUserDisplayName called, user:', user);
    
    if (user) {
      // Priority order: username > firstName lastName > firstName > email username
      if (user.username) {
        console.log('Returning username:', user.username);
        return user.username;
      }
      if (user.firstName && user.lastName) {
        const fullName = `${user.firstName} ${user.lastName}`;
        console.log('Returning full name:', fullName);
        return fullName;
      }
      if (user.firstName) {
        console.log('Returning firstName:', user.firstName);
        return user.firstName;
      }
      // Fallback to email username
      const emailUser = user.email?.split('@')[0] || 'User';
      console.log('Returning email username:', emailUser);
      return emailUser;
    }
    console.log('No user found, returning "Guest"');
    return 'Guest';
  }

  // Keep the old method for backward compatibility
  getDisplayName(): string {
    return this.getUserDisplayName();
  }

  // Search handler
  onSearchResults(data: any): void {
    console.log('Search results received:', data);
    this.hasLocationBasedSearch = true;
    this.hasSearched = true;

    if (Array.isArray(data)) {
      this.filteredProducts = data;
    } else {
      this.filteredProducts = data.products || [];
      this.searchResults = data;
    }
    this.error = null;
  }

  // User menu handlers
  toggleUserDropdown(): void {
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
    console.log('User dropdown toggled:', this.isUserDropdownOpen);
  }

  // Updated viewProfile method with proper navigation and authentication check
  viewProfile(): void {
    this.isUserDropdownOpen = false;
    console.log('View profile clicked');
    
    // Check if user is authenticated before navigating
    if (!this.isAuthenticated()) {
      console.log('User not authenticated, showing login modal');
      this.showLoginModal = true;
      return;
    }
    
    // Navigate to profile page
    console.log('Navigating to profile page');
    this.router.navigate(['/profile']);
  }

  isAuthenticated(): boolean {
    const authenticated = this.authService.isAuthenticated();
    console.log('Is authenticated:', authenticated);
    return authenticated;
  }

  showLogoutConfirmation(): void {
    console.log('showLogoutConfirmation called');
    this.isUserDropdownOpen = false;
    this.showLogoutModal = true;
    console.log('Logout modal should be visible:', this.showLogoutModal);
  }

  hideLogoutConfirmation(): void {
    console.log('hideLogoutConfirmation called');
    this.showLogoutModal = false;
    console.log('Logout modal hidden');
  }

  confirmLogout(): void {
    console.log('confirmLogout called');
    this.showLogoutModal = false;
    
    try {
      this.authService.logout();
      this.currentUser = null;
      
      console.log('User logged out successfully');
      
      // Navigate to home page after logout
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error during logout:', error);
      this.showError('An error occurred during logout');
    }
  }

  goToLogin(): void {
    this.isUserDropdownOpen = false;
    this.showLoginModal = false;
    console.log('Navigating to login');
    this.router.navigate(['/login']);
  }

  goToSignup(): void {
    this.isUserDropdownOpen = false;
    this.showLoginModal = false;
    console.log('Navigating to signup');
    this.router.navigate(['/signup']); // Fixed route name to match routes.ts
  }

  retryLoading(): void {
    this.refreshProducts();
  }

  // Order functionality - this replaces contactSeller for the Order button
  placeOrder(product: any): void {
    if (!this.isAuthenticated()) {
      console.log('User not authenticated, showing login modal');
      this.showLoginModal = true;
      return;
    }

    // Check if product is available
    if (!product.isAvailable || product.quantity === 0) {
      this.showError('This product is currently out of stock');
      return;
    }

    console.log('Opening order modal for product:', product);
    this.selectedProductForOrder = product;
    this.showOrderModal = true;
  }

  // Order modal handlers
  closeOrderModal(): void {
    this.showOrderModal = false;
    this.selectedProductForOrder = null;
  }

  onOrderPlaced(order: any): void {
    console.log('Order placed successfully:', order);
    this.showSuccess(`Order placed successfully! Order ID: ${order.id}`);
    
    // Refresh the product data to update stock quantity
    this.refreshProducts();
    
    // Close the modal
    this.closeOrderModal();
  }

  // Keep the old contactSeller method for other uses if needed
  contactSeller(product: any): void {
    if (!this.isAuthenticated()) {
      this.showLoginModal = true;
      return;
    }
    console.log('Contact seller for product:', product);
    this.contactSellerEvent.emit(product);
  }

  viewProductDetails(product: any): void {
    console.log('View details for product:', product);
    this.selectedProduct = product;
    this.viewProductDetailsEvent.emit(product);
  }

  closeProductModal(): void {
    this.selectedProduct = null;
  }

  // Reserve product functionality
  reserveProduct(product: any): void {
    if (!this.isAuthenticated()) {
      this.showLoginModal = true;
      return;
    }
    
    if (!product.isAvailable) {
      this.showError('This product is not available for reservation');
      return;
    }

    this.reservingProducts.add(product.id);
    console.log('Reserving product:', product);

    // Simulate API call
    setTimeout(() => {
      this.reservingProducts.delete(product.id);
      this.showSuccess('Product reserved successfully!');
      this.closeProductModal();
    }, 2000);
  }

  isProductReserving(productId: string): boolean {
    return this.reservingProducts.has(productId);
  }

  // Utilities
  trackByProductId(index: number, product: any): any {
    return product.id || index;
  }

  getProductImage(product: any): string {
    return (product.images && product.images.length > 0) ? product.images[0] : '/assets/placeholder-product.jpg';
  }

  onImageError(event: any): void {
    event.target.src = '/assets/placeholder-product.jpg';
  }

  getShortDescription(description: string): string {
    if (!description) return 'No description available';
    return description.length > 80 ? description.substring(0, 80) + '...' : description;
  }

  formatPrice(price: number): string {
    if (!price) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  }

  getDisplayTags(tags: string[]): string[] {
    return tags ? tags.slice(0, 3) : [];
  }

  trackByImageUrl(index: number, image: string): string {
    return image;
  }

  getAvailabilityColor(product: any): string {
    return product.isAvailable ? '#28a745' : '#dc3545';
  }

  getAvailabilityText(product: any): string {
    if (!product.quantity || product.quantity === 0) {
      return 'Out of Stock';
    }
    return product.isAvailable ? `${product.quantity} available` : 'Unavailable';
  }

  hasMultipleImages(product: any): boolean {
    return product.images && product.images.length > 1;
  }

  isReserveButtonDisabled(product: any): boolean {
    return !product.isAvailable || this.isProductReserving(product.id);
  }

  hideLogin(): void {
    this.showLoginModal = false;
  }

  // Product service helpers
  loadProducts(): void {
    this.isLoading = true;
    this.error = null;
    this.productService.getAllProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products: Product[]) => {
          this.products = products;
          this.isLoading = false;
        },
        error: (err: any) => {
          this.error = err.message || 'Failed to load products';
          this.isLoading = false;
        }
      });
  }

  refreshProducts(): void {
    if (this.hasLocationBasedSearch) {
      this.loadProducts();
    }
  }

  // Enhanced utility methods for user feedback
  private showSuccess(message: string): void {
    console.log('Success:', message);
    // TODO: Replace with proper toast notification system
    // You can implement a proper toast/notification service here
    alert(message);
  }

  private showError(message: string): void {
    console.error('Error:', message);
    // TODO: Replace with proper toast notification system
    // You can implement a proper toast/notification service here
    alert(message);
  }
}