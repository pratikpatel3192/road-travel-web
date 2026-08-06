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
import { IconComponent, LUCIDE } from '../../ui/icon';
import { SEVERITY_COLOR, type Severity, weatherIcon } from './severity';

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
  imports: [IconComponent],
  template: `
    <div class="wrap" [class.expanded]="expanded()">
      <div #mapEl class="map" [class.expanded]="expanded()" role="img" aria-label="Route map colored by weather severity"></div>
      <div class="layers" role="group" aria-label="Map layers">
        <button
          type="button"
          class="map-chip expand"
          (click)="toggleExpand()"
          [attr.aria-label]="expanded() ? 'Collapse map' : 'Expand map'"
          [title]="expanded() ? 'Collapse map (Esc)' : 'Expand map'"
        >
          <app-icon [name]="expanded() ? 'minimize-2' : 'maximize-2'" [size]="15" />
        </button>
        @if (userLocation()) {
          <button type="button" class="map-chip expand" (click)="recenter()" aria-label="Recenter on your location" title="Your location">
            <app-icon name="locate-fixed" [size]="15" />
          </button>
        }
        <span class="sep"></span>
        <button type="button" class="map-chip" [class.on]="settings.mapStyle() === 'standard'" (click)="settings.setMapStyle('standard')">
          Map
        </button>
        <button type="button" class="map-chip" [class.on]="settings.mapStyle() === 'satellite'" (click)="settings.setMapStyle('satellite')">
          Satellite
        </button>
        <button type="button" class="map-chip" [class.on]="settings.mapStyle() === 'hybrid'" (click)="settings.setMapStyle('hybrid')">
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
      /* Floating chip cluster (kit map canvas): each control is its own white .map-chip capsule. */
      .layers {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 500;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .layers button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 7px 14px;
        border: 2px solid transparent;
        transition: background 150ms ease-out, border-color 150ms ease-out;
      }
      .layers button.on {
        background: var(--accent-100);
        border-color: var(--accent);
        color: var(--accent-800);
      }
      .layers button.expand {
        width: 32px;
        height: 32px;
        padding: 0;
      }
      .sep {
        width: 2px;
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
  /** F-005 Explore: ranked-result pins in card order — numbered, distinct from stop/weather pins;
   *  an empty array (panel closed / results cleared) removes them. */
  readonly explorePins = input<{ latitude: number; longitude: number; name?: string }[]>([]);
  /** Highlighted explore-card index (two-way with the panel via the plan page). */
  readonly exploreSelected = input<number | null>(null);
  readonly exploreSelectedChange = output<number | null>();
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
    { marker: L.Marker; sev: Severity; icon: string; temp: string; stop: number | null }
  >();
  private unbindLongPress: (() => void) | null = null;
  private exploreLayer: L.LayerGroup | null = null;
  private exploreMarkers: L.Marker[] = [];

  constructor() {
    effect(() => {
      const plan = this.plan();
      this.userLocation(); // idle-mode marker/center track the fix as it arrives
      this.settings.units(); // weather chips show the temp — redraw when units flip
      const el = this.mapEl().nativeElement;
      setTimeout(() => this.render(el, plan), 0);
    });
    effect(() => {
      this.selected();
      this.applySelection();
    });
    // F-005: (re)drop the numbered explore pins whenever the result set changes ([] clears).
    effect(() => {
      const pins = this.explorePins();
      setTimeout(() => this.renderExplorePins(pins), 0);
    });
    effect(() => {
      this.exploreSelected();
      this.applyExploreSelection();
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
    const segLatLngs = plan.segments.map((seg) =>
      seg.coordinates.map((c) => [c.latitude, c.longitude] as L.LatLngTuple),
    );
    segLatLngs.forEach((lls) => lls.forEach((ll) => bounds.extend(ll)));
    // Kit route (mock 3a/4a): one contrast casing under all severity segments. The rt-* classes
    // drive the SVG strokes (theme-live); the color options are non-SVG fallbacks only.
    if (segLatLngs.length) {
      L.polyline(segLatLngs, {
        className: 'rt-route-casing',
        color: '#ffffff', // matches --route-casing (light); the class wins on SVG renders
        weight: 12,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(layer);
    }
    plan.segments.forEach((seg, i) => {
      const sev: Severity = SEVERITY_COLOR[seg.severity as Severity] ? (seg.severity as Severity) : 'clear';
      L.polyline(segLatLngs[i], {
        className: 'rt-sev-' + sev,
        color: SEVERITY_COLOR[sev],
        weight: 6.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);
    });

    // A weather chip at every milestone: the condition glyph + temp on a .wx-pin pill (hazard
    // tint when severity isn't clear; first = origin, last = destination). Stop-marked samples
    // (F-006) get a numbered pin instead, above the weather pins. Click-to-select stays synced
    // with the timeline.
    const units = this.settings.units();
    for (const s of plan.samples) {
      const sev = (s.weather?.severity as Severity) ?? 'clear';
      const icon = weatherIcon(s.weather?.condition_symbol, s.weather?.condition_text);
      const temp = s.weather
        ? `${Math.round(units === 'metric' ? s.weather.temperature_c : s.weather.temperature_c * 1.8 + 32)}°`
        : '';
      const stop = s.waypoint_index ?? null;
      const marker = L.marker([s.latitude, s.longitude], {
        icon: stop != null ? this.stopIcon(stop + 1, sev, false) : this.pinIcon(icon, temp, sev, false),
        keyboard: false,
        zIndexOffset: stop != null ? 500 : 0,
      });
      // F-006: label stop pins with their name ("Stop 1 — Santa Fe"); weather milestones stay
      // chip-only to avoid clutter (there are ~14 of them).
      if (stop != null) {
        const wpName = plan.waypoints?.[stop]?.name?.split(',')[0]?.trim(); // short label (drop ", CA, USA")
        marker.bindTooltip(`Stop ${stop + 1}${wpName ? ' — ' + wpName : ''}`, {
          permanent: true,
          direction: 'right',
          offset: [10, 0],
          className: 'wx-map-label',
        });
      }
      marker.on('click', () => {
        this.selectedChange.emit(s.index);
        this.zoomTo(s.latitude, s.longitude); // click-to-zoom (a little), centered on the milestone
      });
      marker.addTo(layer);
      this.markers.set(s.index, { marker, sev, icon, temp, stop });
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

  /** Click-to-zoom: center on a milestone/pin and zoom in a little. Never zooms back out (so
   *  clicking an already-close pin just recenters), and caps so it doesn't slam to street level. */
  private zoomTo(latitude: number, longitude: number): void {
    const map = this.map;
    if (!map) return;
    const target = Math.min(Math.max(map.getZoom() + 1, 10), 13);
    map.setView([latitude, longitude], target, { animate: true });
  }

  /** (Re)build the base map and hybrid overlays from the current map-style setting. */
  private applyLayers(): void {
    const map = this.map;
    if (!map) return;
    this.baseLayer?.remove();
    this.overlayLayers.forEach((l) => l.remove());
    this.overlayLayers = [];

    const style = this.settings.mapStyle();
    // Cream/night cartography filter (styles.css .rt-tiles-warm) applies to the OSM raster only —
    // never to satellite/hybrid imagery.
    map.getContainer().classList.toggle('rt-tiles-warm', style === 'standard');
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
    this.markers.forEach(({ marker, sev, icon, temp, stop }, idx) => {
      const on = idx === sel;
      marker.setIcon(stop != null ? this.stopIcon(stop + 1, sev, on) : this.pinIcon(icon, temp, sev, on));
      marker.setZIndexOffset(on ? 1000 : stop != null ? 500 : 0);
    });
  }

  /**
   * F-005 explore pins: one numbered pin per result card (1-based, card order), above weather
   * pins but below a selected marker. Cleared whenever the input empties (panel closed).
   */
  private renderExplorePins(
    pins: readonly { latitude: number; longitude: number; name?: string }[],
  ): void {
    const map = this.map;
    if (!map) return;
    this.exploreLayer?.remove();
    this.exploreLayer = null;
    this.exploreMarkers = [];
    if (!pins.length) return;
    const layer = L.layerGroup().addTo(map);
    this.exploreLayer = layer;
    const sel = this.exploreSelected();
    pins.forEach((p, i) => {
      const marker = L.marker([p.latitude, p.longitude], {
        icon: this.exploreIcon(i + 1, i === sel),
        keyboard: false,
        zIndexOffset: i === sel ? 1100 : 700,
      });
      // F-005: label each result pin with its number + place name ("1. Grand Canyon Overlook").
      if (p.name) {
        marker.bindTooltip(`${i + 1}. ${p.name.split(',')[0].trim()}`, {
          permanent: true,
          direction: 'right',
          offset: [10, 0],
          className: 'wx-map-label',
        });
      }
      marker.on('click', () => {
        this.exploreSelectedChange.emit(i);
        this.zoomTo(p.latitude, p.longitude);
      });
      marker.addTo(layer);
      this.exploreMarkers.push(marker);
    });
  }

  private applyExploreSelection(): void {
    const sel = this.exploreSelected();
    this.exploreMarkers.forEach((m, i) => {
      m.setIcon(this.exploreIcon(i + 1, i === sel));
      m.setZIndexOffset(i === sel ? 1100 : 700);
    });
  }

  /**
   * F-005 explore pin: the 1-based result number on the kit's sage .rt-explore-pin badge —
   * visually distinct from the terracotta stop pins and the white weather chips.
   */
  private exploreIcon(n: number, selected: boolean): L.DivIcon {
    const size = selected ? 32 : 26;
    const html =
      `<div class="rt-explore-pin" style="width:${size}px;height:${size}px` +
      (selected ? ';font-size:15px;box-shadow:var(--shadow-md)' : '') +
      `">${n}</div>`;
    return L.divIcon({
      html,
      className: 'wx-explore-pin',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  /**
   * F-006 stop pin: the 1-based stop number on the kit's terracotta .rt-stop-pin badge —
   * visually distinct from the weather chips and the endpoint samples. (Severity still colors
   * the route under it; the pin itself is the kit badge.)
   */
  private stopIcon(n: number, _sev: Severity, selected: boolean): L.DivIcon {
    const size = selected ? 34 : 26;
    const html =
      `<div class="rt-stop-pin" style="width:${size}px;height:${size}px` +
      (selected ? ';font-size:16px;box-shadow:var(--shadow-md)' : '') +
      `">${n}</div>`;
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

  /** Weather milestone chip (kit .wx-pin): Lucide condition glyph + temp on a white pill;
   *  hazard tint when severity isn't clear, accent ring + slight grow when selected. */
  private pinIcon(icon: string, temp: string, sev: Severity, selected: boolean): L.DivIcon {
    const hazard = sev !== 'clear';
    const svg =
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" ` +
      `stroke-linecap="round" stroke-linejoin="round">${LUCIDE[icon] ?? LUCIDE['thermometer']}</svg>`;
    const html =
      `<span class="wx-pin${hazard ? ' hazard' : ''}" style="width:100%;height:100%;justify-content:center` +
      (selected ? ';border-color:var(--accent);transform:scale(1.12)' : '') +
      `">${svg}${temp}</span>`;
    return L.divIcon({
      html,
      className: '',
      iconSize: [64, 26],
      iconAnchor: [32, 13],
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
