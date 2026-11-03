import { GeolocationService } from './geolocation.service';

describe('GeolocationService', () => {
  let success: PositionCallback;
  let failure: PositionErrorCallback | null | undefined;
  const getCurrentPosition = vi.fn((onSuccess: PositionCallback, onError?: PositionErrorCallback | null) => {
    success = onSuccess;
    failure = onError;
  });

  beforeEach(() => {
    localStorage.clear();
    getCurrentPosition.mockClear();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('does not request on startup or while disabled', () => {
    const service = new GeolocationService();
    service.requestPosition();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('restores preference without automatically requesting permission again', () => {
    localStorage.setItem('nt-geolocation-enabled', 'true');
    expect(new GeolocationService().enabled()).toBe(true);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('shares one request and its position, then clears everything on disable', () => {
    const service = new GeolocationService();
    service.setEnabled(true);
    service.requestPosition();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    success({ coords: { latitude: 0, longitude: 2, accuracy: 10 } } as GeolocationPosition);
    expect(service.position()).toEqual({ lat: 0, lng: 2 });
    expect(service.accuracy()).toBe(10);
    service.setEnabled(false);
    expect(service.position()).toBeNull();
    expect(service.error()).toBeNull();
    expect(service.accuracy()).toBe(0);
    expect(localStorage.getItem('nt-geolocation-enabled')).toBe('false');
  });

  it('ignores a late result after disabling or starting another request', () => {
    const service = new GeolocationService();
    service.setEnabled(true);
    const previousSuccess = success;
    service.setEnabled(false);
    previousSuccess({ coords: { latitude: 1, longitude: 2, accuracy: 10 } } as GeolocationPosition);
    expect(service.position()).toBeNull();
    service.setEnabled(true);
    previousSuccess({ coords: { latitude: 3, longitude: 4, accuracy: 10 } } as GeolocationPosition);
    expect(service.position()).toBeNull();
    expect(service.locating()).toBe(true);
  });

  it.each([1, 2, 3])('reports failure %s without an automatic retry', (code) => {
    const service = new GeolocationService();
    service.setEnabled(true);
    failure?.({ code } as GeolocationPositionError);
    expect(service.error()).toBeTruthy();
    expect(service.locating()).toBe(false);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    service.setEnabled(false);
    expect(service.error()).toBeNull();
  });

  it('handles unavailable geolocation', () => {
    vi.stubGlobal('navigator', {});
    const service = new GeolocationService();
    service.setEnabled(true);
    expect(service.error()).toBeTruthy();
    expect(service.locating()).toBe(false);
  });
});