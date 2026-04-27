import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { ThemeService } from '../../core/theme.service.js';

@Component({
  selector: 'app-theme-toggle-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, TranslateModule],
  template: `
    <button
      class="theme-btn"
      type="button"
      [attr.aria-label]="'theme.toggle_label' | translate"
      (click)="cycle()"
    >
      <mat-icon>{{ icon() }}</mat-icon>
    </button>
  `,
  styles: `
    .theme-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 50%;
      background: none;
      color: var(--mat-sys-on-surface-variant);
      cursor: pointer;
      transition:
        background 130ms ease,
        color 130ms ease;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &:hover {
        background: var(--mat-sys-surface-container);
        color: var(--mat-sys-on-surface);
      }
    }
  `,
})
export class ThemeToggleButtonComponent {
  private readonly theme = inject(ThemeService);

  protected readonly icon = computed(() =>
    this.theme.current() === 'dark' ? 'dark_mode' : 'light_mode',
  );

  protected cycle(): void {
    this.theme.cycle();
  }
}
