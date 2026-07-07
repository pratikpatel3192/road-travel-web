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
import { SEVERITY_COLOR, type Severity } from './severity';

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
      .wrap {
        position: relative;
      }
      .wrap.expanded {
        position: fixed;
        inset: 0;
        z-index: 2000;
        background: var(--bg);
      }
      .map {
        height: 300px;
        width: 100%;
        border-radius: var(--radius);
        border: 1px solid var(--border);
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
  readonly plan = input.required<PlanTripResponse>();
  readonly selected = input<number | null>(null);
  readonly selectedChange = output<number | null>();
  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');

  readonly settings = inject(SettingsService);
  readonly expanded = signal(false);

  private map: L.Map | null = null;
  private baseLayer: L.TileLayer | null = null;
  private overlayLayers: L.TileLayer[] = [];
  private routeLayer: L.LayerGroup | null = null;
  private bounds: L.LatLngBounds | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly markers = new Map<number, { marker: L.CircleMarker; sev: Severity }>();

  constructor() {
    effect(() => {
      const plan = this.plan();
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

  private render(el: HTMLElement, plan: PlanTripResponse): void {
    if (!this.map) {
      this.map = L.map(el, { scrollWheelZoom: false }).setView([37, -120], 6);
      this.applyLayers();
      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(el);
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

    for (const s of plan.samples) {
      const sev = (s.weather?.severity as Severity) ?? 'clear';
      const marker = L.circleMarker([s.latitude, s.longitude], this.dotStyle(sev, false));
      marker.on('click', () => this.selectedChange.emit(s.index));
      marker.addTo(layer);
      this.markers.set(s.index, { marker, sev });
    }

    const coords = plan.route_coordinates;
    if (coords.length) {
      const start = coords[0];
      const end = coords[coords.length - 1];
      L.circleMarker([start.latitude, start.longitude], this.pin('#111827')).addTo(layer);
      L.circleMarker([end.latitude, end.longitude], this.pin('#2d6fb5')).addTo(layer);
    }

    this.bounds = bounds.isValid() ? bounds : null;
    this.fit();
    this.applySelection();
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
    this.markers.forEach(({ marker, sev }, idx) => {
      const on = idx === sel;
      marker.setRadius(on ? 8 : 5);
      marker.setStyle(this.dotPath(sev, on));
      if (on) marker.bringToFront();
    });
  }

  private dotStyle(sev: Severity, on: boolean): L.CircleMarkerOptions {
    return { radius: on ? 8 : 5, ...this.dotPath(sev, on) };
  }

  private dotPath(sev: Severity, on: boolean): L.PathOptions {
    return {
      color: on ? '#0f1722' : '#ffffff',
      weight: on ? 3 : 2,
      fillColor: SEVERITY_COLOR[sev],
      fillOpacity: 1,
    };
  }

  private pin(color: string): L.CircleMarkerOptions {
    return { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 };
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
  }
}
