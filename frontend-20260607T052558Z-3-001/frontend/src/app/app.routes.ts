import { Routes } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/signup/signup.component';
import { ProductListComponent } from './components/product-list/product-list.component';
import { MapViewComponent } from './components/map-view/map-view.component';
import { SearchComponent } from './components/search/search.component';
import { SellerDashboardComponent } from './components/seller-dashboard/seller-dashboard.component';
import { ProfileComponent } from './components/profile/profile.component'; // Add this import

export const routes: Routes = [
  { path: '', component: HeaderComponent }, // Home page - Header component
  { path: 'home', component: HeaderComponent }, // Alternative home route
  { path: 'login', component: LoginComponent }, // Back to actual LoginComponent
  { path: 'signup', component: SignupComponent },
  { path: 'reset-password', component: LoginComponent }, // NEW: Add reset password route
  { path: 'products', component: ProductListComponent },
  { path: 'map', component: MapViewComponent },
  { path: 'search', component: SearchComponent },
  { path: 'seller-dashboard', component: SellerDashboardComponent },
  { path: 'profile', component: ProfileComponent }, // Add this route
  { path: '**', redirectTo: '/' } // Wildcard route - redirect to home (header component)
];