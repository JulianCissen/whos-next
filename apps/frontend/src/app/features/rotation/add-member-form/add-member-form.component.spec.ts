import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TranslateModule } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AddMemberFormComponent } from './add-member-form.component';

const SLUG = 'test-slug';

function buildFixture() {
  const fixture = TestBed.createComponent(AddMemberFormComponent);
  fixture.componentRef.setInput('slug', SLUG);
  fixture.detectChanges();
  return fixture;
}

describe('AddMemberFormComponent', () => {
  let httpController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddMemberFormComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimationsAsync(),
      ],
    }).compileComponents();
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('renders name input and placement toggles', () => {
    const fixture = buildFixture();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('input')).toBeTruthy();
    expect(el.querySelectorAll('mat-button-toggle').length).toBe(2);
  });

  it('does not call API when name is empty', () => {
    const fixture = buildFixture();
    (fixture.nativeElement.querySelector('form') as HTMLElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    httpController.expectNone(`/api/rotations/${SLUG}/members`);
  });

  it('posts to API with name and placement on valid submit', async () => {
    const fixture = buildFixture();
    fixture.componentInstance.form.controls.name.setValue('Alice');
    fixture.componentInstance.form.controls.placement.setValue('back');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLElement).dispatchEvent(new Event('submit'));

    const req = httpController.expectOne(`/api/rotations/${SLUG}/members`);
    expect(req.request.body).toEqual({ name: 'Alice', placement: 'back' });
    req.flush({ id: '1', name: 'Alice', position: 1 });
    await fixture.whenStable();
  });

  it('emits memberAdded and clears name on success', async () => {
    const fixture = buildFixture();
    const emitted: unknown[] = [];
    fixture.componentInstance.memberAdded.subscribe((v) => emitted.push(v));

    fixture.componentInstance.form.controls.name.setValue('Bob');
    fixture.componentInstance.form.controls.placement.setValue('front');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLElement).dispatchEvent(new Event('submit'));
    httpController
      .expectOne(`/api/rotations/${SLUG}/members`)
      .flush({ id: '2', name: 'Bob', position: 1 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ id: '2', name: 'Bob', position: 1 });
    expect(fixture.componentInstance.form.controls.name.value).toBe('');
  });

  it('shows capacity error on 409', async () => {
    const fixture = buildFixture();
    fixture.componentInstance.form.controls.name.setValue('Eve');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLElement).dispatchEvent(new Event('submit'));
    httpController
      .expectOne(`/api/rotations/${SLUG}/members`)
      .flush({ error: 'ROTATION_AT_CAPACITY' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.capacityError()).toBe(true);
    expect(fixture.componentInstance.genericError()).toBe(false);
  });

  it('shows generic error on non-409 server error', async () => {
    const fixture = buildFixture();
    fixture.componentInstance.form.controls.name.setValue('Eve');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLElement).dispatchEvent(new Event('submit'));
    httpController
      .expectOne(`/api/rotations/${SLUG}/members`)
      .flush({ error: 'INTERNAL' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.genericError()).toBe(true);
    expect(fixture.componentInstance.capacityError()).toBe(false);
  });
});
