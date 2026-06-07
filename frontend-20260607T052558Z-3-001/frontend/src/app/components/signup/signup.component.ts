import { Component, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule]
})
export class SignupComponent implements OnInit, AfterViewInit {
  userType: 'customer' | 'seller' = 'customer';
  currentView: 'login' | 'signup' = 'login';
  loginForm: FormGroup;
  signupForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.signupForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      address: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['']
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.authService.initializeGoogleAuth();
  }

  switchUserType(type: 'customer' | 'seller') {
    this.userType = type;
  }

  switchView(view: 'login' | 'signup') {
    this.currentView = view;
  }

  onLogin() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      // TODO: Handle login logic
      setTimeout(() => {
        this.isLoading = false;
        alert('Login successful!');
      }, 1000);
    }
  }

  onSignup() {
    if (this.signupForm.valid) {
      this.isLoading = true;
      // TODO: Handle signup logic
      setTimeout(() => {
        this.isLoading = false;
        alert('Signup successful!');
      }, 1000);
    }
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

  getFormErrors(form: FormGroup, field: string): string[] {
    const control = form.get(field);
    const errors: string[] = [];
    if (control && control.errors) {
      for (const key in control.errors) {
        if (key === 'required') errors.push('This field is required');
        if (key === 'email') errors.push('Invalid email format');
        if (key === 'pattern') errors.push('Invalid format');
        if (key === 'minlength') errors.push(`Minimum ${control.errors['minlength'].requiredLength} characters required`);
      }
    }
    return errors;
  }

  passwordMatchValidator(group: AbstractControl): { [key: string]: boolean } | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}