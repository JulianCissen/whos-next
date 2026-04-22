import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

import type { ReorderMembersRequestDto } from '@whos-next/shared';

export class ReorderMembersDto implements ReorderMembersRequestDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'memberIds must contain at least one ID' })
  @IsUUID('all', { each: true, message: 'Each member ID must be a valid UUID' })
  memberIds!: string[];
}
