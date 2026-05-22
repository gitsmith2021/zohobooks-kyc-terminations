import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  @Input() activeNav = 'dashboard';
  @Input() sidebarCollapsed = false;
  @Input() navItems: NavItem[] = [];
  @Input() kycUnderReviewCount = 0;
  @Input() terminationCount = 0;

  @Output() navChange = new EventEmitter<string>();

  setNav(id: string): void {
    this.navChange.emit(id);
  }
}
