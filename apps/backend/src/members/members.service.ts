import { MikroORM, type EntityManager } from '@mikro-orm/core';
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
    const { em, rotation, activeMembers } = await this.getRotationContextOrThrow(slug);
    const queueLengthBefore = activeMembers.length;
    this.assertQueueCapacity(queueLengthBefore);
    const insertedAt = this.resolveInsertedAt(dto.placement, queueLengthBefore);
    const member = this.createActiveMember(rotation, dto.name, insertedAt);
    this.shiftForFrontInsert(activeMembers, dto.placement);
    this.updateNextIndexAfterAdd(rotation, queueLengthBefore, insertedAt);

    em.persist(member);
    await em.flush();

    return this.toAddResponse(member);
  }

  async remove(slug: string, memberId: string): Promise<void> {
    const { em, rotation, activeMembers } = await this.getRotationContextOrThrow(slug);
    const member = this.findActiveMemberOrThrow(activeMembers, memberId);
    const removedPosition = member.position!;
    this.markMemberRemoved(member);
    this.reindexAfterRemoval(activeMembers, memberId, removedPosition);
    this.updateNextIndexAfterRemove(rotation, activeMembers.length, removedPosition);

    await em.flush();
  }

  async reorder(slug: string, dto: ReorderMembersDto): Promise<ReorderMembersResponseDto> {
    const { em, rotation, activeMembers } = await this.getRotationContextOrThrow(slug);
    const { memberIds } = dto;
    this.assertReorderPayload(memberIds, activeMembers);
    const currentNext = activeMembers[rotation.nextIndex % Math.max(activeMembers.length, 1)];
    this.applyReorder(memberIds, activeMembers);
    const newPositionOfCurrentNext = memberIds.indexOf(currentNext.id) + 1;
    this.updateNextIndexAfterReorder(rotation, activeMembers.length, newPositionOfCurrentNext);
    await em.flush();
    return this.toReorderResponse(activeMembers);
  }

  private async getRotationContextOrThrow(
    slug: string,
  ): Promise<{ em: EntityManager; rotation: Rotation; activeMembers: Member[] }> {
    this.assertSlugOrThrow(slug);
    const em = this.orm.em.fork();
    const rotation = await this.getRotationOrThrow(em, slug);
    const activeMembers = await this.getActiveMembers(em, rotation);
    return { em, rotation, activeMembers };
  }

  private assertSlugOrThrow(slug: string): void {
    if (!SLUG_REGEX.test(slug)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }
  }

  private async getRotationOrThrow(em: EntityManager, slug: string): Promise<Rotation> {
    const rotation = await em.findOne(Rotation, { slug });
    if (!rotation) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }
    return rotation;
  }

  private getActiveMembers(em: EntityManager, rotation: Rotation): Promise<Member[]> {
    return em.find(Member, { rotation, removedAt: null }, { orderBy: { position: 'ASC' } });
  }

  private assertQueueCapacity(queueLength: number): void {
    if (queueLength >= MAX_QUEUE_SIZE) {
      throw new ConflictException({
        statusCode: 409,
        error: 'QUEUE_CAPACITY_EXCEEDED',
        message: `Queue is at maximum capacity of ${MAX_QUEUE_SIZE} members`,
      });
    }
  }

  private resolveInsertedAt(placement: AddMemberDto['placement'], queueLength: number): number {
    return placement === 'front' ? 1 : queueLength + 1;
  }

  private createActiveMember(rotation: Rotation, name: string, insertedAt: number): Member {
    const member = new Member();
    member.rotation = rotation;
    member.name = name;
    member.position = insertedAt;
    member.removedAt = null;
    return member;
  }

  private shiftForFrontInsert(activeMembers: Member[], placement: AddMemberDto['placement']): void {
    if (placement !== 'front' || activeMembers.length === 0) {
      return;
    }

    for (const member of activeMembers) {
      member.position = member.position! + 1;
    }
  }

  private updateNextIndexAfterAdd(
    rotation: Rotation,
    queueLengthBefore: number,
    insertedAt: number,
  ): void {
    rotation.nextIndex = adjustNextIndex(rotation.nextIndex, queueLengthBefore, {
      type: 'ADD',
      insertedAt,
    });
  }

  private findActiveMemberOrThrow(activeMembers: Member[], memberId: string): Member {
    const member = activeMembers.find((activeMember) => activeMember.id === memberId);
    if (!member) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found or already removed',
      });
    }
    return member;
  }

  private markMemberRemoved(member: Member): void {
    member.removedAt = new Date();
    member.position = null;
  }

  private reindexAfterRemoval(
    activeMembers: Member[],
    removedMemberId: string,
    removedPosition: number,
  ): void {
    for (const member of activeMembers) {
      if (member.id !== removedMemberId && (member.position ?? 0) > removedPosition) {
        member.position = member.position! - 1;
      }
    }
  }

  private updateNextIndexAfterRemove(
    rotation: Rotation,
    queueLengthBefore: number,
    removedPosition: number,
  ): void {
    rotation.nextIndex = adjustNextIndex(rotation.nextIndex, queueLengthBefore, {
      type: 'REMOVE',
      removedAt: removedPosition,
    });
  }

  private assertReorderPayload(memberIds: string[], activeMembers: Member[]): void {
    if (memberIds.length !== activeMembers.length) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'REORDER_INVALID',
        message: 'memberIds must contain exactly the active members',
      });
    }

    const activeIdSet = new Set(activeMembers.map((member) => member.id));
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
  }

  private applyReorder(memberIds: string[], activeMembers: Member[]): void {
    const memberMap = new Map(activeMembers.map((member) => [member.id, member]));
    memberIds.forEach((id, idx) => {
      memberMap.get(id)!.position = idx + 1;
    });
  }

  private updateNextIndexAfterReorder(
    rotation: Rotation,
    queueLengthBefore: number,
    newPositionOfCurrentNext: number,
  ): void {
    rotation.nextIndex = adjustNextIndex(rotation.nextIndex, queueLengthBefore, {
      type: 'REORDER',
      newPositionOfCurrentNext,
    });
  }

  private toAddResponse(member: Member): AddMemberResponseDto {
    return { id: member.id, name: member.name, position: member.position! };
  }

  private toReorderResponse(activeMembers: Member[]): ReorderMembersResponseDto {
    const sorted = activeMembers.toSorted((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return {
      members: sorted.map((m) => ({ id: m.id, name: m.name, position: m.position! })),
    };
  }
}
