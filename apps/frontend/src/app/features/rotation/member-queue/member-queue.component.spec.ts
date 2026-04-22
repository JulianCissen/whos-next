import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import type { MemberDto } from '@whos-next/shared';

import { MemberQueueComponent } from './member-queue.component';

const MEMBERS: MemberDto[] = [
  { id: 'a1', name: 'Alice', position: 1 },
  { id: 'b2', name: 'Bob', position: 2 },
];

function buildFixture(members: MemberDto[]) {
  const fixture = TestBed.createComponent(MemberQueueComponent);
  fixture.componentRef.setInput('members', members);
  fixture.detectChanges();
  return fixture;
}

describe('MemberQueueComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberQueueComponent, TranslateModule.forRoot()],
      providers: [provideZonelessChangeDetection(), provideAnimationsAsync()],
    }).compileComponents();
  });

  it('renders empty state when no members', () => {
    const fixture = buildFixture([]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
    expect(el.querySelector('.queue-list')).toBeNull();
  });

  it('renders a list item for each member', () => {
    const fixture = buildFixture(MEMBERS);
    const items = fixture.nativeElement.querySelectorAll('.queue-item');
    expect(items).toHaveLength(2);
  });

  it('renders member names', () => {
    const fixture = buildFixture(MEMBERS);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Bob');
  });

  it('emits memberRemoved with correct id when remove button is clicked', async () => {
    const fixture = buildFixture(MEMBERS);
    const emitted: string[] = [];
    fixture.componentInstance.memberRemoved.subscribe((id) => emitted.push(id));

    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button[type="button"]');
    buttons[0].click();
    await fixture.whenStable();

    expect(emitted).toEqual(['a1']);
  });

  it('does not render empty state when members are provided', () => {
    const fixture = buildFixture(MEMBERS);
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
  });

  it('emits membersReordered with swapped order when onDrop is called', () => {
    const fixture = buildFixture(MEMBERS);
    const emitted: string[][] = [];
    fixture.componentInstance.membersReordered.subscribe((ids) => emitted.push(ids));

    // Simulate drop: move Alice (index 0) to index 1
    fixture.componentInstance.onDrop({
      previousIndex: 0,
      currentIndex: 1,
      item: {} as never,
      container: { data: MEMBERS } as never,
      previousContainer: { data: MEMBERS } as never,
      isPointerOverContainer: true,
      distance: { x: 0, y: 0 },
      dropPoint: { x: 0, y: 0 },
      event: new MouseEvent('mouseup'),
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(['b2', 'a1']);
  });

  it('updates localMembers optimistically after drop', () => {
    const fixture = buildFixture(MEMBERS);
    const component = fixture.componentInstance;

    component.onDrop({
      previousIndex: 0,
      currentIndex: 1,
      item: {} as never,
      container: { data: MEMBERS } as never,
      previousContainer: { data: MEMBERS } as never,
      isPointerOverContainer: true,
      distance: { x: 0, y: 0 },
      dropPoint: { x: 0, y: 0 },
      event: new MouseEvent('mouseup'),
    });

    const local = component.localMembers();
    expect(local[0].name).toBe('Bob');
    expect(local[0].position).toBe(1);
    expect(local[1].name).toBe('Alice');
    expect(local[1].position).toBe(2);
  });

  it('syncs localMembers when input members change', () => {
    const fixture = buildFixture(MEMBERS);
    const carol: MemberDto = { id: 'c3', name: 'Carol', position: 1 };
    fixture.componentRef.setInput('members', [carol]);
    fixture.detectChanges();

    expect(fixture.componentInstance.localMembers()).toEqual([carol]);
  });
});
