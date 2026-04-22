import { Body, Controller, Delete, HttpCode, Param, Post, Put } from '@nestjs/common';

import type { AddMemberResponseDto, ReorderMembersResponseDto } from '@whos-next/shared';

import { AddMemberDto } from './dto/add-member.dto.js';
import { ReorderMembersDto } from './dto/reorder-members.dto.js';
import { MembersService } from './members.service.js';

@Controller('rotations/:slug/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @HttpCode(201)
  async add(@Param('slug') slug: string, @Body() dto: AddMemberDto): Promise<AddMemberResponseDto> {
    return this.membersService.add(slug, dto);
  }

  // PUT /order MUST be registered before DELETE /:memberId to prevent routing ambiguity.
  @Put('order')
  async reorder(
    @Param('slug') slug: string,
    @Body() dto: ReorderMembersDto,
  ): Promise<ReorderMembersResponseDto> {
    return this.membersService.reorder(slug, dto);
  }

  @Delete(':memberId')
  @HttpCode(204)
  async remove(@Param('slug') slug: string, @Param('memberId') memberId: string): Promise<void> {
    return this.membersService.remove(slug, memberId);
  }
}
