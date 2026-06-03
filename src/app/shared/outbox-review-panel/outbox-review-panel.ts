import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { OutboxService, OutboxItem } from '../outbox.service';

@Component({
  selector: 'app-outbox-review-panel',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ButtonModule, DialogModule],
  templateUrl: './outbox-review-panel.html',
  styleUrl: './outbox-review-panel.scss',
})
export class OutboxReviewPanelComponent implements OnInit {
  @Input() category!: 'KYC' | 'Contract' | 'Termination';
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  items: OutboxItem[] = [];
  selectedIds = new Set<number>();

  rejectDialogOpen = false;
  rejectionRemarks = '';
  itemToReject: OutboxItem | null = null;

  constructor(private outboxService: OutboxService) {}

  ngOnInit(): void {
    this.outboxService.items$.subscribe(all => {
      this.items = all.filter(i => i.category === this.category);
    });
  }

  get pendingCount(): number {
    return this.items.filter(i => i.status === 'Pending Review').length;
  }

  get selectedPendingCount(): number {
    return this.items.filter(i => this.selectedIds.has(i.id) && i.status === 'Pending Review').length;
  }

  get allPendingSelected(): boolean {
    const pending = this.items.filter(i => i.status === 'Pending Review');
    return pending.length > 0 && pending.every(i => this.selectedIds.has(i.id));
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      this.items.filter(i => i.status === 'Pending Review').forEach(i => this.selectedIds.add(i.id));
    } else {
      this.selectedIds.clear();
    }
  }

  toggleRow(id: number, checked: boolean): void {
    checked ? this.selectedIds.add(id) : this.selectedIds.delete(id);
  }

  approveSingle(item: OutboxItem): void {
    this.outboxService.approveItem(item.id);
  }

  rejectSingle(item: OutboxItem): void {
    this.itemToReject = item;
    this.rejectionRemarks = '';
    this.rejectDialogOpen = true;
  }

  confirmReject(): void {
    if (!this.itemToReject) return;
    this.outboxService.rejectItem(this.itemToReject.id, this.rejectionRemarks.trim());
    this.rejectDialogOpen = false;
    this.itemToReject = null;
    this.rejectionRemarks = '';
  }

  cancelRejectDialog(): void {
    this.rejectDialogOpen = false;
    this.itemToReject = null;
    this.rejectionRemarks = '';
  }

  bulkApprove(): void {
    const ids = [...this.selectedIds].filter(id =>
      this.items.find(i => i.id === id && i.status === 'Pending Review')
    );
    ids.forEach(id => this.outboxService.approveItem(id));
    this.selectedIds.clear();
  }

  close(): void {
    this.selectedIds.clear();
    this.closed.emit();
  }

  getChannelIcon(ch: string): string {
    return ch === 'WhatsApp' ? 'fab fa-whatsapp' : 'far fa-envelope';
  }

  getChannelClass(ch: string): string {
    return ch === 'WhatsApp' ? 'orp-ch-wa' : 'orp-ch-email';
  }

  getStatusClass(s: string): string {
    const m: Record<string, string> = {
      'Pending Review': 'orp-status-pending',
      'Sent':           'orp-status-sent',
      'Rejected':       'orp-status-rejected',
    };
    return m[s] || '';
  }

  getStatusIcon(s: string): string {
    const m: Record<string, string> = {
      'Pending Review': 'fas fa-hourglass-half',
      'Sent':           'fas fa-check-circle',
      'Rejected':       'fas fa-times-circle',
    };
    return m[s] || 'fas fa-circle';
  }

  get dynamicColLabel(): string {
    if (this.category === 'KYC')         return 'Renewal Due';
    if (this.category === 'Contract')    return 'Renewal Due';
    return 'Remarks';
  }

  get categoryIcon(): string {
    if (this.category === 'KYC')         return 'fas fa-id-card';
    if (this.category === 'Contract')    return 'fas fa-file-contract';
    return 'fas fa-times-circle';
  }
}
