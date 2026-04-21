import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  CreateRotationRequestDto,
  RenameRotationRequestDto,
  RotationResponseDto,
} from '@whos-next/shared';

@Injectable({ providedIn: 'root' })
export class RotationsApiService {
  private readonly http = inject(HttpClient);

  create(dto: CreateRotationRequestDto): Observable<RotationResponseDto> {
    return this.http.post<RotationResponseDto>('/api/rotations', dto);
  }

  get(slug: string): Observable<RotationResponseDto> {
    return this.http.get<RotationResponseDto>(`/api/rotations/${slug}`);
  }

  rename(slug: string, dto: RenameRotationRequestDto): Observable<RotationResponseDto> {
    return this.http.patch<RotationResponseDto>(`/api/rotations/${slug}`, dto);
  }

  delete(slug: string): Observable<void> {
    return this.http.delete<void>(`/api/rotations/${slug}`);
  }
}
