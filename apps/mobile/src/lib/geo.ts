import type { Region } from 'react-native-maps';

/** Region → "west,south,east,north" (the API's bbox). */
export function bboxOf(r: Region): string {
  const f = (n: number) => n.toFixed(4);
  return [f(r.longitude - r.longitudeDelta / 2), f(r.latitude - r.latitudeDelta / 2), f(r.longitude + r.longitudeDelta / 2), f(r.latitude + r.latitudeDelta / 2)].join(',');
}
