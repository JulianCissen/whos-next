import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import type { RotationResponseDto } from '@whos-next/shared';

import { CreateRotationDto } from './dto/create-rotation.dto.js';
import { RenameRotationDto } from './dto/rename-rotation.dto.js';
import { RotationsService } from './rotations.service.js';

@Controller('rotations')
export class RotationsController {
  constructor(private readonly service: RotationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRotationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RotationResponseDto> {
    const rotation = await this.service.create(dto);
    res.setHeader('Location', `/api/rotations/${rotation.slug}`);
    return rotation;
  }

  @Get(':slug')
  async get(@Param('slug') slug: string): Promise<RotationResponseDto> {
    return this.service.findBySlug(slug);
  }

  @Patch(':slug')
  async rename(
    @Param('slug') slug: string,
    @Body() dto: RenameRotationDto,
  ): Promise<RotationResponseDto> {
    return this.service.rename(slug, dto);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('slug') slug: string): Promise<void> {
    return this.service.delete(slug);
  }
}
