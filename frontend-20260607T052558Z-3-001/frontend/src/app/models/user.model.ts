// user.model.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  phone: string;
  address: string;
  userType: 'customer' | 'seller';
}

export interface LoginRequest {
  email: string;
  password: string;
  userType: 'customer' | 'seller'; // Add userType to login request
}

export interface SignupRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword?: string;
  address: string;
  userType: 'customer' | 'seller'; // Add userType to signup request
}

// NEW: Forgot Password Request Interface
export interface ForgotPasswordRequest {
  email: string;
  userType: 'customer' | 'seller';
}

// NEW: Forgot Password Response Interface
export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

// Server response format based on your server.py
export interface AuthResponse {
  message: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    userType: string;
    address?: string;
    businessName?: string;
    businessType?: string;
    dateOfBirth?: string;
  };
  userId?: string;
  userType?: string;
  error?: string;
}

// Profile response format
export interface ProfileResponse {
  success: boolean;
  message?: string;
  error?: string;
  customer: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    userType: string;
  };
}