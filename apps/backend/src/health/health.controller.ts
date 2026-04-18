import { MikroORM } from '@mikro-orm/core';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import type { HealthResponseDto } from '@whos-next/shared';

@Controller('health')
export class HealthController {
  constructor(private readonly orm: MikroORM) {}

  @Get()
  async check(): Promise<HealthResponseDto> {
    try {
      const connection = this.orm.em.getConnection();
      await connection.execute('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database connection failed');
    }

    return { status: 'ok', database: 'connected' };
  }
}
