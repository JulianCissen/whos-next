import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
// Confirms frontend → @whos-next/shared import resolves correctly.
// No @whos-next/backend import exists here or anywhere in frontend — boundary enforced by pnpm dep graph.
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import type { HealthResponseDto as _HealthResponseDto } from '@whos-next/shared';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),
    provideTranslateService({ defaultLanguage: 'en' }),
    ...provideTranslateHttpLoader(),
  ],
};
