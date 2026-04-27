import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';

import type {
  AddCustomDateRequestDto,
  BrowseOccurrencesResponseDto,
  CancelOccurrenceResponseDto,
  ConfigureRecurrenceRuleRequestDto,
  CustomDateDto,
  OccurrenceWindowDto,
  ScheduleDto,
  SwitchScheduleTypeRequestDto,
  UncancelOccurrenceResponseDto,
} from '@whos-next/shared';

import { CancelService } from './cancel.service.js';
import { OccurrenceService } from './occurrence.service.js';
import { ScheduleService } from './schedule.service.js';

@Controller('rotations/:slug')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly occurrenceService: OccurrenceService,
    private readonly cancelService: CancelService,
  ) {}

  @Get('occurrences')
  async getOccurrenceWindow(
    @Param('slug') slug: string,
    @Query('past') pastStr?: string,
    @Query('future') futureStr?: string,
  ): Promise<OccurrenceWindowDto> {
    const pastCount =
      pastStr === undefined ? undefined : Math.min(52, Math.max(0, Number.parseInt(pastStr, 10)));
    const futureCount =
      futureStr === undefined
        ? undefined
        : Math.min(52, Math.max(0, Number.parseInt(futureStr, 10)));
    return this.occurrenceService.getWindow(slug, pastCount, futureCount);
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

  @Post('occurrences/:date/cancel')
  async cancelOccurrence(
    @Param('slug') slug: string,
    @Param('date') date: string,
  ): Promise<CancelOccurrenceResponseDto> {
    return this.cancelService.cancel(slug, date);
  }

  @Delete('occurrences/:date/cancel')
  @HttpCode(200)
  async uncancelOccurrence(
    @Param('slug') slug: string,
    @Param('date') date: string,
  ): Promise<UncancelOccurrenceResponseDto> {
    return this.cancelService.uncancel(slug, date);
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
