import { Component, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { LoginRequest, SignupRequest, ForgotPasswordRequest } from '../../models/user.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class LoginComponent implements OnInit, AfterViewInit {
  loginForm: FormGroup;
  signupForm: FormGroup;
  forgotPasswordForm: FormGroup;
  resetPasswordForm: FormGroup;
  currentView: 'login' | 'signup' | 'forgot-password' | 'reset-password' = 'login';
  userType: 'customer' | 'seller' = 'customer';
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  resetToken = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    public router: Router, // Changed from private to public
    private route: ActivatedRoute
  ) {
    // Initialize login form
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Initialize signup form
    this.signupForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      address: ['']
    }, { validator: this.passwordMatchValidator });

    // Initialize forgot password form
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    // Initialize reset password form
    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmNewPassword: ['', [Validators.required]]
    }, { validator: this.newPasswordMatchValidator });
  }

  ngOnInit(): void {
    // Check if we're on reset-password route and get token
    this.route.queryParams.subscribe(params => {
      if (params['token'] && params['userType']) {
        this.resetToken = params['token'];
        this.userType = params['userType'];
        this.currentView = 'reset-password';
      }
    });
  }

  ngAfterViewInit(): void {
    this.authService.initializeGoogleAuth();
  }

  onGoogleSignIn(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.authService.signInWithGoogle(this.userType)
      .then(() => {
        this.isLoading = false;
      })
      .catch((error) => {
        this.isLoading = false;
        this.errorMessage = 'Google sign-in failed. Please try again.';
        console.error('Google sign-in error:', error);
      });
  }

  // Close button handler
  onClose(): void {
    this.router.navigate(['/']);
  }

  // Alternative method: Add a public method to navigate back to login
  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  // Match password & confirmPassword
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  // Match new password & confirmNewPassword
  newPasswordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword')?.value;
    const confirmNewPassword = form.get('confirmNewPassword')?.value;
    return newPassword === confirmNewPassword ? null : { passwordMismatch: true };
  }

  // Switch between login/signup/forgot-password/reset-password
  switchView(view: 'login' | 'signup' | 'forgot-password' | 'reset-password'): void {
    this.currentView = view;
    this.errorMessage = '';
    this.successMessage = '';
    this.resetForms();
  }

  // Switch user type (customer/seller)
  switchUserType(type: 'customer' | 'seller'): void {
    this.userType = type;
    this.errorMessage = '';
    this.successMessage = '';
  }

  // Clear form fields
  resetForms(): void {
    this.loginForm.reset();
    this.signupForm.reset();
    this.forgotPasswordForm.reset();
    this.resetPasswordForm.reset();
  }

  // Login
  onLogin(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const credentials: LoginRequest = {
        ...this.loginForm.value,
        userType: this.userType
      };

      this.authService.login(credentials).subscribe({
        next: () => {
          this.isLoading = false;
          const redirectPath = this.userType === 'seller' ? '/seller-dashboard' : '/products';
          this.router.navigate([redirectPath]);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Login failed. Please try again.';
        }
      });
    }
  }

  // Signup
  onSignup(): void {
    if (this.signupForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const userData: SignupRequest = {
        ...this.signupForm.value,
        userType: this.userType
      };
      delete (userData as any).confirmPassword;

      this.authService.signup(userData).subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Account created successfully! Please login.';
          setTimeout(() => {
            this.switchView('login');
          }, 2000);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Signup failed. Please try again.';
        }
      });
    }
  }

  // Forgot Password
  onForgotPassword(): void {
    if (this.forgotPasswordForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const forgotPasswordData: ForgotPasswordRequest = {
        ...this.forgotPasswordForm.value,
        userType: this.userType
      };

      this.authService.forgotPassword(forgotPasswordData).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = response.message || 'Password reset link sent to your email!';
          setTimeout(() => {
            this.switchView('login');
          }, 3000);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to send reset link. Please try again.';
        }
      });
    }
  }

  // Reset Password method
  onResetPassword(): void {
    if (this.resetPasswordForm.valid && this.resetToken) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const resetData = {
        token: this.resetToken,
        newPassword: this.resetPasswordForm.get('newPassword')?.value,
        userType: this.userType
      };

      this.authService.resetPassword(resetData).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = response.message || 'Password reset successfully!';
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Failed to reset password. Please try again.';
        }
      });
    }
  }

  // Extract form field validation errors
  getFormErrors(form: FormGroup, field: string): string[] {
    const control = form.get(field);
    const errors: string[] = [];

    if (control && control.errors && control.touched) {
      for (const errorName in control.errors) {
        if (errorName === 'required') {
          errors.push('This field is required');
        } else if (errorName === 'email') {
          errors.push('Invalid email format');
        } else if (errorName === 'minlength') {
          errors.push(`Minimum length is ${control.errors['minlength'].requiredLength}`);
        } else if (errorName === 'maxlength') {
          errors.push(`Maximum length is ${control.errors['maxlength'].requiredLength}`);
        } else if (errorName === 'pattern') {
          errors.push('Invalid format');
        } else {
          errors.push('Invalid input');
        }
      }
    }

    return errors;
  }
}