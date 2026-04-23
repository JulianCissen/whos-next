import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  AddCustomDateRequestDto,
  BrowseOccurrencesResponseDto,
  ConfigureRecurrenceRuleRequestDto,
  CustomDateDto,
  OccurrenceWindowDto,
  ScheduleDto,
  SwitchScheduleTypeRequestDto,
} from '@whos-next/shared';

@Injectable({ providedIn: 'root' })
export class ScheduleApiService {
  private readonly http = inject(HttpClient);

  configureRecurrenceRule(
    slug: string,
    dto: ConfigureRecurrenceRuleRequestDto,
  ): Observable<ScheduleDto> {
    return this.http.put<ScheduleDto>(`/api/rotations/${slug}/schedule/recurrence-rule`, dto);
  }

  switchType(slug: string, dto: SwitchScheduleTypeRequestDto): Observable<ScheduleDto> {
    return this.http.put<ScheduleDto>(`/api/rotations/${slug}/schedule/type`, dto);
  }

  addDate(slug: string, dto: AddCustomDateRequestDto): Observable<CustomDateDto> {
    return this.http.post<CustomDateDto>(`/api/rotations/${slug}/schedule/dates`, dto);
  }

  removeDate(slug: string, date: string): Observable<void> {
    return this.http.delete<void>(`/api/rotations/${slug}/schedule/dates/${date}`);
  }
}

@Injectable({ providedIn: 'root' })
export class OccurrencesApiService {
  private readonly http = inject(HttpClient);

  getWindow(slug: string): Observable<OccurrenceWindowDto> {
    return this.http.get<OccurrenceWindowDto>(`/api/rotations/${slug}/occurrences`);
  }

  browse(
    slug: string,
    params: { after?: string; before?: string; limit?: number },
  ): Observable<BrowseOccurrencesResponseDto> {
    const query = new URLSearchParams();
    if (params.after !== undefined) query.set('after', params.after);
    if (params.before !== undefined) query.set('before', params.before);
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    return this.http.get<BrowseOccurrencesResponseDto>(
      `/api/rotations/${slug}/occurrences/browse?${query.toString()}`,
    );
  }
}
