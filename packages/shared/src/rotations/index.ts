import type { MemberDto } from '../members/index.js';
import type { CreateRotationScheduleDto, ScheduleDto } from '../schedule/index.js';

export const SLUG_LENGTH = 8;
export const SLUG_REGEX = /^[1-9A-HJ-NP-Za-km-z]{8}$/;
export const ROTATION_NAME_MIN_LENGTH = 1;
export const ROTATION_NAME_MAX_LENGTH = 100;

const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F-\u009F]/;

export interface CreateRotationRequestDto {
  name: string;
  schedule: CreateRotationScheduleDto;
}

export interface RenameRotationRequestDto {
  name: string;
}

export interface RotationResponseDto {
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  members: MemberDto[];
  schedule: ScheduleDto | null;
}

export interface ApiErrorResponseDto {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export type RotationNameValidationResult =
  | { ok: true; value: string }
  | { ok: false; reason: string };

export function validateRotationName(raw: string): RotationNameValidationResult {
  const trimmed = raw.trim();
  if (trimmed.length < ROTATION_NAME_MIN_LENGTH) {
    return { ok: false, reason: 'rotation.validation.name_required' };
  }
  if (trimmed.length > ROTATION_NAME_MAX_LENGTH) {
    return { ok: false, reason: 'rotation.validation.name_too_long' };
  }
  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    return { ok: false, reason: 'rotation.validation.name_invalid_chars' };
  }
  return { ok: true, value: trimmed };
}
