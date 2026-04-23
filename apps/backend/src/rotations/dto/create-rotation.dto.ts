import { Type, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import type {
  CreateRotationRequestDto,
  CreateRotationScheduleDto,
  IsoWeekday,
  RecurrenceRuleDto,
  RecurrenceRuleType,
  ScheduleType,
} from '@whos-next/shared';
import { ROTATION_NAME_MAX_LENGTH } from '@whos-next/shared';

const CONTROL_CHAR_PATTERN = /^[^\u0000-\u001F\u007F-\u009F]*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class RecurrenceRuleValidationDto implements RecurrenceRuleDto {
  @IsIn(['weekly', 'every_n_weeks', 'monthly'])
  type!: RecurrenceRuleType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: IsoWeekday;

  @IsOptional()
  @IsInt()
  @Min(2)
  intervalN?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  monthlyDay?: number;
}

class CreateScheduleValidationDto implements CreateRotationScheduleDto {
  @IsIn(['recurrence_rule', 'custom_date_list'])
  type!: ScheduleType;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceRuleValidationDto)
  recurrenceRule?: RecurrenceRuleDto;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'startDate must be a valid ISO date (YYYY-MM-DD)' })
  startDate?: string;
}

export class CreateRotationDto implements CreateRotationRequestDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(ROTATION_NAME_MAX_LENGTH, {
    message: `Name must be at most ${ROTATION_NAME_MAX_LENGTH} characters`,
  })
  @Matches(CONTROL_CHAR_PATTERN, { message: 'Name must not contain control characters' })
  name!: string;

  @ValidateNested()
  @Type(() => CreateScheduleValidationDto)
  schedule!: CreateRotationScheduleDto;
}
