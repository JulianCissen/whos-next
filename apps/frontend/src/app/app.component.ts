import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
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
}
