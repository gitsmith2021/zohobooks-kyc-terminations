import { Component } from '@angular/core';
import { ContractDashboardComponent } from './contract-dashboard/contract-dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ContractDashboardComponent],
  template: `<app-contract-dashboard />`,
})
export class AppComponent {}
