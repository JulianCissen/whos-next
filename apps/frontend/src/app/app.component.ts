import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, MatToolbarModule, MatButtonModule, TranslateModule],
  template: `
    <mat-toolbar color="primary">
      <span>{{ 'app.title' | translate }}</span>
      <span class="spacer"></span>
      <button mat-button (click)="switchLanguage('nl')">
        {{ 'language.switch_to_dutch' | translate }}
      </button>
      <button mat-button (click)="switchLanguage('en')">
        {{ 'language.switch_to_english' | translate }}
      </button>
    </mat-toolbar>

    <main class="content">
      <h1>{{ 'app.tagline' | translate }}</h1>
    </main>

    <router-outlet />
  `,
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
