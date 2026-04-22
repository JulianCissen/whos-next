import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import config from '../mikro-orm.config.js';

import { HealthModule } from './health/health.module.js';
import { MembersModule } from './members/members.module.js';
import { RotationsModule } from './rotations/rotations.module.js';

@Module({
  imports: [MikroOrmModule.forRoot(config), HealthModule, MembersModule, RotationsModule],
})
export class AppModule {}
