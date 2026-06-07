import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocationService } from '../../services/location.service';
import { ProductService } from '../../services/product.service';
import { Shop } from '../../models/shop.model';
import { Product } from '../../models/product.model';

declare var L: any; // Leaflet map library

@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class MapViewComponent implements OnInit, AfterViewInit {
  map: any;
  currentLocation: GeolocationPosition | null = null;
  nearbyShops: Shop[] = [];
  selectedShop: Shop | null = null;
  shopProducts: Product[] = [];
  isLoading = true;
  mapCenter = { lat: 40.7128, lng: -74.0060 }; // Default to NYC
  Math = Math; // Make Math available in template

  constructor(
    private locationService: LocationService,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.getCurrentLocation();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  getCurrentLocation(): void {
    this.locationService.getCurrentLocation().then(
      (position) => {
        this.currentLocation = position;
        this.mapCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        this.loadNearbyShops();
        if (this.map) {
          this.map.setView([this.mapCenter.lat, this.mapCenter.lng], 13);
          this.addCurrentLocationMarker();
        }
      }
    ).catch(error => {
      console.error('Error getting location:', error);
      this.isLoading = false;
      this.initializeMap();
    });
  }

  initializeMap(): void {
    this.map = L.map('map').setView([this.mapCenter.lat, this.mapCenter.lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    if (this.currentLocation) {
      this.addCurrentLocationMarker();
    }
    this.addShopMarkers();
  }

  addCurrentLocationMarker(): void {
    if (this.currentLocation) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div class="user-marker"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      L.marker([this.currentLocation.coords.latitude, this.currentLocation.coords.longitude], {
        icon: userIcon
      }).addTo(this.map)
        .bindPopup('Your Location')
        .openPopup();
    }
  }

  loadNearbyShops(): void {
    if (this.currentLocation) {
      this.locationService.getNearbyShops(
        this.currentLocation.coords.latitude,
        this.currentLocation.coords.longitude,
        25
      ).subscribe({
        next: (shops) => {
          this.nearbyShops = shops;
          this.isLoading = false;
          this.addShopMarkers();
        },
        error: (error) => {
          console.error('Error loading nearby shops:', error);
          this.isLoading = false;
        }
      });
    }
  }

  addShopMarkers(): void {
    if (!this.map) return;

    this.nearbyShops.forEach(shop => {
      const shopIcon = L.divIcon({
        className: 'shop-marker',
        html: `<div class="shop-marker-content">
                 <i class="shop-icon">🏪</i>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([shop.latitude, shop.longitude], {
        icon: shopIcon
      }).addTo(this.map);

      marker.bindPopup(`
        <div class="shop-popup">
          <h3>${shop.name}</h3>
          <p>${shop.description}</p>
          <div class="shop-rating">
            <span class="stars">${'★'.repeat(Math.floor(shop.rating))}</span>
            <span class="rating-text">${shop.rating} (${shop.reviewCount} reviews)</span>
          </div>
          <button onclick="selectShop('${shop.id}')" class="btn btn-primary btn-sm">
            View Products
          </button>
        </div>
      `);

      marker.on('click', () => {
        this.selectShop(shop);
      });
    });
  }

  selectShop(shop: Shop): void {
    this.selectedShop = shop;
    this.loadShopProducts(shop.id);
  }

  loadShopProducts(shopId: string): void {
    this.productService.getProductsByShop(shopId).subscribe({
      next: (products) => {
        this.shopProducts = products;
      },
      error: (error) => {
        console.error('Error loading shop products:', error);
        this.shopProducts = [];
      }
    });
  }

  closeShopPanel(): void {
    this.selectedShop = null;
    this.shopProducts = [];
  }

  getDistance(shop: Shop): string {
    if (!this.currentLocation) return '';
    
    const distance = this.locationService.calculateDistance(
      this.currentLocation.coords.latitude,
      this.currentLocation.coords.longitude,
      shop.latitude,
      shop.longitude
    );
    
    return `${distance.toFixed(1)} km away`;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }
}