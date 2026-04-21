import { Module } from '@nestjs/common';

import { RotationsController } from './rotations.controller.js';
import { RotationsService } from './rotations.service.js';

@Module({
  controllers: [RotationsController],
  providers: [RotationsService],
})
export class RotationsModule {}
