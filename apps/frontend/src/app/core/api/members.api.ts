import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  AddMemberRequestDto,
  AddMemberResponseDto,
  ReorderMembersRequestDto,
  ReorderMembersResponseDto,
} from '@whos-next/shared';

@Injectable({ providedIn: 'root' })
export class MembersApiService {
  private readonly http = inject(HttpClient);

  addMember(slug: string, dto: AddMemberRequestDto): Observable<AddMemberResponseDto> {
    return this.http.post<AddMemberResponseDto>(`/api/rotations/${slug}/members`, dto);
  }

  removeMember(slug: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`/api/rotations/${slug}/members/${memberId}`);
  }

  reorderMembers(
    slug: string,
    dto: ReorderMembersRequestDto,
  ): Observable<ReorderMembersResponseDto> {
    return this.http.put<ReorderMembersResponseDto>(`/api/rotations/${slug}/members/order`, dto);
  }
}
