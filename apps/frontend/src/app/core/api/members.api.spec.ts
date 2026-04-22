import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MembersApiService } from './members.api';

describe('MembersApiService', () => {
  let service: MembersApiService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MembersApiService],
    });
    service = TestBed.inject(MembersApiService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('addMember() POSTs to /api/rotations/:slug/members', () => {
    service.addMember('aBcDeFgH', { name: 'Alice', placement: 'back' }).subscribe((result) => {
      expect(result.id).toBe('m1');
      expect(result.name).toBe('Alice');
      expect(result.position).toBe(1);
    });

    const req = httpController.expectOne('/api/rotations/aBcDeFgH/members');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Alice', placement: 'back' });
    req.flush({ id: 'm1', name: 'Alice', position: 1 });
  });

  it('removeMember() DELETEs /api/rotations/:slug/members/:memberId', () => {
    service.removeMember('aBcDeFgH', 'm1').subscribe();

    const req = httpController.expectOne('/api/rotations/aBcDeFgH/members/m1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reorderMembers() PUTs to /api/rotations/:slug/members/order', () => {
    const memberIds = ['m2', 'm1'];
    service.reorderMembers('aBcDeFgH', { memberIds }).subscribe((result) => {
      expect(result.members).toHaveLength(2);
      expect(result.members[0].name).toBe('Bob');
    });

    const req = httpController.expectOne('/api/rotations/aBcDeFgH/members/order');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ memberIds });
    req.flush({
      members: [
        { id: 'm2', name: 'Bob', position: 1 },
        { id: 'm1', name: 'Alice', position: 2 },
      ],
    });
  });

  it('addMember() passes through HTTP errors', () => {
    let errorStatus = 0;
    service.addMember('aBcDeFgH', { name: 'Alice', placement: 'back' }).subscribe({
      error: (e: { status: number }) => {
        errorStatus = e.status;
      },
    });

    const req = httpController.expectOne('/api/rotations/aBcDeFgH/members');
    req.flush(
      { statusCode: 409, error: 'QUEUE_CAPACITY_EXCEEDED', message: 'Queue is full' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(errorStatus).toBe(409);
  });
});
