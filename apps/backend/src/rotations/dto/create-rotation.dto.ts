import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

import type { CreateRotationRequestDto } from '@whos-next/shared';
import { ROTATION_NAME_MAX_LENGTH } from '@whos-next/shared';

const CONTROL_CHAR_PATTERN = /^[^\u0000-\u001F\u007F-\u009F]*$/;

export class CreateRotationDto implements CreateRotationRequestDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(ROTATION_NAME_MAX_LENGTH, {
    message: `Name must be at most ${ROTATION_NAME_MAX_LENGTH} characters`,
  })
  @Matches(CONTROL_CHAR_PATTERN, { message: 'Name must not contain control characters' })
  name!: string;
}
