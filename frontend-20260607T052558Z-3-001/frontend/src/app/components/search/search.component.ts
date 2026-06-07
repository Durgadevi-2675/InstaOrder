import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { ProductFilter } from '../../models/product.model';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

interface SearchResult {
  products: any[];
  totalResults: number;
  totalSellers: number;
  location: {
    district: string;
    city: string;
  };
}

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class SearchComponent implements OnInit {
  @Output() searchResults = new EventEmitter<SearchResult>();
  
  searchForm: FormGroup;
  isLoading = false;
  hasSearched = false;
  totalResults = 0;
  totalSellers = 0;
  showCustomCategory = false; // Added custom category property

  // Categories - same as seller dashboard
  categories = ['Electronics', 'Clothing', 'Food & Beverages', 'Books', 'Home & Garden', 'Sports', 'Toys', 'Other'];

  // District and city options (same as seller dashboard)
  districts = [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
    'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur',
    'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris',
    'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga',
    'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
    'Tirupattur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'
  ];

  // Cities mapped by districts (same as seller dashboard)
  citiesByDistrict: { [key: string]: string[] } = {
    'Chennai': ['Chennai', 'Tambaram', 'Pallavaram', 'Chromepet', 'Velachery', 'Adyar', 'T. Nagar', 'Anna Nagar'],
    'Coimbatore': ['Coimbatore', 'Pollachi', 'Valparai', 'Mettupalayam', 'Sulur', 'Karamadai'],
    'Madurai': ['Madurai', 'Melur', 'Vadipatti', 'Usilampatti', 'Peraiyur', 'Kalligudi'],
    'Salem': ['Salem', 'Mettur', 'Yercaud', 'Attur', 'Sankari', 'Vazhapadi', 'Omalur'],
    'Tiruchirapalli': ['Tiruchirappalli', 'Srirangam', 'Lalgudi', 'Manachanallur', 'Manapparai', 'Musiri'],
    'Tirunelveli': ['Tirunelveli', 'Palayamkottai', 'Ambasamudram', 'Sankarankovil', 'Tenkasi', 'Nanguneri'],
    'Erode': ['Erode', 'Bhavani', 'Gobichettipalayam', 'Sathyamangalam', 'Kangeyam', 'Perundurai'],
    'Vellore': ['Vellore', 'Arcot', 'Ranipet', 'Walajapet', 'Ambur', 'Vaniyambadi'],
    'Thanjavur': ['Thanjavur', 'Kumbakonam', 'Pattukkottai', 'Orathanadu', 'Thiruvaiyaru', 'Papanasam'],
    'Kanyakumari': ['Nagercoil', 'Kanyakumari', 'Padmanabhapuram', 'Thuckalay', 'Kalkulam', 'Colachel'],
    'Dharmapuri': ['Dharmapuri', 'Harur', 'Palakcode', 'Pennagaram', 'Karimangalam', 'Pappireddipatti'],
    'Dindigul': ['Dindigul', 'Kodaikanal', 'Palani', 'Batlagundu', 'Oddanchatram', 'Vedasandur'],
    'Cuddalore': ['Cuddalore', 'Chidambaram', 'Vridhachalam', 'Panruti', 'Kattumannarkoil', 'Kurinjipadi'],
    'Kanchipuram': ['Kanchipuram', 'Chengalpattu', 'Madurantakam', 'Uthiramerur', 'Sriperumbudur', 'Walajabad'],
    'Karur': ['Karur', 'Kulithalai', 'Krishnarayapuram', 'Kadavur', 'Manmangalam', 'Pugalur'],
    'Krishnagiri': ['Krishnagiri', 'Hosur', 'Denkanikottai', 'Pochampalli', 'Uthangarai', 'Bargur'],
    'Nagapattinam': ['Nagapattinam', 'Mayiladuthurai', 'Sirkazhi', 'Tharangambadi', 'Vedaranyam', 'Kilvelur'],
    'Namakkal': ['Namakkal', 'Tiruchengode', 'Rasipuram', 'Paramathi Velur', 'Kolli Hills', 'Sendamangalam'],
    'Nilgiris': ['Ooty', 'Coonoor', 'Kotagiri', 'Gudalur', 'Ketti', 'Wellington'],
    'Perambalur': ['Perambalur', 'Kunnam', 'Veppanthattai', 'Alathur', 'Valikandapuram'],
    'Pudukkottai': ['Pudukkottai', 'Aranthangi', 'Karambakudi', 'Kulathur', 'Gandarvakottai', 'Illuppur'],
    'Ramanathapuram': ['Ramanathapuram', 'Rameswaram', 'Paramakudi', 'Mudukulathur', 'Mandapam', 'Kadaladi'],
    'Sivaganga': ['Sivaganga', 'Karaikudi', 'Devakottai', 'Manamadurai', 'Singampunari', 'Tiruppattur'],
    'Tenkasi': ['Tenkasi', 'Courtallam', 'Alangulam', 'Kadayanallur', 'Veerakeralampudur', 'Shencottai'],
    'Theni': ['Theni', 'Periyakulam', 'Uthamapalayam', 'Andipatti', 'Bodinayakanur', 'Chinnamanur'],
    'Thoothukudi': ['Thoothukudi', 'Kovilpatti', 'Ettayapuram', 'Vilathikulam', 'Ottapidaram', 'Kayathar'],
    'Tiruppur': ['Tiruppur', 'Avinashi', 'Palladam', 'Udumalaipettai', 'Kangeyam', 'Dharapuram'],
    'Tiruvallur': ['Tiruvallur', 'Ambattur', 'Avadi', 'Poonamallee', 'Ponneri', 'Gummidipoondi'],
    'Tiruvannamalai': ['Tiruvannamalai', 'Arani', 'Cheyyar', 'Vandavasi', 'Polur', 'Kalasapakkam'],
    'Tiruvarur': ['Tiruvarur', 'Mannargudi', 'Nannilam', 'Thiruthuraipoondi', 'Valangaiman', 'Kudavasal'],
    'Viluppuram': ['Viluppuram', 'Tindivanam', 'Gingee', 'Vanur', 'Marakkanam', 'Kallakurichi'],
    'Virudhunagar': ['Virudhunagar', 'Sivakasi', 'Srivilliputtur', 'Rajapalayam', 'Sattur', 'Aruppukottai'],
    'Ariyalur': ['Ariyalur', 'Udayarpalayam', 'Andimadam', 'Sendurai', 'Jayankondam'],
    'Chengalpattu': ['Chengalpattu', 'Tambaram', 'Pallavaram', 'Chromepet', 'Madurantakam', 'Cheyyur'],
    'Kallakurichi': ['Kallakurichi', 'Sankarapuram', 'Tirukoilur', 'Ulundurpet', 'Kalvarayan Hills'],
    'Mayiladuthurai': ['Mayiladuthurai', 'Sirkazhi', 'Poompuhar', 'Kuthalam', 'Tarangambadi'],
    'Ranipet': ['Ranipet', 'Arcot', 'Walajapet', 'Nemili', 'Sholinghur'],
    'Tirupattur': ['Tirupattur', 'Ambur', 'Vaniyambadi', 'Natrampalli', 'Alangayam']
  };

  // Available cities for selected district
  availableCities: string[] = [];

  constructor(
    private fb: FormBuilder,
    private productService: ProductService
  ) {
    this.searchForm = this.fb.group({
      district: [''],
      city: [''],
      searchTerm: [''],
      category: [''],
      customCategory: [''], // Added custom category field
      minPrice: [''],
      maxPrice: ['']
    });
  }

  ngOnInit(): void {
    // No need to load categories dynamically anymore - they're predefined
    this.setupFormSubscriptions();
  }

  setupFormSubscriptions(): void {
    // When district changes, load cities for that district
    this.searchForm.get('district')?.valueChanges.subscribe(district => {
      this.onDistrictChange(district);
      // Always reset search results when location changes
      this.resetSearchResults();
    });

    // When city changes, reset search results but don't auto-search
    this.searchForm.get('city')?.valueChanges.subscribe(() => {
      this.resetSearchResults();
    });

    // Subscribe to category changes to show/hide custom category field
    this.searchForm.get('category')?.valueChanges.subscribe((category: string) => {
      this.onCategoryChange(category);
    });

    // Auto-search when filters change (only if location is selected AND user has searched)
    this.searchForm.valueChanges.subscribe(() => {
      if (this.isSearchEnabled() && this.hasSearched) {
        this.performAutoSearch();
      }
    });
  }

  // Added new method for category change handling
  onCategoryChange(category: string): void {
    this.showCustomCategory = category === 'Other';
    
    if (!this.showCustomCategory) {
      // Clear custom category value when not "Other"
      this.searchForm.get('customCategory')?.setValue('');
    }
  }

  onDistrictChange(district: string): void {
    if (district && this.citiesByDistrict[district]) {
      this.availableCities = this.citiesByDistrict[district];
      // Reset city selection when district changes
      this.searchForm.get('city')?.setValue('');
    } else {
      this.availableCities = [];
      this.searchForm.get('city')?.setValue('');
    }
  }

  isSearchEnabled(): boolean {
    const district = this.searchForm.get('district')?.value;
    const city = this.searchForm.get('city')?.value;
    return !!(district && city);
  }

  searchProducts(): void {
    if (!this.isSearchEnabled()) {
      return;
    }

    this.hasSearched = true;
    this.performSearch();
  }

  performSearch(): void {
    this.isLoading = true;
    const formValue = this.searchForm.value;
    
    // Use custom category if "Other" is selected, otherwise use selected category
    const finalCategory = formValue.category === 'Other' && formValue.customCategory 
      ? formValue.customCategory 
      : formValue.category;
    
    // Create basic filter for existing service
    const filter: ProductFilter = {
      searchTerm: formValue.searchTerm || undefined,
      category: finalCategory || undefined, // Use the final category
      minPrice: formValue.minPrice ? Number(formValue.minPrice) : undefined,
      maxPrice: formValue.maxPrice ? Number(formValue.maxPrice) : undefined,
      isAvailable: true
    };

    // Use existing search method with location filtering
    this.searchProductsWithLocationFilter(filter, formValue.district, formValue.city).subscribe({
      next: (result: any) => {
        this.isLoading = false;
        const products = Array.isArray(result) ? result : (result.products || []);
        this.totalResults = result.totalResults || products.length;
        this.totalSellers = result.totalSellers || this.calculateUniqueSellers(products);
        
        const searchResult: SearchResult = {
          products: products,
          totalResults: this.totalResults,
          totalSellers: this.totalSellers,
          location: {
            district: formValue.district,
            city: formValue.city
          }
        };
        
        this.searchResults.emit(searchResult);
      },
      error: (error: any) => {
        this.isLoading = false;
        console.error('Search error:', error);
        this.totalResults = 0;
        this.totalSellers = 0;
        
        const emptyResult: SearchResult = {
          products: [],
          totalResults: 0,
          totalSellers: 0,
          location: {
            district: formValue.district || '',
            city: formValue.city || ''
          }
        };
        
        this.searchResults.emit(emptyResult);
      }
    });
  }

  private searchProductsWithLocationFilter(filter: ProductFilter, district: string, city: string): Observable<any> {
    if (this.productService.searchProducts) {
      return this.productService.searchProducts(filter).pipe(
        map((products: any) => {
          // Filter products based on location
          const productsArray = Array.isArray(products) ? products : (products.products || []);
          const filteredProducts = productsArray.filter((product: any) => {
            // Filter by district and city if product has location data
            if (product.district && product.city) {
              return product.district === district && product.city === city;
            }
            // If no location data in product, include all (fallback)
            return true;
          });
          
          return {
            products: filteredProducts,
            totalResults: filteredProducts.length,
            totalSellers: this.calculateUniqueSellers(filteredProducts)
          };
        }),
        catchError((error: any) => {
          console.error('Search error:', error);
          return of({ products: [], totalResults: 0, totalSellers: 0 });
        })
      );
    } else {
      // Return empty result if no search method available
      return of({ products: [], totalResults: 0, totalSellers: 0 });
    }
  }

  performAutoSearch(): void {
    // Debounced search for filter changes
    setTimeout(() => {
      this.performSearch();
    }, 500);
  }

  private calculateUniqueSellers(products: any[]): number {
    if (!products || !Array.isArray(products)) return 0;
    const sellerIds = new Set();
    products.forEach(product => {
      if (product.sellerId) {
        sellerIds.add(product.sellerId);
      } else if (product.seller?.id) {
        sellerIds.add(product.seller.id);
      }
    });
    return sellerIds.size;
  }

  clearFilters(): void {
    const currentDistrict = this.searchForm.get('district')?.value;
    const currentCity = this.searchForm.get('city')?.value;
    
    this.searchForm.patchValue({
      searchTerm: '',
      category: '',
      customCategory: '', // Added custom category clearing
      minPrice: '',
      maxPrice: ''
    });

    this.showCustomCategory = false; // Reset custom category visibility

    // Re-search with cleared filters if location is still selected
    if (currentDistrict && currentCity) {
      this.performSearch();
    }
  }

  resetSearchResults(): void {
    this.hasSearched = false;
    this.totalResults = 0;
    this.totalSellers = 0;
    this.searchResults.emit({
      products: [],
      totalResults: 0,
      totalSellers: 0,
      location: { district: '', city: '' }
    });
  }

  getSelectedLocationName(): string {
    const district = this.searchForm.get('district')?.value;
    const city = this.searchForm.get('city')?.value;
    if (district && city) {
      return `${city}, ${district}`;
    }
    return '';
  }

  // Helper method to check if a district has cities
  hasAvailableCities(): boolean {
    return this.availableCities.length > 0;
  }

  // Helper method to get district options
  getDistrictOptions(): string[] {
    return this.districts;
  }

  // Helper method to get city options for current district
  getCityOptions(): string[] {
    return this.availableCities;
  }
}