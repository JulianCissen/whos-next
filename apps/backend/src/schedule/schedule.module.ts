import { Module } from '@nestjs/common';

import { CancelService } from './cancel.service.js';
import { OccurrenceService } from './occurrence.service.js';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleService } from './schedule.service.js';

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService, OccurrenceService, CancelService],
  exports: [ScheduleService, OccurrenceService, CancelService],
})
export class ScheduleModule {}
