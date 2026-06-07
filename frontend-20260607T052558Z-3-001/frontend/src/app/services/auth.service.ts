// Enhanced auth.service.ts with separated customer/seller management and delete account functionality
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { 
  LoginRequest, 
  SignupRequest, 
  ForgotPasswordRequest, 
  ForgotPasswordResponse, 
  User, 
  AuthResponse 
} from '../models/user.model';

// Add interfaces for profile updates
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  address?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  customer?: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    phone: string;
    address: string;
    email: string;
    userType: string;
  };
  seller?: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    phone: string;
    address: string;
    email: string;
    userType: string;
  };
  error?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Add interfaces for account deletion
export interface DeleteAccountRequest {
  password?: string;
  confirmDelete?: boolean;
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
  details?: {
    customer_deleted?: number;
    seller_deleted?: number;
    products_deleted?: number;
    orders_deleted?: number;
  };
  error?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // FIXED: Add separate storage keys for different user types
  private readonly CUSTOMER_STORAGE_KEY = 'currentCustomer';
  private readonly SELLER_STORAGE_KEY = 'currentSeller';
  private readonly AUTH_TOKEN_KEY = 'authToken';

  constructor(private http: HttpClient, private router: Router) {
    // Check if user is already logged in
    this.loadCurrentUser();
  }

  // Helper method for headers
  private getHeaders(): { [header: string]: string } {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // FIXED: Load user based on current context
  private loadCurrentUser(): void {
    // First check if there's a general currentUser (for backward compatibility)
    const generalUser = localStorage.getItem('currentUser');
    if (generalUser) {
      const user = JSON.parse(generalUser);
      this.currentUserSubject.next(user);
      
      // Migrate to new storage system
      this.migrateUserStorage(user);
      return;
    }

    // Check specific storage based on current route or last logged in user type
    const currentPath = window.location.pathname;
    if (currentPath.includes('seller') || currentPath.includes('dashboard')) {
      const sellerUser = localStorage.getItem(this.SELLER_STORAGE_KEY);
      if (sellerUser) {
        this.currentUserSubject.next(JSON.parse(sellerUser));
      }
    } else {
      const customerUser = localStorage.getItem(this.CUSTOMER_STORAGE_KEY);
      if (customerUser) {
        this.currentUserSubject.next(JSON.parse(customerUser));
      }
    }
  }

  // FIXED: Migrate old storage to new system
  private migrateUserStorage(user: User): void {
    if (user.userType === 'customer') {
      localStorage.setItem(this.CUSTOMER_STORAGE_KEY, JSON.stringify(user));
    } else if (user.userType === 'seller') {
      localStorage.setItem(this.SELLER_STORAGE_KEY, JSON.stringify(user));
    }
    
    // Remove old general storage
    localStorage.removeItem('currentUser');
  }

  // FIXED: Store user in appropriate storage
  private storeUser(user: User): void {
    const storageKey = user.userType === 'customer' ? this.CUSTOMER_STORAGE_KEY : this.SELLER_STORAGE_KEY;
    localStorage.setItem(storageKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  // FIXED: Get user from appropriate storage
  private getStoredUser(userType: 'customer' | 'seller'): User | null {
    const storageKey = userType === 'customer' ? this.CUSTOMER_STORAGE_KEY : this.SELLER_STORAGE_KEY;
    const userData = localStorage.getItem(storageKey);
    return userData ? JSON.parse(userData) : null;
  }

  initializeGoogleAuth(): Promise<any> {
    return new Promise((resolve) => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: '232235901325-6ct4838vv39jjbvti2qfha8tk8q26vin.apps.googleusercontent.com',
          callback: this.handleGoogleSignIn.bind(this),
          auto_select: false,
          cancel_on_tap_outside: true
        });
        resolve(window.google);
      } else {
        const checkGoogle = setInterval(() => {
          if (window.google) {
            clearInterval(checkGoogle);
            window.google.accounts.id.initialize({
              client_id: '232235901325-6ct4838vv39jjbvti2qfha8tk8q26vin.apps.googleusercontent.com',
              callback: this.handleGoogleSignIn.bind(this),
              auto_select: false,
              cancel_on_tap_outside: true
            });
            resolve(window.google);
          }
        }, 100);
      }
    });
  }

  signInWithGoogle(userType: 'customer' | 'seller'): Promise<any> {
    return new Promise((resolve, reject) => {
      this.initializeGoogleAuth().then(() => {
        sessionStorage.setItem('googleAuthUserType', userType);
        
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            this.showGooglePopup(userType).then(resolve).catch(reject);
          }
        });
      });
    });
  }

  private showGooglePopup(userType: 'customer' | 'seller'): Promise<any> {
    return new Promise((resolve, reject) => {
      sessionStorage.setItem('googleAuthUserType', userType);
      
      window.google.accounts.oauth2.initTokenClient({
        client_id: '232235901325-6ct4838vv39jjbvti2qfha8tk8q26vin.apps.googleusercontent.com',
        scope: 'email profile',
        callback: (response: any) => {
          if (response.error) {
            reject(response);
          } else {
            this.getUserInfoFromGoogle(response.access_token, userType)
              .then(resolve)
              .catch(reject);
          }
        }
      }).requestAccessToken();
    });
  }

  private getUserInfoFromGoogle(accessToken: string, userType: 'customer' | 'seller'): Promise<any> {
    return fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    .then(response => response.json())
    .then(userInfo => {
      return this.processGoogleUser(userInfo, userType);
    });
  }

  private handleGoogleSignIn(response: any): void {
    const userType = sessionStorage.getItem('googleAuthUserType') || 'customer';
    sessionStorage.removeItem('googleAuthUserType');
    
    const payload = this.decodeJWT(response.credential);
    this.processGoogleUser(payload, userType as 'customer' | 'seller');
  }

  private decodeJWT(token: string): any {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }

  private processGoogleUser(googleUser: any, userType: 'customer' | 'seller'): Promise<any> {
    const googleAuthData = {
      email: googleUser.email,
      firstName: googleUser.given_name || '',
      lastName: googleUser.family_name || '',
      googleId: googleUser.sub || googleUser.id,
      picture: googleUser.picture || '',
      userType: userType
    };

    return this.http.post<any>(`${this.apiUrl}/auth/google-auth`, googleAuthData)
      .pipe(
        tap(response => {
          if (response.user) {
            const user: User = {
              id: response.user.id,
              email: response.user.email,
              firstName: response.user.firstName,
              lastName: response.user.lastName,
              username: response.user.username,
              phone: response.user.phone || '',
              address: response.user.address || '',
              userType: response.user.userType
            };
            
            // FIXED: Use new storage method
            this.storeUser(user);
            
            const redirectPath = userType === 'seller' ? '/seller-dashboard' : '/products';
            this.router.navigate([redirectPath]);
          }
        })
      ).toPromise();
  }

  login(credentials: LoginRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          console.log('Login response:', response);
          
          if (response.user) {
            const user: User = {
              id: response.user.id,
              email: response.user.email,
              firstName: response.user.firstName,
              lastName: response.user.lastName,
              username: response.user.username,
              phone: response.user.phone,
              address: response.user.address || '',
              userType: response.user.userType || credentials.userType
            };
            
            console.log('Processed user:', user);
            // FIXED: Use new storage method
            this.storeUser(user);
          }
        })
      );
  }

  signup(userData: SignupRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/signup`, userData)
      .pipe(
        tap(response => {
          console.log('Signup response:', response);
          
          if (response.userId) {
            const user: User = {
              id: response.userId,
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              phone: userData.phone,
              address: userData.address,
              userType: userData.userType
            };
            
            console.log('Processed signup user:', user);
            // FIXED: Use new storage method
            this.storeUser(user);
          }
        })
      );
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/auth/forgot-password`, data)
      .pipe(
        tap(response => {
          console.log('Forgot password response:', response);
        })
      );
  }

  resetPassword(data: { token: string; newPassword: string; userType: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/reset-password`, data)
      .pipe(
        tap(response => {
          console.log('Reset password response:', response);
        })
      );
  }

  // FIXED: Update Profile method with user type isolation
  updateProfile(profileData: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    const currentUser = this.getCurrentUser();
    
    if (!currentUser || !currentUser.id) {
      throw new Error('User must be logged in to update profile');
    }

    const userType = currentUser.userType;
    const userId = currentUser.id;
    const endpoint = `${this.apiUrl}/${userType}/profile/${userId}`;

    return this.http.put<UpdateProfileResponse>(endpoint, profileData)
      .pipe(
        tap(response => {
          console.log('Update profile response:', response);
          
          // FIXED: Only update the specific user type's data
          if (response.success && (response.customer || response.seller)) {
            const userData = response.customer || response.seller;
            const updatedUser: User = {
              ...currentUser,
              firstName: userData!.firstName,
              lastName: userData!.lastName,
              username: userData!.username,
              phone: userData!.phone,
              address: userData!.address
            };
            
            // FIXED: Store only in the appropriate user type storage
            this.storeUser(updatedUser);
          }
        })
      );
  }

  changePassword(changePasswordData: ChangePasswordRequest): Observable<ChangePasswordResponse> {
    const currentUser = this.getCurrentUser();
    
    if (!currentUser || !currentUser.id) {
      throw new Error('User must be logged in to change password');
    }

    const userType = currentUser.userType;
    const userId = currentUser.id;
    const endpoint = `${this.apiUrl}/${userType}/change-password/${userId}`;

    return this.http.put<ChangePasswordResponse>(endpoint, changePasswordData)
      .pipe(
        tap(response => {
          console.log('Change password response:', response);
        })
      );
  }

  // NEW: Delete Account method
  deleteAccount(deleteData: DeleteAccountRequest): Observable<DeleteAccountResponse> {
    const currentUser = this.getCurrentUser();
    
    if (!currentUser || !currentUser.id) {
      throw new Error('User must be logged in to delete account');
    }
    
    const userType = currentUser.userType;
    const userId = currentUser.id;
    const endpoint = `${userType}/delete-account/${userId}`;
    
    // Use the HTTP client directly with proper options for DELETE with body
    return this.http.delete<DeleteAccountResponse>(`${this.apiUrl}/${endpoint}`, {
      body: deleteData,
      headers: this.getHeaders()
    }).pipe(
      tap(response => {
        console.log('Delete account response:', response);
        
        if (response.success) {
          // Automatically logout after successful deletion
          this.logout();
        }
      })
    );
  }

  // FIXED: Method to update current user with user type isolation
  updateCurrentUser(user: User): void {
    this.storeUser(user);
  }

  // FIXED: Logout with proper cleanup of both storage types
  logout(): void {
    localStorage.removeItem(this.CUSTOMER_STORAGE_KEY);
    localStorage.removeItem(this.SELLER_STORAGE_KEY);
    localStorage.removeItem('currentUser'); // Remove legacy storage
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // FIXED: Get current user with context awareness
  getCurrentUser(): User | null {
    const user = this.currentUserSubject.value;
    console.log('Current user from service:', user);
    return user;
  }

  // FIXED: Switch user context (useful for testing or admin purposes)
  switchUserContext(userType: 'customer' | 'seller'): User | null {
    const user = this.getStoredUser(userType);
    if (user) {
      this.currentUserSubject.next(user);
    }
    return user;
  }

  // FIXED: Check if a specific user type is logged in
  isUserTypeLoggedIn(userType: 'customer' | 'seller'): boolean {
    return !!this.getStoredUser(userType);
  }

  // FIXED: Get user data for a specific user type
  getUserByType(userType: 'customer' | 'seller'): User | null {
    return this.getStoredUser(userType);
  }

  getCurrentUserName(): string {
    const user = this.getCurrentUser();
    console.log('Getting username for:', user);
    
    if (user) {
      // Priority order for displaying name
      if (user.username) {
        console.log('Using username:', user.username);
        return user.username;
      }
      if (user.firstName && user.lastName) {
        const fullName = `${user.firstName} ${user.lastName}`;
        console.log('Using full name:', fullName);
        return fullName;
      }
      if (user.firstName) {
        console.log('Using firstName:', user.firstName);
        return user.firstName;
      }
      if (user.email) {
        const emailUsername = user.email.split('@')[0];
        console.log('Using email username:', emailUsername);
        return emailUsername;
      }
    }
    console.log('Falling back to "User"');
    return 'User';
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  getAuthToken(): string | null {
    return localStorage.getItem(this.AUTH_TOKEN_KEY);
  }
}