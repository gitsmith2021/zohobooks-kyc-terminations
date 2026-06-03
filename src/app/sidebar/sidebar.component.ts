import {
  Component, Input, Output, EventEmitter,
  ViewChild, TemplateRef, OnDestroy,
} from '@angular/core';
import { PopupModule, PopupService, PopupRef } from '@progress/kendo-angular-popup';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [PopupModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnDestroy {
  @Input() activeNav = 'dashboard';
  @Input() sidebarCollapsed = false;
  @Input() navItems: NavItem[] = [];
  @Input() kycUnderReviewCount = 0;
  @Input() terminationCount = 0;
  @Input() outboxPendingCount = 0;

  @Output() navChange = new EventEmitter<string>();

  @ViewChild('navTooltip') navTooltipTemplate!: TemplateRef<unknown>;

  tooltipLabel = '';
  private popupRef: PopupRef | null = null;

  constructor(private popupService: PopupService) {}

  ngOnDestroy(): void {
    this.closeTooltip();
  }

  setNav(id: string): void {
    this.navChange.emit(id);
  }

  openTooltip(anchor: EventTarget | null, label: string): void {
    if (!this.sidebarCollapsed || !anchor) return;
    this.closeTooltip();
    this.tooltipLabel = label;
    this.popupRef = this.popupService.open({
      anchor: anchor as HTMLElement,
      content: this.navTooltipTemplate,
      anchorAlign: { horizontal: 'right', vertical: 'center' },
      popupAlign: { horizontal: 'left',  vertical: 'center' },
      margin: { horizontal: 8, vertical: 0 },
    });
  }

  closeTooltip(): void {
    if (this.popupRef) {
      this.popupRef.close();
      this.popupRef = null;
    }
  }
}
