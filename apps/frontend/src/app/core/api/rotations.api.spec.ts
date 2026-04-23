import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RotationsApiService } from './rotations.api';

describe('RotationsApiService', () => {
  let service: RotationsApiService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RotationsApiService],
    });
    service = TestBed.inject(RotationsApiService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('create() POSTs to /api/rotations', () => {
    service
      .create({ name: 'Dish duty', schedule: { type: 'custom_date_list' } })
      .subscribe((result) => {
        expect(result.name).toBe('Dish duty');
        expect(result.slug).toBe('aBcDeFgH');
      });

    const req = httpController.expectOne('/api/rotations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Dish duty', schedule: { type: 'custom_date_list' } });
    req.flush({
      slug: 'aBcDeFgH',
      name: 'Dish duty',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('get() GETs /api/rotations/:slug', () => {
    service.get('aBcDeFgH').subscribe((result) => {
      expect(result.slug).toBe('aBcDeFgH');
    });

    const req = httpController.expectOne('/api/rotations/aBcDeFgH');
    expect(req.request.method).toBe('GET');
    req.flush({
      slug: 'aBcDeFgH',
      name: 'Dish duty',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('rename() PATCHes /api/rotations/:slug', () => {
    service.rename('aBcDeFgH', { name: 'New name' }).subscribe((result) => {
      expect(result.name).toBe('New name');
    });

    const req = httpController.expectOne('/api/rotations/aBcDeFgH');
    expect(req.request.method).toBe('PATCH');
    req.flush({
      slug: 'aBcDeFgH',
      name: 'New name',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('delete() DELETEs /api/rotations/:slug', () => {
    service.delete('aBcDeFgH').subscribe();

    const req = httpController.expectOne('/api/rotations/aBcDeFgH');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('get() passes through HTTP errors', () => {
    let errorStatus = 0;
    service.get('aBcDeFgH').subscribe({
      error: (e: { status: number }) => {
        errorStatus = e.status;
      },
    });

    const req = httpController.expectOne('/api/rotations/aBcDeFgH');
    req.flush({ error: 'ROTATION_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    expect(errorStatus).toBe(404);
  });
});
