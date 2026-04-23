import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';

import type {
  AddCustomDateRequestDto,
  BrowseOccurrencesResponseDto,
  ConfigureRecurrenceRuleRequestDto,
  CustomDateDto,
  OccurrenceWindowDto,
  ScheduleDto,
  SwitchScheduleTypeRequestDto,
} from '@whos-next/shared';

import { OccurrenceService } from './occurrence.service.js';
import { ScheduleService } from './schedule.service.js';

@Controller('rotations/:slug')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly occurrenceService: OccurrenceService,
  ) {}

  @Get('occurrences')
  async getOccurrenceWindow(@Param('slug') slug: string): Promise<OccurrenceWindowDto> {
    return this.occurrenceService.getWindow(slug);
  }

  @Get('occurrences/browse')
  async browseOccurrences(
    @Param('slug') slug: string,
    @Query('after') after?: string,
    @Query('before') before?: string,
    @Query('limit') limitStr?: string,
  ): Promise<BrowseOccurrencesResponseDto> {
    const limit = limitStr === undefined ? 1 : Number.parseInt(limitStr, 10);
    return this.occurrenceService.browse(slug, after, before, limit);
  }

  @Put('schedule/recurrence-rule')
  async configureRecurrenceRule(
    @Param('slug') slug: string,
    @Body() dto: ConfigureRecurrenceRuleRequestDto,
  ): Promise<ScheduleDto> {
    return this.scheduleService.configureRecurrenceRule(slug, dto);
  }

  @Put('schedule/type')
  async switchScheduleType(
    @Param('slug') slug: string,
    @Body() dto: SwitchScheduleTypeRequestDto,
  ): Promise<ScheduleDto> {
    return this.scheduleService.switchType(slug, dto);
  }

  @Post('schedule/dates')
  @HttpCode(201)
  async addDate(
    @Param('slug') slug: string,
    @Body() dto: AddCustomDateRequestDto,
  ): Promise<CustomDateDto> {
    return this.scheduleService.addDate(slug, dto);
  }

  @Delete('schedule/dates/:date')
  @HttpCode(204)
  async removeDate(@Param('slug') slug: string, @Param('date') date: string): Promise<void> {
    return this.scheduleService.removeDate(slug, date);
  }
}
