import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard-skeleton.component.scss',
  template: `
    <div class="skeleton" aria-busy="true" aria-label="Loading rotation">
      <div class="skeleton__hero">
        <div class="skeleton__line skeleton__line--sm shimmer"></div>
        <div class="skeleton__line skeleton__line--lg shimmer"></div>
        <div class="skeleton__line skeleton__line--md shimmer"></div>
        <div class="skeleton__btn shimmer"></div>
      </div>
      <div class="skeleton__timeline">
        @for (_ of rows; track $index) {
          <div class="skeleton__row">
            <div class="skeleton__dot shimmer"></div>
            <div class="skeleton__row-body">
              <div class="skeleton__line skeleton__line--md shimmer"></div>
              <div class="skeleton__line skeleton__line--sm shimmer"></div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class DashboardSkeletonComponent {
  protected readonly rows = [0, 1, 2, 3, 4];
}
