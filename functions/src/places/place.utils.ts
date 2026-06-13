export function mapPriceLevel(priceLevel: string | undefined): number | undefined {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return priceLevel ? map[priceLevel] : undefined;
}

export function mapPhotos(photos: any[] | undefined): string[] {
  return photos?.slice(0, 10).map((p) => p.name) ?? [];
}