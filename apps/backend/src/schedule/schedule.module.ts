import { Module } from '@nestjs/common';

import { OccurrenceService } from './occurrence.service.js';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleService } from './schedule.service.js';

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService, OccurrenceService],
  exports: [ScheduleService, OccurrenceService],
})
export class ScheduleModule {}
