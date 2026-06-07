import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ProfileComponent } from './profile.component';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
    phone: '+1234567890',
    address: '123 Main St, City, State 12345',
    userType: 'customer'
  };

  beforeEach(async () => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'getCurrentUser',
      'getCurrentUserName',
      'logout'
    ]);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [
        ProfileComponent,
        ReactiveFormsModule
      ],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Setup default mock returns
    mockAuthService.getCurrentUser.and.returnValue(mockUser);
    mockAuthService.getCurrentUserName.and.returnValue('John Doe');
    mockRouter.navigate.and.returnValue(Promise.resolve(true));
  });

  beforeEach(() => {
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with user data', () => {
    expect(component.user).toEqual(mockUser);
    expect(component.profileForm.get('firstName')?.value).toBe('John');
    expect(component.profileForm.get('lastName')?.value).toBe('Doe');
    expect(component.profileForm.get('email')?.value).toBe('test@example.com');
    expect(component.profileForm.get('phone')?.value).toBe('+1234567890');
    expect(component.profileForm.get('address')?.value).toBe('123 Main St, City, State 12345');
  });

  it('should redirect to login if no user is found', () => {
    mockAuthService.getCurrentUser.and.returnValue(null);
    component.ngOnInit();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should toggle edit mode', () => {
    expect(component.isEditMode).toBeFalse();
    component.toggleEditMode();
    expect(component.isEditMode).toBeTrue();
    component.toggleEditMode();
    expect(component.isEditMode).toBeFalse();
  });

  it('should toggle password change mode', () => {
    expect(component.isChangingPassword).toBeFalse();
    component.togglePasswordChange();
    expect(component.isChangingPassword).toBeTrue();
    component.togglePasswordChange();
    expect(component.isChangingPassword).toBeFalse();
  });

  it('should set active tab', () => {
    expect(component.activeTab).toBe('profile');
    component.setActiveTab('password');
    expect(component.activeTab).toBe('password');
    component.setActiveTab('orders');
    expect(component.activeTab).toBe('orders');
    component.setActiveTab('settings');
    expect(component.activeTab).toBe('settings');
  });

  it('should validate required fields in profile form', () => {
    component.profileForm.patchValue({
      firstName: '',
      lastName: '',
      phone: '',
      address: ''
    });
    
    expect(component.profileForm.valid).toBeFalse();
    expect(component.profileForm.get('firstName')?.errors?.['required']).toBeTruthy();
    expect(component.profileForm.get('lastName')?.errors?.['required']).toBeTruthy();
    expect(component.profileForm.get('phone')?.errors?.['required']).toBeTruthy();
    expect(component.profileForm.get('address')?.errors?.['required']).toBeTruthy();
  });

  it('should validate phone number pattern', () => {
    component.profileForm.patchValue({ phone: 'invalid-phone' });
    expect(component.profileForm.get('phone')?.errors?.['pattern']).toBeTruthy();
    
    component.profileForm.patchValue({ phone: '+1234567890' });
    expect(component.profileForm.get('phone')?.errors?.['pattern']).toBeFalsy();
  });

  it('should validate minimum length for firstName and lastName', () => {
    component.profileForm.patchValue({
      firstName: 'A',
      lastName: 'B'
    });
    
    expect(component.profileForm.get('firstName')?.errors?.['minlength']).toBeTruthy();
    expect(component.profileForm.get('lastName')?.errors?.['minlength']).toBeTruthy();
    
    component.profileForm.patchValue({
      firstName: 'John',
      lastName: 'Doe'
    });
    
    expect(component.profileForm.get('firstName')?.errors?.['minlength']).toBeFalsy();
    expect(component.profileForm.get('lastName')?.errors?.['minlength']).toBeFalsy();
  });

  it('should validate password form', () => {
    expect(component.passwordForm.valid).toBeFalse();
    
    component.passwordForm.patchValue({
      currentPassword: 'oldpassword',
      newPassword: 'newpassword123',
      confirmPassword: 'newpassword123'
    });
    
    expect(component.passwordForm.valid).toBeTrue();
  });

  it('should validate password mismatch', () => {
    component.passwordForm.patchValue({
      currentPassword: 'oldpassword',
      newPassword: 'newpassword123',
      confirmPassword: 'differentpassword'
    });
    
    expect(component.passwordForm.errors?.['passwordMismatch']).toBeTruthy();
  });

  it('should validate minimum password length', () => {
    component.passwordForm.patchValue({
      newPassword: '123'
    });
    
    expect(component.passwordForm.get('newPassword')?.errors?.['minlength']).toBeTruthy();
    
    component.passwordForm.patchValue({
      newPassword: '12345678'
    });
    
    expect(component.passwordForm.get('newPassword')?.errors?.['minlength']).toBeFalsy();
  });

  it('should submit profile form when valid', () => {
    spyOn(component, 'onSubmitProfile').and.callThrough();
    spyOn(window, 'setTimeout').and.callFake((callback: any) => callback());
    
    component.toggleEditMode();
    component.profileForm.patchValue({
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+0987654321',
      address: '456 Oak Ave, City, State 54321'
    });
    
    component.onSubmitProfile();
    
    expect(component.isLoading).toBeFalse();
    expect(component.isEditMode).toBeFalse();
    expect(component.successMessage).toBe('Profile updated successfully!');
  });

  it('should not submit profile form when invalid', () => {
    component.profileForm.patchValue({
      firstName: '',
      lastName: ''
    });
    
    component.onSubmitProfile();
    
    expect(component.errorMessage).toBe('Please fill in all required fields correctly.');
  });

  it('should submit password form when valid', () => {
    spyOn(component, 'onSubmitPassword').and.callThrough();
    spyOn(window, 'setTimeout').and.callFake((callback: any) => callback());
    
    component.passwordForm.patchValue({
      currentPassword: 'oldpassword',
      newPassword: 'newpassword123',
      confirmPassword: 'newpassword123'
    });
    
    component.onSubmitPassword();
    
    expect(component.isLoading).toBeFalse();
    expect(component.isChangingPassword).toBeFalse();
    expect(component.successMessage).toBe('Password changed successfully!');
  });

  it('should not submit password form when invalid', () => {
    component.passwordForm.patchValue({
      currentPassword: '',
      newPassword: '123',
      confirmPassword: '456'
    });
    
    component.onSubmitPassword();
    
    expect(component.errorMessage).toBe('Please check your password entries.');
  });

  it('should clear messages', () => {
    component.successMessage = 'Success!';
    component.errorMessage = 'Error!';
    
    component.clearMessages();
    
    expect(component.successMessage).toBe('');
    expect(component.errorMessage).toBe('');
  });

  it('should get form errors correctly', () => {
    component.profileForm.get('firstName')?.markAsTouched();
    component.profileForm.patchValue({ firstName: '' });
    
    const error = component.getFormError('firstName');
    expect(error).toBe('First Name is required.');
  });

  it('should get password errors correctly', () => {
    component.passwordForm.get('newPassword')?.markAsTouched();
    component.passwordForm.patchValue({ newPassword: '123' });
    
    const error = component.getPasswordError('newPassword');
    expect(error).toBe('Password must be at least 8 characters long.');
  });

  it('should navigate to orders', () => {
    component.navigateToOrders();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/orders']);
  });

  it('should navigate to favorites', () => {
    component.navigateToFavorites();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/favorites']);
  });

  it('should delete account with confirmation', () => {
    spyOn(window, 'confirm').and.returnValues(true, true);
    spyOn(mockAuthService, 'logout');
    
    component.deleteAccount();
    
    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should not delete account without confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    spyOn(mockAuthService, 'logout');
    
    component.deleteAccount();
    
    expect(mockAuthService.logout).not.toHaveBeenCalled();
  });

  it('should get user display name', () => {
    const displayName = component.getUserDisplayName();
    expect(displayName).toBe('John Doe');
  });

  it('should get user initials', () => {
    const initials = component.getUserInitials();
    expect(initials).toBe('JD');
  });

  it('should get single initial when only firstName exists', () => {
    component.user = {
      ...mockUser,
      firstName: 'John',
      lastName: ''
    };
    
    const initials = component.getUserInitials();
    expect(initials).toBe('J');
  });

  it('should get email initial when no names exist', () => {
    component.user = {
      ...mockUser,
      firstName: '',
      lastName: ''
    };
    
    const initials = component.getUserInitials();
    expect(initials).toBe('T'); // First letter of email
  });

  it('should get default initial when no user data exists', () => {
    component.user = null;
    
    const initials = component.getUserInitials();
    expect(initials).toBe('U');
  });

  // Test form field label mapping
  it('should return correct field labels', () => {
    expect(component['getFieldLabel']('firstName')).toBe('First Name');
    expect(component['getFieldLabel']('lastName')).toBe('Last Name');
    expect(component['getFieldLabel']('phone')).toBe('Phone Number');
    expect(component['getFieldLabel']('unknownField')).toBe('unknownField');
  });
});