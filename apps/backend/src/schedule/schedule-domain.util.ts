import type { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { SLUG_REGEX } from '@whos-next/shared';

import { Member } from '../members/member.entity.js';
import { Rotation } from '../rotations/rotation.entity.js';

import { Schedule } from './schedule.entity.js';

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type ErrorPayload = {
  statusCode: number;
  error: string;
  message: string;
};

export function assertSlugOrThrow(slug: string): void {
  if (!SLUG_REGEX.test(slug)) {
    throwRotationNotFound();
  }
}

export async function getRotationOrThrow(em: EntityManager, slug: string): Promise<Rotation> {
  assertSlugOrThrow(slug);
  const rotation = await em.findOne(Rotation, { slug });
  if (!rotation) {
    throwRotationNotFound();
  }
  return rotation;
}

export async function getScheduleOrThrow(em: EntityManager, rotation: Rotation): Promise<Schedule> {
  const schedule = await em.findOne(Schedule, { rotation });
  if (!schedule) {
    throw new NotFoundException({
      statusCode: 404,
      error: 'SCHEDULE_NOT_FOUND',
      message: 'Schedule not found',
    });
  }
  return schedule;
}

export function assertIsoDateOrBadRequest(date: string, error: ErrorPayload): void {
  if (!ISO_DATE_REGEX.test(date)) {
    throw new BadRequestException(error);
  }
}

export function assertIsoDateOrUnprocessable(date: string, error: ErrorPayload): void {
  if (!ISO_DATE_REGEX.test(date)) {
    throw new UnprocessableEntityException(error);
  }
}

export function throwRotationNotFound(): never {
  throw new NotFoundException({
    statusCode: 404,
    error: 'ROTATION_NOT_FOUND',
    message: 'Rotation not found',
  });
}

export function throwOccurrenceNotInSchedule(): never {
  throw new BadRequestException({
    statusCode: 400,
    error: 'OCCURRENCE_NOT_IN_SCHEDULE',
    message: 'This date is not a scheduled occurrence for this rotation',
  });
}

export function getActiveQueue(em: EntityManager, rotation: Rotation): Promise<Member[]> {
  return em.find(Member, { rotation, removedAt: null }, { orderBy: { position: 'ASC' } });
}
