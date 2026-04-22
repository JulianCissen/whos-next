import { MikroORM } from '@mikro-orm/core';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AddMemberResponseDto, ReorderMembersResponseDto } from '@whos-next/shared';
import { SLUG_REGEX } from '@whos-next/shared';

import { Rotation } from '../rotations/rotation.entity.js';

import { adjustNextIndex } from './assignment.helper.js';
import type { AddMemberDto } from './dto/add-member.dto.js';
import type { ReorderMembersDto } from './dto/reorder-members.dto.js';
import { Member } from './member.entity.js';

const MAX_QUEUE_SIZE = 100;

@Injectable()
export class MembersService {
  constructor(private readonly orm: MikroORM) {}

  async add(slug: string, dto: AddMemberDto): Promise<AddMemberResponseDto> {
    if (!SLUG_REGEX.test(slug)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }

    const em = this.orm.em.fork();
    const rotation = await em.findOne(Rotation, { slug });
    if (!rotation) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }

    const activeMembers = await em.find(
      Member,
      { rotation, removedAt: null },
      { orderBy: { position: 'ASC' } },
    );

    if (activeMembers.length >= MAX_QUEUE_SIZE) {
      throw new ConflictException({
        statusCode: 409,
        error: 'QUEUE_CAPACITY_EXCEEDED',
        message: `Queue is at maximum capacity of ${MAX_QUEUE_SIZE} members`,
      });
    }

    const queueLengthBefore = activeMembers.length;
    const insertedAt = dto.placement === 'front' ? 1 : queueLengthBefore + 1;
    const needsFrontShift = dto.placement === 'front' && queueLengthBefore > 0;

    const member = new Member();
    member.rotation = rotation;
    member.name = dto.name;
    member.position = insertedAt;
    member.removedAt = null;

    rotation.nextIndex = adjustNextIndex(rotation.nextIndex, queueLengthBefore, {
      type: 'ADD',
      insertedAt,
    });

    if (needsFrontShift) {
      for (const m of activeMembers) {
        m.position = m.position! + 1;
      }
    }

    em.persist(member);
    await em.flush();

    return {
      id: member.id,
      name: member.name,
      position: member.position,
    };
  }

  async remove(slug: string, memberId: string): Promise<void> {
    if (!SLUG_REGEX.test(slug)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }

    const em = this.orm.em.fork();
    const rotation = await em.findOne(Rotation, { slug });
    if (!rotation) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }

    const activeMembers = await em.find(
      Member,
      { rotation, removedAt: null },
      { orderBy: { position: 'ASC' } },
    );

    const member = activeMembers.find((m) => m.id === memberId);
    if (!member) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found or already removed',
      });
    }

    const removedPosition = member.position!;
    member.removedAt = new Date();
    member.position = null;

    for (const m of activeMembers) {
      if (m.id !== memberId && (m.position ?? 0) > removedPosition) {
        m.position = m.position! - 1;
      }
    }

    rotation.nextIndex = adjustNextIndex(rotation.nextIndex, activeMembers.length, {
      type: 'REMOVE',
      removedAt: removedPosition,
    });

    await em.flush();
  }

  async reorder(slug: string, dto: ReorderMembersDto): Promise<ReorderMembersResponseDto> {
    if (!SLUG_REGEX.test(slug)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }

    const em = this.orm.em.fork();
    const rotation = await em.findOne(Rotation, { slug });
    if (!rotation) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }

    const activeMembers = await em.find(
      Member,
      { rotation, removedAt: null },
      { orderBy: { position: 'ASC' } },
    );

    const activeIdSet = new Set(activeMembers.map((m) => m.id));
    const { memberIds } = dto;

    if (memberIds.length !== activeMembers.length) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'REORDER_INVALID',
        message: 'memberIds must contain exactly the active members',
      });
    }

    const seen = new Set<string>();
    for (const id of memberIds) {
      if (!activeIdSet.has(id) || seen.has(id)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'REORDER_INVALID',
          message: 'memberIds contains unknown or duplicate IDs',
        });
      }
      seen.add(id);
    }

    const currentNext = activeMembers[rotation.nextIndex % Math.max(activeMembers.length, 1)];
    const memberMap = new Map(activeMembers.map((m) => [m.id, m]));
    memberIds.forEach((id, idx) => {
      memberMap.get(id)!.position = idx + 1;
    });

    const newPositionOfCurrentNext = memberIds.indexOf(currentNext.id) + 1;
    rotation.nextIndex = adjustNextIndex(rotation.nextIndex, activeMembers.length, {
      type: 'REORDER',
      newPositionOfCurrentNext,
    });

    await em.flush();

    const sorted = activeMembers.toSorted((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return {
      members: sorted.map((m) => ({ id: m.id, name: m.name, position: m.position! })),
    };
  }
}
