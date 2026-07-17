import {
  Component,
  type ElementRef,
  type OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { PlanTripResponse } from '@road-travel/sdk';
import * as L from 'leaflet';

import { SettingsService } from '../../core/settings.service';
import { SEVERITY_COLOR, type Severity, weatherEmoji } from './severity';

// Free, keyless tile sources. Esri World Imagery gives satellite; its reference layers add roads +
// labels for "hybrid".
const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_TRANSPORT =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}';
const ESRI_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

/**
 * The route on an interactive map (Leaflet). Base style switches between Standard (OSM), Satellite and
 * Hybrid (Esri imagery + road/label overlays). The polyline is colored per-segment by severity, with
 * milestone dots two-way selection-synced to the timeline. Mirrors the iOS MapKit map + its layers menu.
 *
 * ADR-0026 idle mode: with no plan yet, the map is the app-home canvas — centered on the user's
 * current location (when granted) with a "you are here" marker and a recenter control; otherwise a
 * default regional view. The pane fills its container (full-viewport two-pane shell).
 */
@Component({
  selector: 'app-route-map',
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="wrap" [class.expanded]="expanded()">
      <div #mapEl class="map" [class.expanded]="expanded()" role="img" aria-label="Route map colored by weather severity"></div>
      <div class="layers" role="group" aria-label="Map layers">
        <button
          type="button"
          class="expand"
          (click)="toggleExpand()"
          [attr.aria-label]="expanded() ? 'Collapse map' : 'Expand map'"
          [title]="expanded() ? 'Collapse map (Esc)' : 'Expand map'"
        >
          {{ expanded() ? '⤡' : '⤢' }}
        </button>
        @if (userLocation()) {
          <button type="button" class="expand" (click)="recenter()" aria-label="Recenter on your location" title="Your location">
            ◎
          </button>
        }
        <span class="sep"></span>
        <button type="button" [class.on]="settings.mapStyle() === 'standard'" (click)="settings.setMapStyle('standard')">
          Map
        </button>
        <button type="button" [class.on]="settings.mapStyle() === 'satellite'" (click)="settings.setMapStyle('satellite')">
          Satellite
        </button>
        <button type="button" [class.on]="settings.mapStyle() === 'hybrid'" (click)="settings.setMapStyle('hybrid')">
          Hybrid
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .wrap {
        position: relative;
        height: 100%;
      }
      .wrap.expanded {
        position: fixed;
        inset: 0;
        z-index: 2000;
        background: var(--bg);
      }
      .map {
        height: 100%;
        min-height: 280px;
        width: 100%;
        overflow: hidden;
        background: var(--surface-2);
      }
      .map.expanded {
        height: 100%;
        border-radius: 0;
        border: none;
      }
      .layers {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 500;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
      }
      .layers button {
        border: none;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        padding: 5px 9px;
        border-radius: 7px;
        cursor: pointer;
      }
      .layers button.on {
        background: var(--accent);
        color: var(--accent-contrast);
      }
      .layers button.expand {
        font-size: 15px;
        padding: 4px 8px;
      }
      .sep {
        width: 1px;
        align-self: stretch;
        background: var(--border);
        margin: 2px 1px;
      }
    `,
  ],
})
export class RouteMap implements OnDestroy {
  readonly plan = input<PlanTripResponse | null>(null);
  readonly selected = input<number | null>(null);
  /** ADR-0026: browser-geolocation fix for the idle "you are here" marker; never persisted. */
  readonly userLocation = input<{ latitude: number; longitude: number } | null>(null);
  readonly selectedChange = output<number | null>();
  /** F-006: a long-press (~500 ms mouse/touch hold) asks the planner to add a stop here. */
  readonly stopRequest = output<{ latitude: number; longitude: number }>();
  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');

  readonly settings = inject(SettingsService);
  readonly expanded = signal(false);

  private map: L.Map | null = null;
  private baseLayer: L.TileLayer | null = null;
  private overlayLayers: L.TileLayer[] = [];
  private routeLayer: L.LayerGroup | null = null;
  private userMarker: L.Marker | null = null;
  private centeredOnUser = false;
  private bounds: L.LatLngBounds | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly markers = new Map<
    number,
    { marker: L.Marker; sev: Severity; emoji: string; stop: number | null }
  >();
  private unbindLongPress: (() => void) | null = null;

  constructor() {
    effect(() => {
      const plan = this.plan();
      this.userLocation(); // idle-mode marker/center track the fix as it arrives
      const el = this.mapEl().nativeElement;
      setTimeout(() => this.render(el, plan), 0);
    });
    effect(() => {
      this.selected();
      this.applySelection();
    });
    // Swap base/overlay layers when the map style changes.
    effect(() => {
      this.settings.mapStyle();
      if (this.map) this.applyLayers();
    });
    // On expand/collapse the container resizes; the ResizeObserver refits, but nudge it too in case
    // the observer is coalesced.
    effect(() => {
      this.expanded();
      setTimeout(() => this.fit(), 0);
    });
  }

  toggleExpand(): void {
    this.expanded.set(!this.expanded());
  }
  onEscape(): void {
    if (this.expanded()) this.expanded.set(false);
  }

  private render(el: HTMLElement, plan: PlanTripResponse | null): void {
    if (!this.map) {
      this.map = L.map(el, { scrollWheelZoom: false }).setView([37, -120], 6);
      this.applyLayers();
      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(el);
      this.unbindLongPress = this.bindLongPress(this.map, el);
    }
    this.syncUserMarker();
    if (!plan) {
      // Idle (home) mode: no route yet. Center once on the user's location when it arrives;
      // denied/unavailable keeps the default regional view (ADR-0026 fallback — never blocks).
      this.routeLayer?.remove();
      this.routeLayer = null;
      this.markers.clear();
      this.bounds = null;
      const loc = this.userLocation();
      if (loc && !this.centeredOnUser) {
        this.centeredOnUser = true;
        this.map.setView([loc.latitude, loc.longitude], 12, { animate: false });
      }
      return;
    }
    this.routeLayer?.remove();
    const layer = L.layerGroup().addTo(this.map);
    this.routeLayer = layer;
    this.markers.clear();

    const bounds = L.latLngBounds([]);
    for (const seg of plan.segments) {
      const latlngs = seg.coordinates.map((c) => [c.latitude, c.longitude] as L.LatLngTuple);
      latlngs.forEach((ll) => bounds.extend(ll));
      L.polyline(latlngs, {
        color: SEVERITY_COLOR[seg.severity as Severity] ?? SEVERITY_COLOR.clear,
        weight: 5,
        opacity: 0.9,
      }).addTo(layer);
    }

    // A weather pin at every milestone: the condition emoji in a white badge ringed by severity
    // color (first = origin, last = destination). Stop-marked samples (F-006) get a numbered pin
    // instead, above the weather pins. Click-to-select stays synced with the timeline.
    for (const s of plan.samples) {
      const sev = (s.weather?.severity as Severity) ?? 'clear';
      const emoji = weatherEmoji(s.weather?.condition_symbol, s.weather?.condition_text);
      const stop = s.waypoint_index ?? null;
      const marker = L.marker([s.latitude, s.longitude], {
        icon: stop != null ? this.stopIcon(stop + 1, sev, false) : this.pinIcon(emoji, sev, false),
        keyboard: false,
        zIndexOffset: stop != null ? 500 : 0,
      });
      marker.on('click', () => this.selectedChange.emit(s.index));
      marker.addTo(layer);
      this.markers.set(s.index, { marker, sev, emoji, stop });
    }

    this.bounds = bounds.isValid() ? bounds : null;
    this.fit();
    this.applySelection();
  }

  /** "You are here": a pulsing brand-blue dot; kept in sync with the geolocation fix. */
  private syncUserMarker(): void {
    const map = this.map;
    if (!map) return;
    const loc = this.userLocation();
    if (!loc) {
      this.userMarker?.remove();
      this.userMarker = null;
      return;
    }
    const icon = L.divIcon({
      className: '',
      html: '<div class="rt-you" role="img" aria-label="You are here"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    if (this.userMarker) this.userMarker.setLatLng([loc.latitude, loc.longitude]).setIcon(icon);
    else this.userMarker = L.marker([loc.latitude, loc.longitude], { icon, keyboard: false, zIndexOffset: 900 }).addTo(map);
  }

  recenter(): void {
    const loc = this.userLocation();
    if (loc && this.map) this.map.setView([loc.latitude, loc.longitude], 12);
  }

  /** (Re)build the base map and hybrid overlays from the current map-style setting. */
  private applyLayers(): void {
    const map = this.map;
    if (!map) return;
    this.baseLayer?.remove();
    this.overlayLayers.forEach((l) => l.remove());
    this.overlayLayers = [];

    const style = this.settings.mapStyle();
    if (style === 'standard') {
      this.baseLayer = L.tileLayer(OSM, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
        zIndex: 1,
      }).addTo(map);
    } else {
      this.baseLayer = L.tileLayer(ESRI_IMAGERY, {
        maxZoom: 19,
        attribution: 'Imagery &copy; Esri',
        zIndex: 1,
      }).addTo(map);
      if (style === 'hybrid') {
        for (const url of [ESRI_TRANSPORT, ESRI_LABELS]) {
          this.overlayLayers.push(L.tileLayer(url, { maxZoom: 19, zIndex: 2 }).addTo(map));
        }
      }
    }
  }

  private fit(): void {
    const map = this.map;
    if (!map) return;
    map.invalidateSize({ animate: false });
    if (this.bounds) map.fitBounds(this.bounds, { padding: [28, 28], animate: false });
  }

  private applySelection(): void {
    const sel = this.selected();
    this.markers.forEach(({ marker, sev, emoji, stop }, idx) => {
      const on = idx === sel;
      marker.setIcon(stop != null ? this.stopIcon(stop + 1, sev, on) : this.pinIcon(emoji, sev, on));
      marker.setZIndexOffset(on ? 1000 : stop != null ? 500 : 0);
    });
  }

  /**
   * F-006 stop pin: the 1-based stop number on the accent badge, ringed by the stop's arrival
   * severity — visually distinct from the emoji weather pins and the endpoint samples.
   */
  private stopIcon(n: number, sev: Severity, selected: boolean): L.DivIcon {
    const size = selected ? 34 : 27;
    const border = selected ? 4 : 3;
    const font = selected ? 16 : 13;
    const html =
      `<div style="width:${size}px;height:${size}px;border-radius:50%;` +
      `display:flex;align-items:center;justify-content:center;` +
      `background:var(--accent);color:var(--accent-contrast);` +
      `border:${border}px solid ${SEVERITY_COLOR[sev]};box-shadow:0 1px 4px rgba(0,0,0,0.35);` +
      `font-size:${font}px;font-weight:700;line-height:1;">${n}</div>`;
    return L.divIcon({
      html,
      className: 'wx-stop-pin',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  /**
   * F-006: a ~500 ms press-and-hold (mouse or touch, unified via pointer events) emits a
   * `stopRequest` at the pressed coordinate. Any drag (>8 px), pinch, map move, or early release
   * cancels — normal pan/zoom/click interactions are untouched. Returns an unbinder.
   */
  private bindLongPress(map: L.Map, el: HTMLElement): () => void {
    let timer: number | undefined;
    let cleanup: (() => void) | null = null;

    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
      cleanup?.();
      cleanup = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      // Primary pointer only (left button / single touch); a second finger cancels below.
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      cancel();
      const start = { x: e.clientX, y: e.clientY };
      const point = L.DomEvent.getMousePosition(e, el);

      const onMove = (m: PointerEvent) => {
        if (Math.hypot(m.clientX - start.x, m.clientY - start.y) > 8) cancel();
      };
      const onEnd = () => cancel();
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onEnd);
      el.addEventListener('pointercancel', onEnd);
      el.addEventListener('pointerdown', onEnd); // a second pointer (pinch) cancels
      map.on('movestart zoomstart', onEnd);
      cleanup = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onEnd);
        el.removeEventListener('pointercancel', onEnd);
        el.removeEventListener('pointerdown', onEnd);
        map.off('movestart zoomstart', onEnd);
      };

      timer = window.setTimeout(() => {
        cancel();
        const ll = map.containerPointToLatLng(point);
        this.stopRequest.emit({ latitude: ll.lat, longitude: ll.lng });
      }, 500);
    };

    // While a hold is pending, swallow the browser/native context menu (Android long-press,
    // desktop right-click passes through because it never arms the timer).
    const onContextMenu = (e: Event) => {
      if (timer !== undefined) {
        e.preventDefault();
        cancel();
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      cancel();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }

  /** A weather-emoji map pin: white badge, severity-colored ring, enlarged when selected. */
  private pinIcon(emoji: string, sev: Severity, selected: boolean): L.DivIcon {
    const size = selected ? 32 : 24;
    const border = selected ? 3 : 2;
    const font = selected ? 18 : 13;
    const html =
      `<div style="width:${size}px;height:${size}px;border-radius:50%;` +
      `display:flex;align-items:center;justify-content:center;background:#ffffff;` +
      `border:${border}px solid ${SEVERITY_COLOR[sev]};box-shadow:0 1px 4px rgba(0,0,0,0.35);` +
      `font-size:${font}px;line-height:1;">${emoji}</div>`;
    return L.divIcon({
      html,
      className: 'wx-pin',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.unbindLongPress?.();
    this.unbindLongPress = null;
    this.map?.remove();
    this.map = null;
  }
}
