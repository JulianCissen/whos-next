import { Module } from '@nestjs/common';

import { MembersModule } from '../members/members.module.js';

import { RotationsController } from './rotations.controller.js';
import { RotationsService } from './rotations.service.js';

@Module({
  imports: [MembersModule],
  controllers: [RotationsController],
  providers: [RotationsService],
})
export class RotationsModule {}
