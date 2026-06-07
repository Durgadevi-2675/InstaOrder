import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { Product } from '../../models/product.model';
import { User } from '../../models/user.model';
import { Order, OrderStatus, OrderItem, CustomerInfo } from '../../models/order.model';

@Component({
  selector: 'app-seller-dashboard',
  templateUrl: './seller-dashboard.component.html',
  styleUrls: ['./seller-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule]
})
export class SellerDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  currentUser: User | null = null;
  products: Product[] = [];
  allOrders: Order[] = [];
  filteredOrders: Order[] = [];
  recentOrders: Order[] = [];
  
  currentView: 'overview' | 'products' | 'add-product' | 'orders' = 'overview';
  orderFilter: 'all' | 'pending' | 'new' = 'all';
  expandedOrderId: string | null = null;
  
  productForm: FormGroup;
  editingProduct: Product | null = null;
  
  // Loading states
  isLoading = false;
  isLoadingOrders = false;
  isUpdatingOrder = false;
  isMarkingRead = false;
  
  // Notification state
  newOrdersCount = 0;
  
  // Form validation
  categories = ['Electronics', 'Clothing', 'Food & Beverages', 'Books', 'Home & Garden', 'Sports', 'Toys', 'Other'];
  showCustomCategory = false;
  
  // District and city options
  districts = [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
    'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur',
    'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris',
    'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga',
    'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
    'Tirupattur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'
  ];

  // Cities mapped by districts
  citiesByDistrict: { [key: string]: string[] } = {
    'Chennai': ['Chennai', 'Tambaram', 'Pallavaram', 'Chromepet', 'Velachery', 'Adyar', 'T. Nagar', 'Anna Nagar'],
    'Coimbatore': ['Coimbatore', 'Pollachi', 'Valparai', 'Mettupalayam', 'Sulur', 'Karamadai'],
    'Madurai': ['Madurai', 'Melur', 'Vadipatti', 'Usilampatti', 'Peraiyur', 'Kalligudi'],
    'Salem': ['Salem', 'Mettur', 'Yercaud', 'Attur', 'Sankari', 'Vazhapadi', 'Omalur'],
    'Tiruchirapalli': ['Tiruchirappalli', 'Srirangam', 'Lalgudi', 'Manachanallur', 'Manapparai', 'Musiri'],
    'Tirunelveli': ['Tirunelveli', 'Palayamkottai', 'Ambasamudram', 'Sankarankovil', 'Tenkasi', 'Nanguneri'],
    'Erode': ['Erode', 'Bhavani', 'Gobichettipalayam', 'Sathyamangalam', 'Kangeyam', 'Perundurai'],
    'Vellore': ['Vellore', 'Arcot', 'Ranipet', 'Walajapet', 'Ambur', 'Vaniyambadi'],
    'Thanjavur': ['Thanjavur', 'Kumbakonam', 'Pattukkottai', 'Orathanadu', 'Thiruvaiyaru', 'Papanasam'],
    'Kanyakumari': ['Nagercoil', 'Kanyakumari', 'Padmanabhapuram', 'Thuckalay', 'Kalkulam', 'Colachel'],
    'Dharmapuri': ['Dharmapuri', 'Harur', 'Palakcode', 'Pennagaram', 'Karimangalam', 'Pappireddipatti'],
    'Dindigul': ['Dindigul', 'Kodaikanal', 'Palani', 'Batlagundu', 'Oddanchatram', 'Vedasandur'],
    'Cuddalore': ['Cuddalore', 'Chidambaram', 'Vridhachalam', 'Panruti', 'Kattumannarkoil', 'Kurinjipadi'],
    'Kanchipuram': ['Kanchipuram', 'Chengalpattu', 'Madurantakam', 'Uthiramerur', 'Sriperumbudur', 'Walajabad'],
    'Karur': ['Karur', 'Kulithalai', 'Krishnarayapuram', 'Kadavur', 'Manmangalam', 'Pugalur'],
    'Krishnagiri': ['Krishnagiri', 'Hosur', 'Denkanikottai', 'Pochampalli', 'Uthangarai', 'Bargur'],
    'Nagapattinam': ['Nagapattinam', 'Mayiladuthurai', 'Sirkazhi', 'Tharangambadi', 'Vedaranyam', 'Kilvelur'],
    'Namakkal': ['Namakkal', 'Tiruchengode', 'Rasipuram', 'Paramathi Velur', 'Kolli Hills', 'Sendamangalam'],
    'Nilgiris': ['Ooty', 'Coonoor', 'Kotagiri', 'Gudalur', 'Ketti', 'Wellington'],
    'Perambalur': ['Perambalur', 'Kunnam', 'Veppanthattai', 'Alathur', 'Valikandapuram'],
    'Pudukkottai': ['Pudukkottai', 'Aranthangi', 'Karambakudi', 'Kulathur', 'Gandarvakottai', 'Illuppur'],
    'Ramanathapuram': ['Ramanathapuram', 'Rameswaram', 'Paramakudi', 'Mudukulathur', 'Mandapam', 'Kadaladi'],
    'Sivaganga': ['Sivaganga', 'Karaikudi', 'Devakottai', 'Manamadurai', 'Singampunari', 'Tiruppattur'],
    'Tenkasi': ['Tenkasi', 'Courtallam', 'Alangulam', 'Kadayanallur', 'Veerakeralampudur', 'Shencottai'],
    'Theni': ['Theni', 'Periyakulam', 'Uthamapalayam', 'Andipatti', 'Bodinayakanur', 'Chinnamanur'],
    'Thoothukudi': ['Thoothukudi', 'Kovilpatti', 'Ettayapuram', 'Vilathikulam', 'Ottapidaram', 'Kayathar'],
    'Tiruppur': ['Tiruppur', 'Avinashi', 'Palladam', 'Udumalaipettai', 'Kangeyam', 'Dharapuram'],
    'Tiruvallur': ['Tiruvallur', 'Ambattur', 'Avadi', 'Poonamallee', 'Ponneri', 'Gummidipoondi'],
    'Tiruvannamalai': ['Tiruvannamalai', 'Arani', 'Cheyyar', 'Vandavasi', 'Polur', 'Kalasapakkam'],
    'Tiruvarur': ['Tiruvarur', 'Mannargudi', 'Nannilam', 'Thiruthuraipoondi', 'Valangaiman', 'Kudavasal'],
    'Viluppuram': ['Viluppuram', 'Tindivanam', 'Gingee', 'Vanur', 'Marakkanam', 'Kallakurichi'],
    'Virudhunagar': ['Virudhunagar', 'Sivakasi', 'Srivilliputtur', 'Rajapalayam', 'Sattur', 'Aruppukottai'],
    'Ariyalur': ['Ariyalur', 'Udayarpalayam', 'Andimadam', 'Sendurai', 'Jayankondam'],
    'Chengalpattu': ['Chengalpattu', 'Tambaram', 'Pallavaram', 'Chromepet', 'Madurantakam', 'Cheyyur'],
    'Kallakurichi': ['Kallakurichi', 'Sankarapuram', 'Tirukoilur', 'Ulundurpet', 'Kalvarayan Hills'],
    'Mayiladuthurai': ['Mayiladuthurai', 'Sirkazhi', 'Poompuhar', 'Kuthalam', 'Tarangambadi'],
    'Ranipet': ['Ranipet', 'Arcot', 'Walajapet', 'Nemili', 'Sholinghur'],
    'Tirupattur': ['Tirupattur', 'Ambur', 'Vaniyambadi', 'Natrampalli', 'Alangayam']
  };
  availableCities: string[] = [];
  
  // UI states
  isUserDropdownOpen = false;
  showLogoutModal = false;
  

  // Form handling
  formErrors: { [key: string]: string } = {};
  uploadedImages: string[] = [];
  isUploadingImages = false;
  
  // Stats
  stats = {
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    averageRating: 4.2
  };

  constructor(
    private authService: AuthService,
    private productService: ProductService,
    private orderService: OrderService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      price: ['', [Validators.required, Validators.min(0.01)]],
      category: ['', [Validators.required]],
      customCategory: [''],
      quantity: ['', [Validators.required, Validators.min(0)]],
      shopName: ['', [Validators.required, Validators.minLength(2)]],
      district: ['', [Validators.required]],
      city: ['', [Validators.required]],
      tags: [''],
      images: [[]]
    });

    this.productForm.valueChanges.subscribe(() => {
      this.updateFormErrors();
    });

    this.productForm.get('district')?.valueChanges.subscribe((district: string) => {
      this.onDistrictChange(district);
    });

    this.productForm.get('category')?.valueChanges.subscribe((category: string) => {
      this.onCategoryChange(category);
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: any) {
    if (!event.target.closest('.user-menu')) {
      this.isUserDropdownOpen = false;
    }
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser?.userType !== 'seller') {
      this.authService.logout();
      return;
    }
    
    this.loadSellerData();
    this.startOrderPolling();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  startOrderPolling(): void {
    interval(30000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.loadOrders(false))
      )
      .subscribe();
  }

  loadSellerData(): void {
    this.loadProducts();
    this.loadOrders();
  }

  loadProducts(): void {
    if (this.currentUser) {
      this.isLoading = true;
      this.productService.getProductsBySeller(this.currentUser.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (products) => {
            this.products = products;
            this.stats.totalProducts = products.length;
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error loading products:', error);
            this.isLoading = false;
            this.showError('Failed to load products. Please try again.');
          }
        });
    }
  }

  loadOrders(showLoading = true): any {
    if (this.currentUser && showLoading) {
      this.isLoadingOrders = true;
    }
    
    if (this.currentUser) {
      return this.orderService.getSellerOrders(this.currentUser.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.allOrders = response.orders;
            this.newOrdersCount = response.newOrdersCount || 0;
            this.stats.totalOrders = response.totalOrders;
            this.stats.totalRevenue = this.calculateTotalRevenue();
            
            this.recentOrders = this.allOrders
              .filter(order => order.status !== 'completed' && order.status !== 'cancelled')
              .slice(0, 5);
            
            this.applyOrderFilter();
            this.isLoadingOrders = false;
            
            console.log('Orders loaded:', {
              total: this.allOrders.length,
              newOrders: this.newOrdersCount,
              recent: this.recentOrders.length
            });
          },
          error: (error) => {
            console.error('Error loading orders:', error);
            this.isLoadingOrders = false;
            if (showLoading) {
              this.showError('Failed to load orders. Please try again.');
            }
          }
        });
    }
    
    return null;
  }

  refreshOrders(): void {
    this.loadOrders();
  }

  setOrderFilter(filter: 'all' | 'pending' | 'new'): void {
    this.orderFilter = filter;
    this.applyOrderFilter();
  }

  applyOrderFilter(): void {
    switch (this.orderFilter) {
      case 'pending':
        this.filteredOrders = this.allOrders.filter(order => 
          order.status === 'pending' || order.status === 'confirmed'
        );
        break;
      case 'new':
        this.filteredOrders = this.allOrders.filter(order => order.isNewOrder);
        break;
      default:
        this.filteredOrders = [...this.allOrders];
        break;
    }
  }

  toggleOrderExpansion(orderId: string): void {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
  }

  markOrderAsRead(order: Order): void {
    this.isMarkingRead = true;
    this.orderService.updateOrderStatus(order.id, { status: order.status })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const orderIndex = this.allOrders.findIndex(o => o.id === order.id);
          if (orderIndex !== -1) {
            this.allOrders[orderIndex].isNewOrder = false;
            this.newOrdersCount = Math.max(0, this.newOrdersCount - 1);
            this.applyOrderFilter();
          }
          this.isMarkingRead = false;
        },
        error: (error) => {
          console.error('Error marking order as read:', error);
          this.isMarkingRead = false;
          this.showError('Failed to mark order as read');
        }
      });
  }

  updateOrderStatus(order: Order, newStatus: string): void {
    const validStatus = this.convertToOrderStatus(newStatus);
    if (!validStatus) {
      this.showError('Invalid order status');
      return;
    }

    this.isUpdatingOrder = true;
    this.orderService.updateOrderStatus(order.id, { status: validStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const orderIndex = this.allOrders.findIndex(o => o.id === order.id);
          if (orderIndex !== -1) {
            this.allOrders[orderIndex].status = validStatus;
            this.allOrders[orderIndex].isNewOrder = false;
            this.applyOrderFilter();
          }
          this.isUpdatingOrder = false;
          this.showSuccess(`Order status updated to ${this.getOrderStatusText(validStatus)}`);
        },
        error: (error) => {
          console.error('Error updating order status:', error);
          this.isUpdatingOrder = false;
          this.showError('Failed to update order status');
        }
      });
  }

  private convertToOrderStatus(status: string): OrderStatus | null {
    const validStatuses: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    return validStatuses.includes(status as OrderStatus) ? status as OrderStatus : null;
  }

  getAvailableStatuses(currentStatus: string): OrderStatus[] {
    const statusFlow: { [key: string]: OrderStatus[] } = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready'],
      'ready': ['completed'],
      'completed': [],
      'cancelled': []
    };
    return statusFlow[currentStatus] || [];
  }

  hasOrderItems(order: Order): boolean {
    return order.items && order.items.length > 0;
  }

  getFirstOrderItem(order: Order): OrderItem | null {
    return this.hasOrderItems(order) ? order.items[0] : null;
  }

  getCustomerAddressString(customerInfo: CustomerInfo): string {
    if (customerInfo.addressString) {
      return customerInfo.addressString;
    }
    
    const addr = customerInfo.address;
    return `${addr.street}, ${addr.city}, ${addr.district}, ${addr.state} ${addr.postalCode}`;
  }

  getProductImage(order: Order): string {
    if (order.productInfo?.image) {
      return order.productInfo.image;
    }
    
    const firstItem = this.getFirstOrderItem(order);
    if (firstItem?.productImage) {
      return firstItem.productImage;
    }
    
    return '/assets/placeholder-product.jpg';
  }

  getProductName(order: Order): string {
    if (order.productInfo?.name) {
      return order.productInfo.name;
    }
    
    const firstItem = this.getFirstOrderItem(order);
    if (firstItem?.productName) {
      return firstItem.productName;
    }
    
    return 'Unknown Product';
  }

  formatPriceSafe(price: number | undefined): string {
    if (price === undefined || price === null) {
      return 'N/A';
    }
    return this.formatPrice(price);
  }

  getPendingOrdersCount(): number {
    return this.allOrders.filter(order => 
      order.status === 'pending' || order.status === 'confirmed'
    ).length;
  }

  getTotalRevenue(): number {
    return this.allOrders
      .filter(order => order.status === 'completed')
      .reduce((total, order) => total + order.totalAmount, 0);
  }

  calculateTotalRevenue(): number {
    return this.getTotalRevenue();
  }

  getOrderStatusColor(status: string): string {
    return this.orderService.getStatusColor(status);
  }

  getOrderStatusText(status: string): string {
    return this.orderService.getStatusText(status);
  }

  getPaymentStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'pending': '#ffc107',
      'paid': '#28a745',
      'failed': '#dc3545'
    };
    return colors[status] || '#6c757d';
  }

  getPaymentMethodText(method: string): string {
    const methods: { [key: string]: string } = {
      'cash_on_delivery': 'Cash on Delivery',
      'online': 'Online Payment',
      'card': 'Card Payment'
    };
    return methods[method] || method;
  }

  formatOrderDate(dateString: string): string {
    return this.orderService.formatOrderDate(dateString);
  }

  getRelativeTime(dateString: string): string {
    return this.orderService.getRelativeTime(dateString);
  }

  formatPrice(price: number): string {
    if (typeof price !== 'number' || isNaN(price)) {
      return 'N/A';
    }
    return this.orderService.formatPrice(price);
  }

  callCustomer(phoneNumber: string): void {
    window.open(`tel:${phoneNumber}`, '_self');
  }

  viewOrderDetails(order: Order): void {
    this.expandedOrderId = order.id;
    this.showSuccess('Order details displayed');
  }

  getDisplayName(): string {
    const user = this.authService.getCurrentUser();
    console.log('getDisplayName called, user:', user);
    
    if (user) {
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
      const emailUser = user.email?.split('@')[0] || 'User';
      console.log('Returning email username:', emailUser);
      return emailUser;
    }
    console.log('No user found, returning "User"');
    return 'User';
  }

  toggleUserDropdown(): void {
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
  }

  viewProfile(): void {
    this.isUserDropdownOpen = false;
    console.log('View profile clicked');
    this.router.navigate(['/profile']);
  }
  // Add these methods to your SellerDashboardComponent class

showLogoutConfirmation(): void {
  this.showLogoutModal = true;
  this.isUserDropdownOpen = false;
}

hideLogoutConfirmation(): void {
  this.showLogoutModal = false;
}

confirmLogout(): void {
  this.showLogoutModal = false;
  this.authService.logout();
  this.router.navigate(['/login']);
}



  switchView(view: 'overview' | 'products' | 'add-product' | 'orders'): void {
    this.currentView = view;
    
    if (view !== 'add-product') {
      this.editingProduct = null;
      this.resetForm();
    }
    
    if (view === 'orders' && this.allOrders.length === 0) {
      this.loadOrders();
    }
  }

  onCategoryChange(category: string): void {
    this.showCustomCategory = category === 'Other';
    
    if (!this.showCustomCategory) {
      this.productForm.get('customCategory')?.setValue('');
      this.productForm.get('customCategory')?.clearValidators();
    } else {
      this.productForm.get('customCategory')?.setValidators([Validators.required, Validators.minLength(2)]);
    }
    
    this.productForm.get('customCategory')?.updateValueAndValidity();
  }

  onDistrictChange(district: string): void {
    if (district && this.citiesByDistrict[district]) {
      this.availableCities = this.citiesByDistrict[district];
      this.productForm.get('city')?.setValue('');
    } else {
      this.availableCities = [];
      this.productForm.get('city')?.setValue('');
    }
  }

  updateFormErrors(): void {
    this.formErrors = {};
    const controls = this.productForm.controls;

    Object.keys(controls).forEach(key => {
      const control = controls[key];
      if (control && !control.valid && (control.dirty || control.touched)) {
        const errors = control.errors;
        if (errors) {
          if (errors['required']) {
            this.formErrors[key] = `${this.getFieldDisplayName(key)} is required`;
          } else if (errors['minlength']) {
            this.formErrors[key] = `${this.getFieldDisplayName(key)} must be at least ${errors['minlength'].requiredLength} characters`;
          } else if (errors['min']) {
            this.formErrors[key] = `${this.getFieldDisplayName(key)} must be greater than ${errors['min'].min}`;
          }
        }
      }
    });
  }

  getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      'name': 'Product name',
      'description': 'Description',
      'price': 'Price',
      'category': 'Category',
      'customCategory': 'Custom category',
      'quantity': 'Quantity',
      'shopName': 'Shop name',
      'district': 'District',
      'city': 'City',
      'tags': 'Tags'
    };
    return displayNames[fieldName] || fieldName;
  }

  resetForm(): void {
    this.productForm.reset();
    this.formErrors = {};
    this.editingProduct = null;
    this.availableCities = [];
    this.uploadedImages = [];
    this.showCustomCategory = false;
  }

  onProductSubmit(): void {
    if (this.productForm.valid && this.currentUser && !this.isLoading) {
      this.isLoading = true;
      this.formErrors = {};
      
      const tagsString = this.productForm.value.tags;
      const tagsArray = tagsString ? 
        tagsString.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0) : [];
      
      let finalCategory = this.productForm.value.category;
      if (this.showCustomCategory && this.productForm.value.customCategory) {
        finalCategory = this.productForm.value.customCategory;
      }
      
      const productData = {
        ...this.productForm.value,
        category: finalCategory,
        sellerId: this.currentUser.id,
        shopId: this.currentUser.id,
        tags: tagsArray,
        isAvailable: true,
        price: parseFloat(this.productForm.value.price),
        quantity: parseInt(this.productForm.value.quantity, 10),
        images: this.uploadedImages
      };

      const operation = this.editingProduct 
        ? this.productService.updateProduct(this.editingProduct.id, productData)
        : this.productService.createProduct(productData);

      operation.subscribe({
        next: (product) => {
          this.isLoading = false;
          
          if (this.editingProduct) {
            const index = this.products.findIndex(p => p.id === this.editingProduct!.id);
            if (index !== -1) {
              this.products[index] = product;
            }
            this.showSuccess('Product updated successfully!');
          } else {
            this.products.push(product);
            this.showSuccess('Product added successfully!');
          }
          
          this.stats.totalProducts = this.products.length;
          this.switchView('products');
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error saving product:', error);
          const errorMessage = error.error?.error || error.message || 'Failed to save product. Please try again.';
          this.showError(errorMessage);
        }
      });
    } else {
      Object.keys(this.productForm.controls).forEach(key => {
        this.productForm.get(key)?.markAsTouched();
      });
      this.updateFormErrors();
    }
  }

  editProduct(product: Product): void {
    this.editingProduct = product;
    this.uploadedImages = product.images || [];
    
    const isCustomCategory = !this.categories.includes(product.category);
    
    this.productForm.patchValue({
      name: product.name,
      description: product.description,
      price: product.price,
      category: isCustomCategory ? 'Other' : product.category,
      customCategory: isCustomCategory ? product.category : '',
      quantity: product.quantity,
      shopName: product.shopName,
      district: product.district,
      tags: product.tags.join(', '),
      images: product.images || []
    });
    
    this.onDistrictChange(product.district);
    setTimeout(() => {
      this.productForm.patchValue({ city: product.city });
    }, 0);
    
    this.formErrors = {};
    this.switchView('add-product');
  }

  deleteProduct(product: Product): void {
    if (confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      this.productService.deleteProduct(product.id).subscribe({
        next: () => {
          this.products = this.products.filter(p => p.id !== product.id);
          this.stats.totalProducts = this.products.length;
          this.showSuccess('Product deleted successfully!');
        },
        error: (error) => {
          console.error('Error deleting product:', error);
          this.showError('Failed to delete product. Please try again.');
        }
      });
    }
  }

  toggleProductAvailability(product: Product): void {
    const updatedProduct = { ...product, isAvailable: !product.isAvailable };
    
    this.productService.updateProduct(product.id, updatedProduct).subscribe({
      next: (updated) => {
        const index = this.products.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.products[index] = updated;
        }
        const status = updated.isAvailable ? 'enabled' : 'disabled';
        this.showSuccess(`Product ${status} successfully!`);
      },
      error: (error) => {
        console.error('Error updating product:', error);
        this.showError('Failed to update product availability. Please try again.');
      }
    });
  }

  onFileSelect(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      console.log('Files selected:', files);
      this.isUploadingImages = true;
      
      const imageUrls: string[] = [];
      let filesProcessed = 0;
      
      Array.from(files).forEach((file: any) => {
        if (!file.type.startsWith('image/')) {
          console.warn('Non-image file skipped:', file.name);
          filesProcessed++;
          return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
          console.warn('File too large (>5MB):', file.name);
          this.showError(`File ${file.name} is too large. Please choose files under 5MB.`);
          filesProcessed++;
          return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e: any) => {
          imageUrls.push(e.target.result);
          filesProcessed++;
          
          if (filesProcessed === files.length) {
            this.uploadedImages = [...this.uploadedImages, ...imageUrls];
            this.productForm.patchValue({ images: this.uploadedImages });
            this.isUploadingImages = false;
            this.showSuccess(`${imageUrls.length} image(s) uploaded successfully!`);
          }
        };
        
        reader.onerror = (error) => {
          console.error('Error reading file:', file.name, error);
          filesProcessed++;
          this.showError(`Failed to read file: ${file.name}`);
          
          if (filesProcessed === files.length) {
            if (imageUrls.length > 0) {
              this.uploadedImages = [...this.uploadedImages, ...imageUrls];
              this.productForm.patchValue({ images: this.uploadedImages });
            }
            this.isUploadingImages = false;
          }
        };
        
        reader.readAsDataURL(file);
      });
      
      if (filesProcessed === files.length) {
        this.isUploadingImages = false;
      }
    }
  }

  removeImage(imageUrl: string): void {
    this.uploadedImages = this.uploadedImages.filter(url => url !== imageUrl);
    this.productForm.patchValue({ images: this.uploadedImages });
  }

  clearAllImages(): void {
    this.uploadedImages = [];
    this.productForm.patchValue({ images: [] });
    const fileInput = document.getElementById('images') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  getImagePreviewUrl(imageUrl: string): string {
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    return imageUrl;
  }

  hasFieldError(fieldName: string): boolean {
    return !!this.formErrors[fieldName];
  }

  getFieldError(fieldName: string): string {
    return this.formErrors[fieldName] || '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasUploadedImages(): boolean {
    return this.uploadedImages.length > 0;
  }

  getUploadedImagesCount(): number {
    return this.uploadedImages.length;
  }

  private showSuccess(message: string): void {
    console.log('Success:', message);
    alert(message);
  }

  private showError(message: string): void {
    console.error('Error:', message);
    alert(message);
  }
}