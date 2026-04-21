import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, TranslateModule],
  template: `
    <mat-toolbar class="app-bar">
      <a routerLink="/" class="app-bar__title">{{ 'app.title' | translate }}</a>
      <span class="spacer"></span>
      <button mat-button (click)="switchLanguage('nl')">
        {{ 'language.switch_to_dutch' | translate }}
      </button>
      <button mat-button (click)="switchLanguage('en')">
        {{ 'language.switch_to_english' | translate }}
      </button>
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
        font-size: 1.25rem;
        font-weight: 500;
        letter-spacing: 0.0125em;
        color: var(--mat-sys-on-surface);
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
