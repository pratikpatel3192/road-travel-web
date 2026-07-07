# RoadTravelWeb

The Road Travel web client (Angular 22). A **thin** client (ADR-0011): all routing/weather/AI is
server-side in `road-travel-core`; this renders it. Marketing pages live at `/`; the planner is the
auth-gated `/app` route.

## Run the app locally

1. **Config** — copy the template and fill in values for your environment:
   ```bash
   cp public/config.example.json public/config.json   # gitignored; per-env (ADR-0014)
   ```
   `apiBaseUrl` → where core runs (`http://localhost:8000` locally). `supabaseUrl`/`supabaseAnonKey`
   enable magic-link sign-in (leave blank to run unauthenticated against a local backend).
   `mapboxToken` (public `pk.…`) enables the live Mapbox map (otherwise an SVG route fallback renders).
2. **Backend** — run `road-travel-core` (e.g. `uvicorn road_travel_core.main:app --port 8000`); its
   default CORS allows `http://localhost:4200`.
3. **Web** — `npm install && npm start`, then open `http://localhost:4200/app`.

Uses the generated **`@road-travel/sdk`** (from `road-travel-contracts`) — never hand-write API calls;
regenerate the SDK from the OpenAPI spec.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
