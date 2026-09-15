import {
  Component,
  type ElementRef,
  computed,
  type OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { PlanTripResponse, RouteSampleModel } from '@road-travel/sdk';
import * as L from 'leaflet';

import { FORECAST_HORIZON_DAYS } from '../../core/forecast-horizon';
import { SettingsService } from '../../core/settings.service';
import { IconComponent, LUCIDE } from '../../ui/icon';
import {
  SEVERITY_COLOR,
  SEVERITY_FALLBACK,
  UNKNOWN_COLOR,
  type Severity,
  isHazard,
  severityOrFallback,
  toSeverity,
  weatherIcon,
} from './severity';

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
 * What marker, if any, a route sample puts on the map.
 *
 * A stop is a PLACE, so it keeps its numbered pin whether or not anyone has forecast it. A weather
 * pill is a claim about the weather, so it exists only when there is weather to claim. Without this
 * guard every sample with `weather: null` became a `.wx-pin` holding the thermometer fallback glyph
 * and an empty temperature — a row of dark, blank pills along a day past the forecast horizon that
 * a traveller reasonably read as the map being broken.
 */
export function pinKind(sample: Pick<RouteSampleModel, 'weather' | 'waypoint_index'>): 'stop' | 'weather' | null {
  if (sample.waypoint_index != null) return 'stop';
  return sample.weather ? 'weather' : null;
}

/** A note laid over the map when some or all of the route it shows has no weather. */
export interface MapWeatherNotice {
  /** `beyond`: nobody forecasts this far out. `unavailable`: we should have weather and don't. */
  kind: 'beyond' | 'partial-beyond' | 'unavailable' | 'partial-unavailable';
  /** Whole route without weather: said prominently, because the map has nothing else to say. */
  prominent: boolean;
  text: string;
}

/**
 * Why the map shows less weather than a route normally carries — or null when it shows all of it.
 *
 * Once the empty pills are gone (see {@link pinKind}) a far-future day is a bare neutral line, and a
 * bare line with no explanation reads as the same rendering failure the pills did. So the absence is
 * always SAID, and said for the right reason: past the horizon is not a failure and will resolve on
 * its own ("we'll have it closer to the day", the wording the trip briefing card uses for the same
 * days), while missing weather inside the horizon is a provider failure and gets no verdict at all.
 *
 * @param day 1-based ordinal of the day on screen for a multi-day trip; null for a one-day trip.
 * @param dayBeyondForecast the day record's own flag — a day past the horizon has no plan at all,
 *   so it is the only evidence there is when `plan` is null.
 */
export function mapWeatherNotice(
  plan: Pick<PlanTripResponse, 'samples'> | null,
  day: number | null,
  dayBeyondForecast = false,
): MapWeatherNotice | null {
  const subject = day != null ? `Day ${day}` : 'This trip';
  const beyond: MapWeatherNotice = {
    kind: 'beyond',
    prominent: true,
    text: `${subject} is past the ${FORECAST_HORIZON_DAYS}-day forecast — we'll have it closer to the day.`,
  };
  if (!plan) return dayBeyondForecast ? beyond : null;

  const samples = plan.samples ?? [];
  const missing = samples.filter((s) => !s.weather);
  if (!missing.length) return null;
  const all = missing.length === samples.length;
  // Only claim "past the forecast" when EVERY missing sample says so. One failed fetch inside the
  // horizon must not be explained away as "we'll have it closer to the day" — it won't fix itself.
  const allBeyond = missing.every((s) => s.beyond_forecast === true);

  if (allBeyond) {
    return all
      ? beyond
      : {
          kind: 'partial-beyond',
          prominent: false,
          text: `Part of ${day != null ? `day ${day}` : 'this trip'} is past the ${FORECAST_HORIZON_DAYS}-day forecast.`,
        };
  }
  return all
    ? { kind: 'unavailable', prominent: true, text: "Weather isn't available for this route." }
    : { kind: 'partial-unavailable', prominent: false, text: "Weather isn't available for part of this route." };
}

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
      @if (notice(); as n) {
        <!-- Said on the map itself: a neutral line with no pills is otherwise indistinguishable
             from a map that failed to load its weather. -->
        <p class="wx-notice" [class.prominent]="n.prominent" [attr.data-kind]="n.kind" role="status">
          @if (n.prominent) {
            <app-icon [name]="n.kind === 'beyond' ? 'calendar' : 'cloud'" [size]="16" />
          }
          <span>{{ n.text }}</span>
        </p>
      }
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
      /* Bottom-centre, clear of the layer chips (top-right) and Leaflet's attribution (bottom-right).
         Above the map panes (400) and below Leaflet's controls (800+). */
      .wx-notice {
        position: absolute;
        left: 50%;
        bottom: 26px;
        transform: translateX(-50%);
        z-index: 500;
        max-width: min(92%, 420px);
        width: max-content;
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 5px 12px;
        border-radius: var(--radius-pill);
        background: var(--surface);
        color: var(--muted);
        box-shadow: var(--shadow-md);
        font-size: 12.5px;
        font-weight: 600;
        line-height: 1.3;
        pointer-events: none;
      }
      .wx-notice.prominent {
        padding: 10px 16px;
        border-radius: var(--radius-md);
        color: var(--text);
        font-size: 14px;
      }
      .wx-notice app-icon {
        flex: 0 0 auto;
        color: var(--muted);
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
  /** 1-based ordinal of the day on screen for a multi-day trip; null for a one-day trip. Names the
   *  day in the no-forecast notice ("Day 3 is past …" vs "This trip is past …"). */
  readonly day = input<number | null>(null);
  /** The shown day's own `beyond_forecast` — such a day has no plan, so no samples to read it from. */
  readonly dayBeyondForecast = input(false);
  readonly notice = computed(() => mapWeatherNotice(this.plan(), this.day(), this.dayBeyondForecast()));
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
    { marker: L.Marker; sev: Severity | null; icon: string; temp: string; stop: number | null }
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
      // A null/absent severity is a stretch no forecast reaches. It gets grey — deliberately NOT
      // the sage of "clear", which tells the driver the road is fine when nobody knows yet. The
      // old `?? 'clear'` fallback drew a whole far-future route green.
      //
      // An UNRECOGNISED severity is a different case and must not share that grey: the server did
      // say something, this build just predates the word. `toSeverity` separates the two, and an
      // unrecognised value degrades to caution rather than to "no forecast".
      const known: Severity | null =
        seg.severity == null ? null : toSeverity(seg.severity) ?? SEVERITY_FALLBACK;
      //
      // The no-forecast stretch is also DASHED. A solid muted line on satellite imagery is exactly
      // what a failed or disabled layer looks like, and that is how users read it ("why is it
      // grey?"). A dash is the cartographic "tentative" and reads as a deliberate state; the notice
      // over the map says what that state is.
      L.polyline(segLatLngs[i], {
        className: known ? 'rt-sev-' + known : 'rt-sev-unknown',
        color: known ? SEVERITY_COLOR[known] : UNKNOWN_COLOR,
        weight: 6.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        ...(known ? {} : { dashArray: '9 11' }),
      }).addTo(layer);
    });

    // A weather chip at every milestone THAT HAS WEATHER: the condition glyph + temp on a .wx-pin
    // pill (hazard tint at caution-or-worse; first = origin, last = destination). Stop-marked
    // samples (F-006) get a numbered pin instead, above the weather pins, forecast or not.
    // Click-to-select stays synced with the timeline.
    const units = this.settings.units();
    for (const s of plan.samples) {
      // No weather and not a stop: draw nothing. See `pinKind` — the placeholder pill this used to
      // draw was a blank thermometer that looked like a rendering failure.
      const kind = pinKind(s);
      if (kind == null) continue;
      // Null = a stop nobody has forecast. We do not tint what nobody has looked at (the dashed
      // neutral segment underneath carries that). What we must NOT do is collapse an unrecognised
      // severity into the same case — `severityOrFallback` keeps it a hazard, at caution.
      const sev: Severity | null = s.weather ? severityOrFallback(s.weather.severity) : null;
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
  private stopIcon(n: number, _sev: Severity | null, selected: boolean): L.DivIcon {
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
   *  hazard tint at caution-or-worse, accent ring + slight grow when selected. */
  private pinIcon(icon: string, temp: string, sev: Severity | null, selected: boolean): L.DivIcon {
    // Caution-or-worse, by rank. `sev !== 'clear'` happened to be right for three levels and is
    // right for five too, but it says nothing about WHERE the line is — and it treated a null
    // (no forecast) as a hazard. This states the rule the tint actually means.
    const hazard = isHazard(sev);
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
