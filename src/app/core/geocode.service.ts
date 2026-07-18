import { Injectable } from '@angular/core';

export interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Place search / autocomplete (mirrors the iOS app's MapKit search — the user types a place, not
 * coordinates). Uses Photon (komoot), a free, CORS-enabled, autocomplete-oriented OSM geocoder — no
 * API key. Kept client-side because it's an input concern, exactly like MapKit search on iOS.
 */
@Injectable({ providedIn: 'root' })
export class GeocodeService {
  /**
   * @param near optional proximity bias (lon/lat) — Photon ranks results near this point first, so a
   *   stop on an Austin→LA route surfaces the New Mexico "Santa Fe", not one on another continent.
   */
  async search(
    query: string,
    near?: { latitude: number; longitude: number } | null,
  ): Promise<GeoResult[]> {
    const q = query.trim();
    if (q.length < 3) return [];
    try {
      let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`;
      if (near && Number.isFinite(near.latitude) && Number.isFinite(near.longitude)) {
        url += `&lat=${near.latitude}&lon=${near.longitude}`; // proximity bias (rank nearby first)
      }
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const json = await res.json();
      const features: unknown[] = json?.features ?? [];
      return features
        .map((f) => this.toResult(f))
        .filter((r): r is GeoResult => !!r);
    } catch {
      return [];
    }
  }

  /**
   * Reverse geocode a coordinate to a display name (F-006 map long-press → stop). Same Photon
   * service as `search`; null on any failure — callers fall back to a coordinate label.
   */
  async reverse(latitude: number, longitude: number): Promise<GeoResult | null> {
    try {
      const res = await fetch(
        `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&limit=1`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) return null;
      const json = await res.json();
      const feature = json?.features?.[0];
      return feature ? this.toResult(feature) : null;
    } catch {
      return null;
    }
  }

  private toResult(feature: unknown): GeoResult | null {
    const f = feature as {
      geometry?: { coordinates?: [number, number] };
      properties?: Record<string, string>;
    };
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const [longitude, latitude] = coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const p = f.properties ?? {};
    const parts = [p['name'], p['city'] ?? p['town'] ?? p['village'], p['state'], p['country']]
      .filter((x): x is string => !!x);
    const name = [...new Set(parts)].join(', ') || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
    return { name, latitude, longitude };
  }
}
