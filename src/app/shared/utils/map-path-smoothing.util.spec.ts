import { smoothPath, smoothPathUntil } from './map-path-smoothing.util';

const POINTS = [
  { lat: 48.86, lng: 2.33 },
  { lat: 48.87, lng: 2.34 },
  { lat: 48.85, lng: 2.36 },
  { lat: 48.86, lng: 2.38 },
];

describe('smoothPathUntil', () => {
  it('se réduit au 1er point à progress 0', () => {
    expect(smoothPathUntil(POINTS, 0)).toEqual([POINTS[0]]);
  });

  it('reproduit exactement smoothPath à progress maximal (et au-delà)', () => {
    const full = smoothPath(POINTS);
    expect(smoothPathUntil(POINTS, POINTS.length - 1)).toEqual(full);
    expect(smoothPathUntil(POINTS, 99)).toEqual(full);
  });

  it('se termine exactement sur une activité à progress entier', () => {
    const path = smoothPathUntil(POINTS, 2);
    expect(path[path.length - 1].lat).toBeCloseTo(POINTS[2].lat);
    expect(path[path.length - 1].lng).toBeCloseTo(POINTS[2].lng);
  });

  it('est un préfixe de smoothPath en cours de span', () => {
    const full = smoothPath(POINTS);
    const partial = smoothPathUntil(POINTS, 1.5);
    expect(partial.slice(0, -1)).toEqual(full.slice(0, partial.length - 1));
    expect(partial.length).toBeLessThan(full.length);
  });

  it('reste sur le segment droit avec 2 points', () => {
    const [a, b] = POINTS;
    const [, head] = smoothPathUntil([a, b], 0.5).slice(-2);
    const ratio = (head.lat - a.lat) / (b.lat - a.lat);
    expect((head.lng - a.lng) / (b.lng - a.lng)).toBeCloseTo(ratio);
  });

  it('renvoie le chemin tel quel avec 0 ou 1 point', () => {
    expect(smoothPathUntil([], 1)).toEqual([]);
    expect(smoothPathUntil([POINTS[0]], 1)).toEqual([POINTS[0]]);
  });
});
