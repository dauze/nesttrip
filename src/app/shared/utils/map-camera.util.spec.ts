import { computeOverviewCamera, easeInOutCubic, estimateZoomDrop, lerp, zoomEnvelope } from './map-camera.util';

describe('lerp', () => {
  it('interpole linéairement entre a et b', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });
});

describe('easeInOutCubic', () => {
  it('vaut 0 et 1 aux bornes, 0.5 au milieu', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
});

describe('zoomEnvelope', () => {
  it('vaut 0 aux bornes, maximale au milieu (parabole 4t(1-t))', () => {
    expect(zoomEnvelope(0)).toBe(0);
    expect(zoomEnvelope(1)).toBe(0);
    expect(zoomEnvelope(0.5)).toBe(1);
  });
});

describe('computeOverviewCamera', () => {
  it('renvoie null sans points', () => {
    expect(computeOverviewCamera([], { width: 400, height: 400 }, 13)).toBeNull();
  });

  it('centre exactement sur l\'unique point, au zoom de focus', () => {
    const result = computeOverviewCamera([{ latitude: 48.85, longitude: 2.35 }], { width: 400, height: 400 }, 13);
    expect(result).toEqual({ center: { lat: 48.85, lng: 2.35 }, zoom: 13 });
  });

  it('centre au milieu du bbox pour plusieurs points, jamais plus zoomé que le focus', () => {
    const result = computeOverviewCamera(
      [{ latitude: 48.80, longitude: 2.30 }, { latitude: 48.90, longitude: 2.40 }],
      { width: 400, height: 400 },
      13,
    );
    expect(result?.center.lat).toBeCloseTo(48.85);
    expect(result?.center.lng).toBeCloseTo(2.35);
    expect(result!.zoom).toBeLessThanOrEqual(13);
  });
});

describe('estimateZoomDrop', () => {
  it('vaut 0 pour deux points quasi identiques (< 50m)', () => {
    const drop = estimateZoomDrop(
      { latitude: 48.8566, longitude: 2.3522 },
      { latitude: 48.8566, longitude: 2.3523 },
      { width: 400, height: 400 },
      13,
    );
    expect(drop).toBe(0);
  });

  it('grandit avec la distance, plafonné à 6', () => {
    const near = estimateZoomDrop(
      { latitude: 48.8566, longitude: 2.3522 },
      { latitude: 48.86, longitude: 2.36 },
      { width: 400, height: 400 },
      13,
    );
    const far = estimateZoomDrop(
      { latitude: 48.8566, longitude: 2.3522 },
      { latitude: 51.5074, longitude: -0.1278 }, // Paris -> Londres
      { width: 400, height: 400 },
      13,
    );
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThanOrEqual(6);
  });
});
