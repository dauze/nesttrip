export interface Place {
  placeId: number
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviewCount?: number;
  reviews?: {
    author: string;
    rating: number;
    comment: string;
  }[];
  openingHours?: string[];
  phone?: string;
  website?: string;
  types?: string[];
  priceLevel?: number;
  photos?: string[];
}
