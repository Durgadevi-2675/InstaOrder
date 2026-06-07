// components/order-modal/order-modal.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product } from '../../models/product.model';
import { User } from '../../models/user.model';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-order-modal',
  templateUrl: './order-modal.component.html',
  styleUrls: ['./order-modal.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class OrderModalComponent implements OnInit {
  @Input() product: Product | null = null;
  @Input() currentUser: User | null = null;
  @Input() isVisible: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() orderPlaced = new EventEmitter<any>();

  orderForm: FormGroup;
  isSubmitting = false;
  formErrors: { [key: string]: string } = {};

  constructor(
    private fb: FormBuilder,
    private orderService: OrderService
  ) {
    this.orderForm = this.fb.group({
      quantity: [1, [Validators.required, Validators.min(1)]],
      customerName: ['', [Validators.required, Validators.minLength(2)]],
      customerPhone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      customerAddress: ['', [Validators.required, Validators.minLength(10)]],
      customerEmail: [''],
      specialInstructions: [''],
      paymentMethod: ['cash_on_delivery', [Validators.required]]
    });

    // Subscribe to form changes for real-time validation
    this.orderForm.valueChanges.subscribe(() => {
      this.updateFormErrors();
    });
  }

  ngOnInit(): void {
    if (this.currentUser) {
      // Pre-fill form with user data
      this.orderForm.patchValue({
        customerName: `${this.currentUser.firstName} ${this.currentUser.lastName}`,
        customerPhone: this.currentUser.phone || '',
        customerAddress: this.currentUser.address || '',
        customerEmail: this.currentUser.email || ''
      });
    }
  }

  updateFormErrors(): void {
    this.formErrors = {};
    const controls = this.orderForm.controls;

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
            this.formErrors[key] = `${this.getFieldDisplayName(key)} must be at least ${errors['min'].min}`;
          } else if (errors['pattern']) {
            this.formErrors[key] = `${this.getFieldDisplayName(key)} format is invalid`;
          } else if (errors['max']) {
            this.formErrors[key] = `Maximum available quantity is ${errors['max'].max}`;
          }
        }
      }
    });
  }

  getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      'quantity': 'Quantity',
      'customerName': 'Full name',
      'customerPhone': 'Phone number',
      'customerAddress': 'Address',
      'customerEmail': 'Email',
      'specialInstructions': 'Special instructions',
      'paymentMethod': 'Payment method'
    };
    return displayNames[fieldName] || fieldName;
  }

  // Validate quantity against available stock
  onQuantityChange(): void {
    const quantityControl = this.orderForm.get('quantity');
    const currentQuantity = quantityControl?.value;
    
    if (this.product && currentQuantity > this.product.quantity) {
      quantityControl?.setErrors({ 'max': { max: this.product.quantity, actual: currentQuantity } });
    }
    
    this.updateFormErrors();
  }

  getTotalAmount(): number {
    if (!this.product) return 0;
    const quantity = this.orderForm.get('quantity')?.value || 1;
    return this.product.price * quantity;
  }

  formatPrice(price: number): string {
    return this.orderService.formatPrice(price);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.orderForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasFieldError(fieldName: string): boolean {
    return !!this.formErrors[fieldName];
  }

  getFieldError(fieldName: string): string {
    return this.formErrors[fieldName] || '';
  }

  onSubmit(): void {
    console.log('Order form submitted');
    console.log('Form valid:', this.orderForm.valid);
    console.log('Current user:', this.currentUser);
    console.log('Product:', this.product);
    
    if (this.orderForm.valid && this.product && this.currentUser && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formValue = this.orderForm.value;
      
      // Check if we have the sellerId from the product
      if (!this.product.sellerId) {
        this.showError('Product seller information is missing. Please try again.');
        this.isSubmitting = false;
        return;
      }
      
      // FIXED: Create the order data matching the backend expected structure
      const orderData = {
        customerId: this.currentUser.id,
        productId: this.product.id,
        sellerId: this.product.sellerId,
        quantity: formValue.quantity,
        customerInfo: {
          name: formValue.customerName,
          phone: formValue.customerPhone,
          email: formValue.customerEmail || '',
          address: formValue.customerAddress
        },
        specialInstructions: formValue.specialInstructions || '',
        paymentMethod: formValue.paymentMethod
      };

      console.log('Sending order data:', orderData);

      this.orderService.createOrder(orderData).subscribe({
        next: (response) => {
          console.log('Order created successfully:', response);
          this.isSubmitting = false;
          
          // FIXED: Show proper success message
          this.showSuccess('Your order is successfully placed!');
          this.orderPlaced.emit(response.order);
          this.close();
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Error placing order:', error);
          
          // Better error handling
          let errorMessage = 'Failed to place order. Please try again.';
          
          if (error.error && typeof error.error === 'object') {
            if (error.error.error) {
              errorMessage = error.error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          } else if (error.message) {
            errorMessage = error.message;
          } else if (typeof error.error === 'string') {
            errorMessage = error.error;
          }
          
          // Add status code information for debugging
          if (error.status) {
            console.error('HTTP Status:', error.status);
            if (error.status === 0) {
              errorMessage = 'Unable to connect to server. Please check if the backend is running.';
            } else if (error.status === 404) {
              errorMessage = 'Order service not found. Please contact support.';
            } else if (error.status === 500) {
              errorMessage = 'Server error occurred. Please try again later.';
            }
          }
          
          this.showError(errorMessage);
        }
      });
    } else {
      console.log('Form validation failed');
      // Mark all fields as touched to show validation errors
      Object.keys(this.orderForm.controls).forEach(key => {
        this.orderForm.get(key)?.markAsTouched();
      });
      this.updateFormErrors();
      
      // Show specific error messages
      if (!this.currentUser) {
        this.showError('User authentication required');
      } else if (!this.product) {
        this.showError('Product information is missing');
      } else if (!this.orderForm.valid) {
        this.showError('Please fill in all required fields correctly');
      }
    }
  }

  close(): void {
    this.closeModal.emit();
  }

  // IMPROVED: Better user feedback methods
  private showSuccess(message: string): void {
    console.log('Success:', message);
    
    // Create a better looking success notification
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <div class="success-icon">✓</div>
        <div class="success-message">${message}</div>
      </div>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .success-icon {
        font-size: 18px;
        font-weight: bold;
      }
      .success-message {
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  private showError(message: string): void {
    console.error('Error:', message);
    
    // Create a better looking error notification
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <div class="error-icon">⚠</div>
        <div class="error-message">${message}</div>
      </div>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }
}