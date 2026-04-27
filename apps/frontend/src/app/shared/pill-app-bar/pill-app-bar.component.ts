import { NgTemplateOutlet } from '@angular/common';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
} from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '../../core/language.service.js';
import { ThemeService } from '../../core/theme.service.js';

@Component({
  selector: 'app-pill-app-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDividerModule, MatIconModule, MatMenuModule, NgTemplateOutlet, TranslateModule],
  styleUrl: './pill-app-bar.component.scss',
  template: `
    <nav class="pill-bar" [class.pill-bar--dashboard]="dashboard()" aria-label="Page navigation">
      <div class="pill-bar__left">
        <ng-content select="[slot=left]" />
      </div>
      <div class="pill-bar__right">
        <div class="pill-bar__right-slot">
          <ng-content select="[slot=right]" />
        </div>
        <div class="pill-bar__sep" aria-hidden="true"></div>
        <div class="pill-bar__builtin">
          <button
            class="pill-bar__icon-btn"
            type="button"
            (click)="cycleTheme()"
            [attr.aria-label]="themeLabel() | translate"
          >
            <mat-icon>{{ themeIcon() }}</mat-icon>
          </button>
          <button
            class="pill-bar__lang-btn"
            type="button"
            [matMenuTriggerFor]="langMenu"
            [attr.aria-label]="'language.label' | translate"
          >
            <mat-icon>language</mat-icon>
            <span class="pill-bar__lang-label">{{ langCode() }}</span>
          </button>
        </div>
        <button
          class="pill-bar__icon-btn pill-bar__overflow-btn"
          type="button"
          [matMenuTriggerFor]="mobileMenu"
          [attr.aria-label]="'nav.more_actions' | translate"
        >
          <mat-icon>more_horiz</mat-icon>
        </button>
      </div>
    </nav>

    <mat-menu #mobileMenu="matMenu">
      @if (overflowTpl(); as tpl) {
        <ng-container [ngTemplateOutlet]="tpl" />
        <mat-divider />
      }
      <button mat-menu-item (click)="cycleTheme()">
        <mat-icon>{{ themeIcon() }}</mat-icon>
        {{ themeLabel() | translate }}
      </button>
      <button mat-menu-item [matMenuTriggerFor]="langMenu">
        <mat-icon>language</mat-icon>
        {{ 'language.label' | translate }}
      </button>
    </mat-menu>

    <mat-menu #langMenu="matMenu">
      <button mat-menu-item (click)="setLang('en')">
        @if (langCode() === 'EN') {
          <mat-icon>check</mat-icon>
        }
        English
      </button>
      <button mat-menu-item (click)="setLang('nl')">
        @if (langCode() === 'NL') {
          <mat-icon>check</mat-icon>
        }
        Nederlands
      </button>
    </mat-menu>
  `,
})
export class PillAppBarComponent {
  private readonly theme = inject(ThemeService);
  private readonly lang = inject(LanguageService);

  readonly dashboard = input(false);
  readonly overflowTpl = contentChild<TemplateRef<unknown>>('overflow');

  protected readonly themeIcon = computed(() =>
    this.theme.current() === 'dark' ? 'light_mode' : 'dark_mode',
  );
  protected readonly themeLabel = computed(() =>
    this.theme.current() === 'dark' ? 'theme.switch_to_light' : 'theme.switch_to_dark',
  );
  protected readonly langCode = computed(() => this.lang.current().toUpperCase());

  protected cycleTheme(): void {
    this.theme.cycle();
  }

  protected setLang(l: 'en' | 'nl'): void {
    this.lang.use(l);
  }
}
