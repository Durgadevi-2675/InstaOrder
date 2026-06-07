import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';

// Migration utility class
class UserStorageMigration {
  private readonly CUSTOMER_STORAGE_KEY = 'currentCustomer';
  private readonly SELLER_STORAGE_KEY = 'currentSeller';
  private readonly OLD_USER_KEY = 'currentUser';

  static migrateExistingUsers(): void {
    const migration = new UserStorageMigration();
    migration.performMigration();
  }

  private performMigration(): void {
    // Check if old storage exists
    const oldUserData = localStorage.getItem(this.OLD_USER_KEY);
    
    if (oldUserData) {
      try {
        const user = JSON.parse(oldUserData);
        console.log('Migrating user:', user.email, 'Type:', user.userType);
        
        // Store in appropriate new location
        if (user.userType === 'customer') {
          localStorage.setItem(this.CUSTOMER_STORAGE_KEY, JSON.stringify(user));
          console.log('✓ Migrated customer user to new storage');
        } else if (user.userType === 'seller') {
          localStorage.setItem(this.SELLER_STORAGE_KEY, JSON.stringify(user));
          console.log('✓ Migrated seller user to new storage');
        }
        
        // Remove old storage
        localStorage.removeItem(this.OLD_USER_KEY);
        console.log('✓ Removed old user storage');
        
      } catch (error) {
        console.error('Error migrating user data:', error);
        // If migration fails, keep old data for safety
      }
    } else {
      console.log('No existing user data to migrate');
    }
  }

  // Optional: Method to check current storage state for debugging
  static debugStorageState(): void {
    console.log('=== User Storage Debug ===');
    console.log('Old storage (currentUser):', localStorage.getItem('currentUser'));
    console.log('Customer storage:', localStorage.getItem('currentCustomer'));
    console.log('Seller storage:', localStorage.getItem('currentSeller'));
    console.log('========================');
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  template: `<router-outlet></router-outlet>`,
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  title = 'instant-order';

  ngOnInit(): void {
    // Perform user storage migration on app startup
    console.log('🔄 Starting user storage migration...');
    UserStorageMigration.migrateExistingUsers();
    
    // Uncomment next line if you want to see the storage state in console
    // UserStorageMigration.debugStorageState();
  }
}