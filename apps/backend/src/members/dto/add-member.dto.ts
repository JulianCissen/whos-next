import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import type { AddMemberRequestDto } from '@whos-next/shared';
import { MEMBER_NAME_MAX_LENGTH } from '@whos-next/shared';

export class AddMemberDto implements AddMemberRequestDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Member name is required' })
  @MaxLength(MEMBER_NAME_MAX_LENGTH, {
    message: `Member name must be at most ${MEMBER_NAME_MAX_LENGTH} characters`,
  })
  name!: string;

  @IsString()
  @IsIn(['front', 'back'], { message: 'Placement must be "front" or "back"' })
  placement!: 'front' | 'back';
}
