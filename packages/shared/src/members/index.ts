export const MEMBER_NAME_MIN_LENGTH = 1;
export const MEMBER_NAME_MAX_LENGTH = 100;

const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F-\u009F]/;

export interface MemberDto {
  id: string;
  name: string;
  position: number;
}

export interface AddMemberRequestDto {
  name: string;
  placement: 'front' | 'back';
}

export type AddMemberResponseDto = MemberDto;

export interface ReorderMembersRequestDto {
  memberIds: string[];
}

export interface ReorderMembersResponseDto {
  members: MemberDto[];
}

export interface ActiveQueueEntry {
  memberId: string;
  memberName: string;
}

export interface UpcomingAssignment {
  date: Date;
  memberId: string | null;
  memberName: string | null;
}

export type MemberNameValidationResult =
  | { ok: true; value: string }
  | { ok: false; reason: string };

export function validateMemberName(raw: string): MemberNameValidationResult {
  const trimmed = raw.trim();
  if (trimmed.length < MEMBER_NAME_MIN_LENGTH) {
    return { ok: false, reason: 'member.validation.name_required' };
  }
  if (trimmed.length > MEMBER_NAME_MAX_LENGTH) {
    return { ok: false, reason: 'member.validation.name_too_long' };
  }
  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    return { ok: false, reason: 'member.validation.name_invalid_chars' };
  }
  return { ok: true, value: trimmed };
}

/**
 * Computes upcoming assignments from the current active queue, cycle pointer,
 * and list of dates. Pure function — identical inputs always produce identical
 * output (FR-012, FR-013, FR-016).
 */
export function assignMembers(
  activeQueue: ActiveQueueEntry[],
  nextIndex: number,
  upcomingDates: Date[],
): UpcomingAssignment[] {
  if (activeQueue.length === 0) {
    return upcomingDates.map((date) => ({ date, memberId: null, memberName: null }));
  }
  return upcomingDates.map((date, offset) => {
    const idx = (nextIndex + offset) % activeQueue.length;
    return {
      date,
      memberId: activeQueue[idx].memberId,
      memberName: activeQueue[idx].memberName,
    };
  });
}
