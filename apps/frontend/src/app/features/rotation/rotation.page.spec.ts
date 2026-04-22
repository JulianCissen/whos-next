import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RotationPage } from './rotation.page';

describe('RotationPage', () => {
  let httpController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotationPage, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimationsAsync(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'aBcDeFgH' } } },
        },
      ],
    }).compileComponents();
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('shows loading state initially', () => {
    const fixture = TestBed.createComponent(RotationPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Loading');
    httpController.expectOne('/api/rotations/aBcDeFgH').flush({
      slug: 'aBcDeFgH',
      name: 'Dish duty',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('renders rotation name after load', async () => {
    const fixture = TestBed.createComponent(RotationPage);
    fixture.detectChanges();
    httpController.expectOne('/api/rotations/aBcDeFgH').flush({
      slug: 'aBcDeFgH',
      name: 'Dish duty',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('Dish duty');
  });

  it('shows error state on API failure', async () => {
    const fixture = TestBed.createComponent(RotationPage);
    fixture.detectChanges();
    httpController
      .expectOne('/api/rotations/aBcDeFgH')
      .flush({ error: 'ROTATION_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('renders member queue section after load', async () => {
    const fixture = TestBed.createComponent(RotationPage);
    fixture.detectChanges();
    httpController.expectOne('/api/rotations/aBcDeFgH').flush({
      slug: 'aBcDeFgH',
      name: 'Dish duty',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      members: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-member-queue')).toBeTruthy();
  });

  it('renders empty state when rotation has no members', async () => {
    const fixture = TestBed.createComponent(RotationPage);
    fixture.detectChanges();
    httpController.expectOne('/api/rotations/aBcDeFgH').flush({
      slug: 'aBcDeFgH',
      name: 'Dish duty',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      members: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });

  it('renders member names when rotation has members', async () => {
    const fixture = TestBed.createComponent(RotationPage);
    fixture.detectChanges();
    httpController.expectOne('/api/rotations/aBcDeFgH').flush({
      slug: 'aBcDeFgH',
      name: 'Dish duty',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      members: [
        { id: 'm1', name: 'Alice', position: 1 },
        { id: 'm2', name: 'Bob', position: 2 },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Bob');
  });

  it('renders the add member form', async () => {
    const fixture = TestBed.createComponent(RotationPage);
    fixture.detectChanges();
    httpController.expectOne('/api/rotations/aBcDeFgH').flush({
      slug: 'aBcDeFgH',
      name: 'Dish duty',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      members: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-add-member-form')).toBeTruthy();
  });
});
