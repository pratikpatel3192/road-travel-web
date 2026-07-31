import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Analytics start in `app.config.ts`'s initializer, not here: the PostHog project key arrives in the
// runtime `config.json` (ADR-0024/ADR-0037), which isn't loaded yet at this point.
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
