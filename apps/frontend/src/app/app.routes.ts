import type { CanMatchFn, Routes } from '@angular/router';

import { SLUG_REGEX } from '@whos-next/shared';

const slugGuard: CanMatchFn = (_route, segments) => {
  const slug = segments[0]?.path ?? '';
  return SLUG_REGEX.test(slug);
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing.page').then((m) => m.LandingPage),
  },
  {
    path: ':slug',
    canMatch: [slugGuard],
    loadComponent: () => import('./features/rotation/rotation.page').then((m) => m.RotationPage),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
