import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    TranslateModule,
  ],
  template: `
    <mat-toolbar class="app-bar">
      <a routerLink="/" class="app-bar__title">{{ 'app.title' | translate }}</a>
      <span class="spacer"></span>
      <button
        mat-icon-button
        [matMenuTriggerFor]="langMenu"
        [attr.aria-label]="'language.switch_to_dutch' | translate"
      >
        <mat-icon>language</mat-icon>
      </button>
      <mat-menu #langMenu>
        <button mat-menu-item (click)="switchLanguage('nl')">
          {{ 'language.switch_to_dutch' | translate }}
        </button>
        <button mat-menu-item (click)="switchLanguage('en')">
          {{ 'language.switch_to_english' | translate }}
        </button>
      </mat-menu>
    </mat-toolbar>

    <main class="app-content">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100%;
      }

      .app-bar {
        --mat-toolbar-container-background-color: var(--mat-sys-surface-container);
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        position: sticky;
        top: 0;
        z-index: 100;
        flex-shrink: 0;
      }

      .app-bar__title {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 1.125rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--mat-sys-primary);
        text-decoration: none;
      }

      .app-content {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
    `,
  ],
})
export class AppComponent implements OnInit {
  private readonly translate = inject(TranslateService);

  ngOnInit(): void {
    this.translate.setDefaultLang('en');
    this.translate.use('en');
  }

  switchLanguage(lang: string): void {
    this.translate.use(lang);
  }
}
