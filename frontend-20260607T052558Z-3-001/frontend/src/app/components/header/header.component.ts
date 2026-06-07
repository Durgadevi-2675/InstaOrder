import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class HeaderComponent {
  isAuthenticated = false;
  searchQuery = '';
  showUserDropdown = false;

  constructor(private router: Router) {}

  // Test navigation method
  testNavigation() {
    console.log('TEST: Attempting to navigate to /login');
    alert('Button clicked! Check console for navigation result.');
    this.router.navigate(['/login']).then(
      (success) => {
        console.log('Navigation success:', success);
        alert('Navigation successful: ' + success);
      },
      (error) => {
        console.log('Navigation error:', error);
        alert('Navigation failed: ' + error);
      }
    );
  }

  // Navigation methods with debugging
  navigateToLogin() { 
    console.log('Login button clicked!'); // Debug log
    this.router.navigate(['/login']).then(
      (success) => console.log('Navigation success:', success),
      (error) => console.log('Navigation error:', error)
    );
  }

  navigateToHome() { this.router.navigate(['/']); }
  navigateToLocation() { this.router.navigate(['/location']); }
  navigateToProducts() { this.router.navigate(['/products']); }
  navigateToMapView() { this.router.navigate(['/map']); }
  navigateToSearch() { this.router.navigate(['/search']); }
  navigateToFavorites() { this.router.navigate(['/favorites']); }
  navigateToCart() { this.router.navigate(['/cart']); }
  navigateToProfile() { this.router.navigate(['/profile']); }

  // Search functionality
  onSearch() {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
    }
  }

  onSearchKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }

  // User dropdown functionality
  toggleUserDropdown() {
    this.showUserDropdown = !this.showUserDropdown;
  }

  closeUserDropdown() {
    this.showUserDropdown = false;
  }

  // Authentication
  logout() {
    this.isAuthenticated = false;
    this.showUserDropdown = false;
    this.router.navigate(['/']);
  }
}