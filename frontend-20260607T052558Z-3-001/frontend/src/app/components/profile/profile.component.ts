// Updated profile.component.ts with enhanced custom category functionality and delete account feature
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { ProductService } from '../../services/product.service';
import { User } from '../../models/user.model';
import { Order } from '../../models/order.model';
import { Product } from '../../models/product.model';
import { HttpClient } from '@angular/common/http';

interface InventoryItem extends Product {
  lowStock?: boolean;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule]
})
export class ProfileComponent implements OnInit {
  private apiUrl = 'http://localhost:5000/api';
  
  profileForm: FormGroup;
  passwordForm: FormGroup;
  user: User | null = null;
  isEditMode = false;
  isChangingPassword = false;
  isLoading = false;
  isPasswordLoading = false;
  successMessage = '';
  errorMessage = '';
  passwordSuccessMessage = '';
  passwordErrorMessage = '';
  activeTab = 'profile';

  // Order history properties
  customerOrders: Order[] = [];
  filteredOrders: Order[] = [];
  isLoadingOrders = false;
  orderErrorMessage = '';
  selectedOrderStatus = 'all';
  currentPage = 1;
  ordersPerPage = 10;

  // Inventory Management Properties (Sellers)
  inventoryItems: InventoryItem[] = [];
  filteredInventory: InventoryItem[] = [];
  isLoadingInventory = false;
  inventoryErrorMessage = '';
  selectedStockFilter = 'all';
  lowStockThreshold = 10;
  editingStock: { [key: string]: boolean } = {};
  stockUpdates: { [key: string]: number } = {};
  itemsPerPage = 10;
  searchTerm = '';
  selectedCategory = 'all';
  categories: string[] = [];

  // Enhanced custom category properties
  showCustomCategoryInput = false;
  customCategoryName = '';
  isAddingCustomCategory = false;
  customCategoryError = '';

  // Delete Account Properties
  showDeleteConfirmation = false;
  deleteConfirmationStep = 1; // 1 = first warning, 2 = final confirmation with password
  deletePassword = '';
  isDeletingAccount = false;

  // Predefined categories that will always be available
  private defaultCategories = [
    'Electronics', 
    'Clothing', 
    'Food & Beverages', 
    'Books', 
    'Home & Garden', 
    'Sports', 
    'Toys', 
    'Beauty & Health',
    'Automotive',
    'Office Supplies',
    'Other'
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private orderService: OrderService,
    private productService: ProductService,
    private http: HttpClient,
    public router: Router
  ) {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      username: [''],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      address: ['', [Validators.required, Validators.minLength(10)]],
      email: [{value: '', disabled: true}]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Initialize categories with default values
    this.initializeCategories();
  }

  ngOnInit(): void {
    this.loadUserProfile();
    if (this.user?.userType === 'seller') {
      this.loadSellerInventory();
    } else {
      this.loadCustomerOrders();
    }
  }

  /**
   * Initialize categories with default predefined categories
   */
  initializeCategories(): void {
    this.categories = [...this.defaultCategories];
  }

  loadUserProfile(): void {
    this.user = this.authService.getCurrentUser();
    if (!this.user) {
      this.router.navigate(['/login']);
      return;
    }

    const currentUserType = this.user.userType;
    console.log('Loading profile for user type:', currentUserType);

    // Populate the form with user data
    this.profileForm.patchValue({
      firstName: this.user.firstName || '',
      lastName: this.user.lastName || '',
      username: this.user.username || '',
      phone: this.user.phone || '',
      address: this.user.address || '',
      email: this.user.email || ''
    });
  }

  // ============================================================================
  // DELETE ACCOUNT METHODS
  // ============================================================================

  /**
   * Initiate account deletion process
   */
  deleteAccount(): void {
    this.showDeleteConfirmation = true;
    this.deleteConfirmationStep = 1;
    this.deletePassword = '';
    this.clearMessages();
  }

  /**
   * Proceed to password confirmation step
   */
  proceedToPasswordConfirmation(): void {
    this.deleteConfirmationStep = 2;
  }

  /**
   * Go back to first confirmation step
   */
  goBackToFirstStep(): void {
    this.deleteConfirmationStep = 1;
    this.deletePassword = '';
    this.clearMessages();
  }

  /**
   * Cancel account deletion process
   */
  cancelAccountDeletion(): void {
    this.showDeleteConfirmation = false;
    this.deleteConfirmationStep = 1;
    this.deletePassword = '';
    this.clearMessages();
  }

  /**
   * Show final confirmation and proceed with deletion
   */
  confirmAccountDeletion(): void {
    if (!this.deletePassword.trim()) {
      this.errorMessage = 'Please enter your password to confirm deletion';
      setTimeout(() => this.clearMessages(), 3000);
      return;
    }

    // Show final confirmation dialog
    const userType = this.user?.userType === 'customer' ? 'customer' : 'seller';
    const finalMessage = `This will permanently delete your ${userType} account and ALL associated data including:

${userType === 'customer' ? 
  'â€¢ Your profile information\nâ€¢ Order history\nâ€¢ Saved addresses' : 
  'â€¢ Your profile information\nâ€¢ All your products\nâ€¢ All orders related to your products\nâ€¢ Shop information'}

This action CANNOT be undone. Are you absolutely certain?`;

    if (confirm(finalMessage)) {
      this.performAccountDeletion();
    }
  }

  /**
   * Perform the actual account deletion
   */
  performAccountDeletion(): void {
    this.isDeletingAccount = true;
    this.clearMessages();

    const deleteData = {
      password: this.deletePassword,
      confirmDelete: true
    };

    this.authService.deleteAccount(deleteData).subscribe({
      next: (response) => {
        this.isDeletingAccount = false;
        
        if (response.success) {
          // Show success message briefly before redirect
          alert(`Account deleted successfully. You will be redirected to the login page.`);
          
          // AuthService will automatically logout and redirect
          // No need to do anything else here
        } else {
          this.errorMessage = response.error || 'Failed to delete account';
          this.showDeleteConfirmation = false;
          setTimeout(() => this.clearMessages(), 5000);
        }
      },
      error: (error) => {
        this.isDeletingAccount = false;
        console.error('Account deletion error:', error);
        
        let errorMessage = 'Failed to delete account. Please try again.';
        
        if (error.error?.error) {
          errorMessage = error.error.error;
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.errorMessage = errorMessage;
        this.showDeleteConfirmation = false;
        setTimeout(() => this.clearMessages(), 5000);
      }
    });
  }

  // ============================================================================
  // ENHANCED CATEGORY MANAGEMENT METHODS
  // ============================================================================

  /**
   * Handle category selection change - Enhanced version
   */
  onCategoryChange(): void {
    console.log('Category changed to:', this.selectedCategory);
    this.clearCustomCategoryError();
    
    if (this.selectedCategory === 'Other') {
      console.log('Showing custom category input');
      this.showCustomCategoryInput = true;
      this.customCategoryName = '';
      // Don't filter inventory yet, wait for custom category input
    } else {
      console.log('Hiding custom category input');
      this.hideCustomCategoryInput();
      this.filterInventory();
    }
  }

  /**
   * Hide custom category input and reset state
   */
  hideCustomCategoryInput(): void {
    this.showCustomCategoryInput = false;
    this.customCategoryName = '';
    this.clearCustomCategoryError();
  }

  /**
   * Clear custom category error message
   */
  clearCustomCategoryError(): void {
    this.customCategoryError = '';
  }

  /**
   * Validate custom category name
   */
  validateCustomCategory(categoryName: string): { isValid: boolean; error: string } {
    const trimmedName = categoryName.trim();
    
    if (!trimmedName) {
      return { isValid: false, error: 'Please enter a category name' };
    }

    if (trimmedName.length < 2) {
      return { isValid: false, error: 'Category name must be at least 2 characters long' };
    }

    if (trimmedName.length > 50) {
      return { isValid: false, error: 'Category name must be less than 50 characters' };
    }

    // Check for special characters (allow only letters, numbers, spaces, hyphens, and ampersands)
    const validNamePattern = /^[a-zA-Z0-9\s&\-]+$/;
    if (!validNamePattern.test(trimmedName)) {
      return { isValid: false, error: 'Category name can only contain letters, numbers, spaces, hyphens, and &' };
    }

    // Check if category already exists (case-insensitive)
    const existingCategory = this.categories.find(
      cat => cat.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingCategory) {
      return { isValid: false, error: 'This category already exists' };
    }

    return { isValid: true, error: '' };
  }

  /**
   * Add a new custom category - Enhanced version
   */
  addCustomCategory(): void {
    const validation = this.validateCustomCategory(this.customCategoryName);
    
    if (!validation.isValid) {
      this.customCategoryError = validation.error;
      return;
    }

    const categoryName = this.customCategoryName.trim();
    this.isAddingCustomCategory = true;

    try {
      // Add the new category to the list
      // Insert before "Other" to keep "Other" at the end
      const otherIndex = this.categories.indexOf('Other');
      if (otherIndex > -1) {
        this.categories.splice(otherIndex, 0, categoryName);
      } else {
        // If "Other" is not found, add at the end and then add "Other"
        this.categories.push(categoryName);
        if (!this.categories.includes('Other')) {
          this.categories.push('Other');
        }
      }

      // Sort categories alphabetically (keeping 'Other' at the end)
      this.sortCategories();

      // Set the new category as selected
      this.selectedCategory = categoryName;
      this.hideCustomCategoryInput();

      // Filter inventory with the new category
      this.filterInventory();

      this.successMessage = `Category "${categoryName}" added successfully`;
      setTimeout(() => this.clearMessages(), 3000);

    } catch (error) {
      console.error('Error adding custom category:', error);
      this.customCategoryError = 'Failed to add category. Please try again.';
    } finally {
      this.isAddingCustomCategory = false;
    }
  }

  /**
   * Cancel adding custom category - Enhanced version
   */
  cancelCustomCategory(): void {
    this.hideCustomCategoryInput();
    this.selectedCategory = 'all';
    this.filterInventory();
  }

  /**
   * Sort categories alphabetically while keeping 'Other' at the end
   */
  sortCategories(): void {
    const otherCategory = this.categories.filter(cat => cat === 'Other');
    const regularCategories = this.categories.filter(cat => cat !== 'Other');
    
    regularCategories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    
    this.categories = [...regularCategories, ...otherCategory];
  }

  /**
   * Handle Enter key press in custom category input - Enhanced version
   */
  onCustomCategoryKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addCustomCategory();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelCustomCategory();
    }
  }

  /**
   * Handle input change in custom category field
   */
  onCustomCategoryInput(): void {
    // Clear error when user starts typing
    this.clearCustomCategoryError();
    
    // Optional: Real-time validation feedback
    if (this.customCategoryName.trim().length > 0) {
      const validation = this.validateCustomCategory(this.customCategoryName);
      if (!validation.isValid && this.customCategoryName.trim().length > 2) {
        this.customCategoryError = validation.error;
      }
    }
  }

  /**
   * Check if a custom category can be added
   */
  canAddCustomCategory(): boolean {
    return this.customCategoryName.trim().length >= 2 && !this.isAddingCustomCategory;
  }

  // ============================================================================
  // INVENTORY MANAGEMENT METHODS (For Sellers)
  // ============================================================================

  loadSellerInventory(): void {
    if (!this.user?.id || !this.isSeller()) {
      this.inventoryErrorMessage = 'Access denied or user not found.';
      return;
    }

    this.isLoadingInventory = true;
    this.inventoryErrorMessage = '';

    this.productService.getProductsBySeller(this.user.id).subscribe({
      next: (products) => {
        this.isLoadingInventory = false;
        this.inventoryItems = products.map(product => ({
          ...product,
          stockStatus: this.getStockStatus(product.quantity),
          lowStock: product.quantity <= this.lowStockThreshold
        }));
        
        this.extractCategories();
        this.filterInventory();
        console.log('Seller inventory loaded:', this.inventoryItems);
      },
      error: (error) => {
        this.isLoadingInventory = false;
        console.error('Error loading inventory:', error);
        this.inventoryErrorMessage = 'Failed to load inventory. Please try again.';
      }
    });
  }

  /**
   * Extract categories from inventory items and combine with default categories
   */
  extractCategories(): void {
    // Get unique categories from inventory items
    const inventoryCategories = [...new Set(this.inventoryItems.map(item => item.category))]
      .filter(category => category && category.trim() !== ''); // Filter out empty/null categories
    
    // Combine default categories with inventory categories, removing duplicates
    const allCategories = [...this.defaultCategories];
    
    // Add inventory categories that are not in default categories
    inventoryCategories.forEach(category => {
      if (!allCategories.some(defaultCat => 
        defaultCat.toLowerCase() === category.toLowerCase()
      )) {
        // Insert before "Other"
        const otherIndex = allCategories.indexOf('Other');
        if (otherIndex > -1) {
          allCategories.splice(otherIndex, 0, category);
        } else {
          allCategories.push(category);
        }
      }
    });
    
    this.categories = allCategories;
    
    // Sort categories alphabetically for better UX (keeping 'Other' at the end)
    this.sortCategories();
  }

  getStockStatus(quantity: number): 'in-stock' | 'low-stock' | 'out-of-stock' {
    if (quantity === 0) return 'out-of-stock';
    if (quantity <= this.lowStockThreshold) return 'low-stock';
    return 'in-stock';
  }

  filterInventory(): void {
    let filtered = [...this.inventoryItems];

    // Filter by stock status
    if (this.selectedStockFilter !== 'all') {
      filtered = filtered.filter(item => item.stockStatus === this.selectedStockFilter);
    }

    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === this.selectedCategory);
    }

    // Filter by search term
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
      );
    }

    this.filteredInventory = filtered;
    this.currentPage = 1; // Reset to first page when filtering
  }

  clearInventoryFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.selectedStockFilter = 'all';
    this.hideCustomCategoryInput();
    this.filterInventory();
  }

  // Stock Management Methods
  startEditingStock(productId: string, currentQuantity: number): void {
    this.editingStock[productId] = true;
    this.stockUpdates[productId] = currentQuantity;
  }

  cancelEditingStock(productId: string): void {
    this.editingStock[productId] = false;
    delete this.stockUpdates[productId];
  }

  updateStock(product: InventoryItem): void {
    const newQuantity = this.stockUpdates[product.id];
    
    if (newQuantity < 0) {
      this.errorMessage = 'Stock quantity cannot be negative';
      setTimeout(() => this.clearMessages(), 3000);
      return;
    }

    this.isLoading = true;
    
    this.productService.updateProduct(product.id, { quantity: newQuantity }).subscribe({
      next: (updatedProduct) => {
        this.isLoading = false;
        
        // Update the inventory item
        const index = this.inventoryItems.findIndex(item => item.id === product.id);
        if (index !== -1) {
          this.inventoryItems[index] = {
            ...updatedProduct,
            stockStatus: this.getStockStatus(updatedProduct.quantity),
            lowStock: updatedProduct.quantity <= this.lowStockThreshold
          };
        }
        
        this.editingStock[product.id] = false;
        delete this.stockUpdates[product.id];
        this.filterInventory();
        
        this.successMessage = `Stock updated for ${product.name}`;
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error updating stock:', error);
        this.errorMessage = 'Failed to update stock. Please try again.';
        setTimeout(() => this.clearMessages(), 5000);
      }
    });
  }

  bulkUpdateLowStock(): void {
    const lowStockItems = this.inventoryItems.filter(item => item.stockStatus === 'low-stock');
    
    if (lowStockItems.length === 0) {
      this.errorMessage = 'No low stock items to update';
      setTimeout(() => this.clearMessages(), 3000);
      return;
    }

    if (confirm(`Update stock to 50 for all ${lowStockItems.length} low stock items?`)) {
      this.isLoading = true;
      let completed = 0;
      let failed = 0;

      lowStockItems.forEach(item => {
        this.productService.updateProduct(item.id, { quantity: 50 }).subscribe({
          next: (updatedProduct) => {
            completed++;
            const index = this.inventoryItems.findIndex(inv => inv.id === item.id);
            if (index !== -1) {
              this.inventoryItems[index] = {
                ...updatedProduct,
                stockStatus: this.getStockStatus(updatedProduct.quantity),
                lowStock: updatedProduct.quantity <= this.lowStockThreshold
              };
            }

            if (completed + failed === lowStockItems.length) {
              this.isLoading = false;
              this.filterInventory();
              this.successMessage = `${completed} items updated successfully${failed > 0 ? `, ${failed} failed` : ''}`;
              setTimeout(() => this.clearMessages(), 5000);
            }
          },
          error: (error) => {
            failed++;
            if (completed + failed === lowStockItems.length) {
              this.isLoading = false;
              this.filterInventory();
              this.errorMessage = `${failed} items failed to update${completed > 0 ? `, ${completed} updated successfully` : ''}`;
              setTimeout(() => this.clearMessages(), 5000);
            }
          }
        });
      });
    }
  }

  toggleProductAvailability(product: InventoryItem): void {
    const newAvailability = !product.isAvailable;
    
    this.productService.updateProduct(product.id, { isAvailable: newAvailability }).subscribe({
      next: (updatedProduct) => {
        const index = this.inventoryItems.findIndex(item => item.id === product.id);
        if (index !== -1) {
          this.inventoryItems[index] = {
            ...this.inventoryItems[index],
            ...updatedProduct,
            stockStatus: this.getStockStatus(updatedProduct.quantity),
            lowStock: updatedProduct.quantity <= this.lowStockThreshold
          };
        }
        this.filterInventory();
        
        const status = newAvailability ? 'available' : 'unavailable';
        this.successMessage = `${product.name} is now ${status}`;
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: (error) => {
        console.error('Error updating product availability:', error);
        this.errorMessage = 'Failed to update product availability';
        setTimeout(() => this.clearMessages(), 5000);
      }
    });
  }

  // Inventory Statistics
  getInventoryStats() {
    const total = this.inventoryItems.length;
    const inStock = this.inventoryItems.filter(item => item.stockStatus === 'in-stock').length;
    const lowStock = this.inventoryItems.filter(item => item.stockStatus === 'low-stock').length;
    const outOfStock = this.inventoryItems.filter(item => item.stockStatus === 'out-of-stock').length;
    const totalValue = this.inventoryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return { total, inStock, lowStock, outOfStock, totalValue };
  }

  getStockStatusColor(status: string): string {
    switch (status) {
      case 'in-stock': return '#28a745';
      case 'low-stock': return '#ffc107';
      case 'out-of-stock': return '#dc3545';
      default: return '#6c757d';
    }
  }

  getStockStatusText(status: string): string {
    switch (status) {
      case 'in-stock': return 'In Stock';
      case 'low-stock': return 'Low Stock';
      case 'out-of-stock': return 'Out of Stock';
      default: return 'Unknown';
    }
  }

  // Pagination for Inventory
  getInventoryTotalPages(): number {
    return Math.ceil(this.filteredInventory.length / this.itemsPerPage);
  }

  getPaginatedInventory(): InventoryItem[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredInventory.slice(startIndex, endIndex);
  }

  nextInventoryPage(): void {
    if (this.currentPage < this.getInventoryTotalPages()) {
      this.currentPage++;
    }
  }

  previousInventoryPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  // ============================================================================
  // ORDER MANAGEMENT METHODS (For Customers)
  // ============================================================================

  // Helper method to get order quantity safely
  getOrderQuantity(order: Order): number {
    // Try different properties that might contain quantity
    if (order.items && order.items.length > 0) {
      return order.items[0].quantity || 1;
    }
    // If Order model has a quantity property, use it
    return (order as any).quantity || 1;
  }

  loadCustomerOrders(): void {
    if (!this.user?.id || this.isSeller()) {
      this.orderErrorMessage = 'User not found. Please log in again.';
      return;
    }

    this.isLoadingOrders = true;
    this.orderErrorMessage = '';

    this.orderService.getCustomerOrders(this.user.id).subscribe({
      next: (response) => {
        this.isLoadingOrders = false;
        if (response.success) {
          this.customerOrders = response.orders || [];
          this.filterOrders();
          console.log('Customer orders loaded:', this.customerOrders);
        } else {
          this.orderErrorMessage = 'Failed to load orders';
        }
      },
      error: (error) => {
        this.isLoadingOrders = false;
        console.error('Error loading orders:', error);
        this.orderErrorMessage = 'Failed to load orders. Please try again.';
      }
    });
  }

  filterOrders(): void {
    if (this.selectedOrderStatus === 'all') {
      this.filteredOrders = [...this.customerOrders];
    } else {
      this.filteredOrders = this.customerOrders.filter(
        order => order.status === this.selectedOrderStatus
      );
    }
    
    // Reset to first page when filtering
    this.currentPage = 1;
  }

  getOrderCountByStatus(status: string): number {
    return this.customerOrders.filter(order => order.status === status).length;
  }

  getTotalSpent(): string {
    const total = this.customerOrders
      .filter(order => order.status === 'completed')
      .reduce((sum, order) => sum + order.totalAmount, 0);
    return total.toFixed(2);
  }

  formatOrderDate(dateString: string): string {
    return this.orderService.formatOrderDate(dateString);
  }

  getOrderStatusColor(status: string): string {
    return this.orderService.getStatusColor(status);
  }

  getOrderStatusText(status: string): string {
    return this.orderService.getStatusText(status);
  }

  viewOrderDetails(order: Order): void {
    // Navigate to order details page or show modal
    this.router.navigate(['/order-details', order.id]);
  }

  reorderItems(order: Order): void {
    // Logic to reorder the same items
    console.log('Reordering items from order:', order.id);
    
    // Navigate to product page or add items to cart
    if (order.items && order.items.length > 0) {
      // Navigate to the product page of the first item
      this.router.navigate(['/product', order.items[0].productId]);
    } else {
      // If no items found, navigate to products page
      this.router.navigate(['/products']);
    }
  }

  cancelOrder(order: Order): void {
    if (confirm('Are you sure you want to cancel this order?')) {
      this.orderService.updateOrderStatus(order.id, {
        status: 'cancelled',
        notes: 'Cancelled by customer'
      }).subscribe({
        next: (response) => {
          console.log('Order cancelled:', response);
          // Update the order status locally
          const orderIndex = this.customerOrders.findIndex(o => o.id === order.id);
          if (orderIndex !== -1) {
            this.customerOrders[orderIndex].status = 'cancelled';
            this.filterOrders();
          }
          this.successMessage = 'Order cancelled successfully';
          setTimeout(() => this.clearMessages(), 3000);
        },
        error: (error) => {
          console.error('Error cancelling order:', error);
          this.errorMessage = 'Failed to cancel order. Please try again.';
          setTimeout(() => this.clearMessages(), 5000);
        }
      });
    }
  }

  // Pagination methods
  getTotalPages(): number {
    return Math.ceil(this.filteredOrders.length / this.ordersPerPage);
  }

  nextPage(): void {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  getPaginatedOrders(): Order[] {
    const startIndex = (this.currentPage - 1) * this.ordersPerPage;
    const endIndex = startIndex + this.ordersPerPage;
    return this.filteredOrders.slice(startIndex, endIndex);
  }

  // ============================================================================
  // EXISTING METHODS (Profile, Password, etc.)
  // ============================================================================

  // Form validation methods
  passwordMatchValidator(group: FormGroup): {[key: string]: boolean} | null {
    const newPassword = group.get('newPassword');
    const confirmPassword = group.get('confirmPassword');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    this.clearMessages();
    
    if (!this.isEditMode) {
      this.loadUserProfile();
    }
  }

  togglePasswordChange(): void {
    this.isChangingPassword = !this.isChangingPassword;
    this.clearPasswordMessages();
    
    if (!this.isChangingPassword) {
      this.passwordForm.reset();
    }
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.clearMessages();
    this.clearPasswordMessages();
    
    // Reset custom category input when switching tabs
    this.hideCustomCategoryInput();
    
    // Load data when switching to specific tabs
    if (tab === 'inventory' && this.user?.userType === 'seller' && this.inventoryItems.length === 0) {
      this.loadSellerInventory();
    } else if (tab === 'orders' && this.user?.userType === 'customer' && this.customerOrders.length === 0) {
      this.loadCustomerOrders();
    }
  }

  onSubmitProfile(): void {
    if (this.profileForm.valid && this.user) {
      this.isLoading = true;
      this.clearMessages();

      const currentUserType = this.user.userType;
      const currentUserId = this.user.id;

      const updatedData = {
        firstName: this.profileForm.value.firstName,
        lastName: this.profileForm.value.lastName,
        username: this.profileForm.value.username,
        phone: this.profileForm.value.phone,
        address: this.profileForm.value.address
      };

      this.authService.updateProfile(updatedData).subscribe({
        next: (response) => {
          this.isLoading = false;
          
          if (response.success) {
            console.log('Profile updated successfully for', currentUserType);
            this.user = this.authService.getCurrentUser();
            this.isEditMode = false;
            this.successMessage = response.message || 'Profile updated successfully!';
            setTimeout(() => this.clearMessages(), 3000);
          } else {
            this.errorMessage = response.error || 'Failed to update profile. Please try again.';
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Profile update error:', error);
          
          let errorMessage = 'An unexpected error occurred. Please try again.';
          
          if (error.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.error) {
              errorMessage = error.error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.errorMessage = errorMessage;
          setTimeout(() => this.clearMessages(), 5000);
        }
      });
    } else {
      this.errorMessage = 'Please fill in all required fields correctly.';
      setTimeout(() => this.clearMessages(), 3000);
    }
  }

  onSubmitPassword(): void {
    if (this.passwordForm.valid && this.user) {
      this.isPasswordLoading = true;
      this.clearPasswordMessages();

      const passwordData = {
        currentPassword: this.passwordForm.value.currentPassword,
        newPassword: this.passwordForm.value.newPassword
      };

      this.authService.changePassword(passwordData).subscribe({
        next: (response) => {
          this.isPasswordLoading = false;
          
          if (response.success) {
            this.passwordSuccessMessage = response.message || 'Password changed successfully!';
            this.passwordForm.reset();
            this.isChangingPassword = false;
            
            setTimeout(() => {
              this.clearPasswordMessages();
            }, 3000);
          } else {
            this.passwordErrorMessage = response.error || 'Failed to change password. Please try again.';
          }
        },
        error: (error) => {
          this.isPasswordLoading = false;
          console.error('Password change error:', error);
          
          let errorMessage = 'An unexpected error occurred. Please try again.';
          
          if (error.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.error) {
              errorMessage = error.error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.passwordErrorMessage = errorMessage;
          
          setTimeout(() => {
            this.clearPasswordMessages();
          }, 5000);
        }
      });
    } else {
      if (this.passwordForm.errors?.['passwordMismatch']) {
        this.passwordErrorMessage = 'New password and confirmation do not match.';
      } else {
        this.passwordErrorMessage = 'Please fill in all password fields correctly.';
      }
      
      setTimeout(() => {
        this.clearPasswordMessages();
      }, 3000);
    }
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.customCategoryError = '';
  }

  clearPasswordMessages(): void {
    this.passwordSuccessMessage = '';
    this.passwordErrorMessage = '';
  }

  getFormError(fieldName: string): string {
    const field = this.profileForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required.`;
      }
      if (field.errors['minlength']) {
        return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters.`;
      }
      if (field.errors['pattern']) {
        return `Please enter a valid ${fieldName.toLowerCase()}.`;
      }
    }
    return '';
  }

  getPasswordError(fieldName: string): string {
    const field = this.passwordForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required.`;
      }
      if (field.errors['minlength']) {
        return 'Password must be at least 6 characters long.';
      }
    }
    
    if (fieldName === 'confirmPassword' && this.passwordForm.errors?.['passwordMismatch']) {
      return 'Passwords do not match.';
    }
    
    return '';
  }

  isFieldInvalid(formName: 'profile' | 'password', fieldName: string): boolean {
    const form = formName === 'profile' ? this.profileForm : this.passwordForm;
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  private getFieldLabel(fieldName: string): string {
    const labels: {[key: string]: string} = {
      firstName: 'First Name',
      lastName: 'Last Name',
      username: 'Username',
      phone: 'Phone Number',
      address: 'Address',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password'
    };
    return labels[fieldName] || fieldName;
  }

  navigateToOrders(): void {
    this.setActiveTab('orders');
  }

  navigateToFavorites(): void {
    this.router.navigate(['/favorites']);
  }

  navigateToAddProduct(): void {
    this.router.navigate(['/add-product']);
  }

  getUserDisplayName(): string {
    if (this.user) {
      return this.authService.getCurrentUserName();
    }
    return 'User';
  }

  getUserInitials(): string {
    if (this.user && this.user.firstName && this.user.lastName) {
      return `${this.user.firstName.charAt(0)}${this.user.lastName.charAt(0)}`.toUpperCase();
    } else if (this.user && this.user.firstName) {
      return this.user.firstName.charAt(0).toUpperCase();
    } else if (this.user && this.user.email) {
      return this.user.email.charAt(0).toUpperCase();
    }
    return 'U';
  }

  getCurrentUserType(): string {
    return this.user?.userType || 'unknown';
  }

  // Check if user is seller to show inventory tab
  isSeller(): boolean {
    return this.user?.userType === 'seller';
  }

  isCorrectUserContext(): boolean {
    if (!this.user) return false;
    
    const currentPath = this.router.url;
    const isSellerPath = currentPath.includes('seller') || currentPath.includes('dashboard');
    const isCustomer = this.user.userType === 'customer';
    const isSeller = this.user.userType === 'seller';
    
    return (isSellerPath && isSeller) || (!isSellerPath && isCustomer);
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = '/assets/default-product.png';
    }
  }
}