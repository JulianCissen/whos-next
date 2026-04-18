import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import config from '../mikro-orm.config.js';

import { HealthModule } from './health/health.module.js';

@Module({
  imports: [MikroOrmModule.forRoot(config), HealthModule],
})
export class AppModule {}
