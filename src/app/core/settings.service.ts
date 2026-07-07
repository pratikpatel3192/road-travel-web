import { Injectable, effect, signal } from '@angular/core';

import type { PlaceValue } from '../pages/plan/place-field';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Units = 'imperial' | 'metric';
export type MapStyle = 'standard' | 'satellite' | 'hybrid';

const THEME_KEY = 'rt.theme';
const UNITS_KEY = 'rt.units';
const MAP_STYLE_KEY = 'rt.mapStyle';
const HOME_KEY = 'rt.favHome';
const WORK_KEY = 'rt.favWork';

/**
 * User preferences, mirroring the iOS Settings screen: appearance (system/light/dark), units, map
 * display style, and Home/Work favorite places. Persisted to localStorage; appearance is reflected
 * onto <html data-theme> so styles.css can override the OS setting.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly theme = signal<ThemeMode>(this.readStr(THEME_KEY, 'system') as ThemeMode);
  readonly units = signal<Units>(this.readStr(UNITS_KEY, 'imperial') as Units);
  readonly mapStyle = signal<MapStyle>(this.readStr(MAP_STYLE_KEY, 'standard') as MapStyle);
  readonly home = signal<PlaceValue | null>(this.readJson<PlaceValue | null>(HOME_KEY, null));
  readonly work = signal<PlaceValue | null>(this.readJson<PlaceValue | null>(WORK_KEY, null));

  constructor() {
    effect(() => {
      const mode = this.theme();
      const root = document.documentElement;
      if (mode === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', mode);
      this.write(THEME_KEY, mode);
    });
    effect(() => this.write(UNITS_KEY, this.units()));
    effect(() => this.write(MAP_STYLE_KEY, this.mapStyle()));
    effect(() => this.writeJson(HOME_KEY, this.home()));
    effect(() => this.writeJson(WORK_KEY, this.work()));
  }

  setTheme(mode: ThemeMode): void {
    this.theme.set(mode);
  }
  setUnits(units: Units): void {
    this.units.set(units);
  }
  setMapStyle(style: MapStyle): void {
    this.mapStyle.set(style);
  }
  setHome(place: PlaceValue | null): void {
    this.home.set(place);
  }
  setWork(place: PlaceValue | null): void {
    this.work.set(place);
  }

  private readStr(key: string, fallback: string): string {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }
  private readJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable (private mode) — settings just won't persist */
    }
  }
  private writeJson(key: string, value: unknown): void {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }
}
