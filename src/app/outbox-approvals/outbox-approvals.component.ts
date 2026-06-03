import { Component, OnInit } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  GridModule,
  DataStateChangeEvent,
  SelectableSettings,
} from '@progress/kendo-angular-grid';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { ButtonModule, ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { IntlModule } from '@progress/kendo-angular-intl';
import { process, State } from '@progress/kendo-data-query';
import { OutboxService, OutboxItem } from '../shared/outbox.service';
import { FilterPersistenceService } from '../shared/filter-persistence.service';
import { KeyboardShortcutService } from '../shared/keyboard-shortcut.service';

@Component({
  selector: 'app-outbox-approvals',
  standalone: true,
  imports: [
    NgClass,
    DatePipe,
    FormsModule,
    GridModule,
    DialogModule,
    ButtonModule,
    ButtonsModule,
    InputsModule,
    LabelModule,
    IntlModule,
  ],
  templateUrl: './outbox-approvals.component.html',
  styleUrls: ['./outbox-approvals.component.scss'],
})
export class OutboxApprovalsComponent implements OnInit {
  // ── Grid State ─────────────────────────────────────────────────────────────
  allItems: OutboxItem[] = [];
  filteredItems: OutboxItem[] = [];
  gridData: { data: OutboxItem[]; total: number } = { data: [], total: 0 };
  gridState: State = { sort: [] };
  selectableSettings: SelectableSettings = { checkboxOnly: true, mode: 'multiple' };
  selectedKeys: number[] = [];

  // ── Search & Filters ───────────────────────────────────────────────────────
  searchQuery: string = '';
  activeCategoryFilter: 'All' | 'KYC' | 'Contract' | 'Termination' = 'All';
  activeStatusFilter: 'All' | 'Pending Review' | 'Sent' | 'Rejected' = 'All';

  // ── Grid Density ──────────────────────────────────────────────────────────
  gridDensity: 'comfortable' | 'compact' = 'comfortable';

  toggleDensity(): void {
    this.gridDensity = this.gridDensity === 'compact' ? 'comfortable' : 'compact';
    this.fp.save('outbox', {
      searchQuery: this.searchQuery, activeCategoryFilter: this.activeCategoryFilter,
      activeStatusFilter: this.activeStatusFilter, gridDensity: this.gridDensity
    });
  }

  // ── Category Tabs ──────────────────────────────────────────────────────────
  readonly categoryTabs: { id: 'All' | 'KYC' | 'Contract' | 'Termination'; label: string; icon: string }[] = [
    { id: 'All',         label: 'All Transactions', icon: 'fas fa-envelope-open-text' },
    { id: 'KYC',         label: 'KYC Submissions',   icon: 'fas fa-id-card' },
    { id: 'Contract',    label: 'Contracts',         icon: 'fas fa-file-contract' },
    { id: 'Termination', label: 'Terminations',      icon: 'fas fa-times-circle' },
  ];

  // ── Review Panel State ──────────────────────────────────────────────────────
  reviewPanelOpen = false;
  selectedItem: OutboxItem | null = null;
  reviewerNotes = '';
  panelIndex = 0;

  // ── Reject Dialog State ────────────────────────────────────────────────────
  rejectDialogOpen = false;
  rejectionRemarks = '';
  itemToReject: OutboxItem | null = null;

  constructor(
    private outboxService: OutboxService,
    private fp: FilterPersistenceService,
    private ks: KeyboardShortcutService
  ) {}

  ngOnInit(): void {
    this.restoreFilters();
    this.outboxService.items$.subscribe(items => {
      this.allItems = items;
      this.applyFilter();
    });
  }

  private restoreFilters(): void {
    const s = this.fp.load<Record<string, unknown>>('outbox');
    if (!s) return;
    this.searchQuery         = (s['searchQuery']         as string) ?? this.searchQuery;
    this.activeCategoryFilter= (s['activeCategoryFilter']as any)   ?? this.activeCategoryFilter;
    this.activeStatusFilter  = (s['activeStatusFilter']  as any)   ?? this.activeStatusFilter;
    this.gridDensity         = (s['gridDensity']         as any)   ?? this.gridDensity;
  }

  // ── KPI Metrics ────────────────────────────────────────────────────────────
  get totalPendingCount(): number {
    return this.allItems.filter(i => i.status === 'Pending Review').length;
  }

  get kycPendingCount(): number {
    return this.allItems.filter(i => i.category === 'KYC' && i.status === 'Pending Review').length;
  }

  get contractPendingCount(): number {
    return this.allItems.filter(i => i.category === 'Contract' && i.status === 'Pending Review').length;
  }

  get terminationPendingCount(): number {
    return this.allItems.filter(i => i.category === 'Termination' && i.status === 'Pending Review').length;
  }

  // ── Filters & Search ───────────────────────────────────────────────────────
  setCategoryFilter(filter: 'All' | 'KYC' | 'Contract' | 'Termination'): void {
    this.activeCategoryFilter = filter;
    this.applyFilter();
  }

  applyFilter(): void {
    let temp = this.allItems;

    // 1. Text Search
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      temp = temp.filter(i =>
        (i.companyName && i.companyName.toLowerCase().includes(q)) ||
        (i.contactName && i.contactName.toLowerCase().includes(q)) ||
        (i.email && i.email.toLowerCase().includes(q)) ||
        (i.reference && i.reference.toLowerCase().includes(q))
      );
    }

    // 2. Category Tab Filter
    if (this.activeCategoryFilter !== 'All') {
      temp = temp.filter(i => i.category === this.activeCategoryFilter);
    }

    // 3. Status Dropdown Filter
    if (this.activeStatusFilter !== 'All') {
      temp = temp.filter(i => i.status === this.activeStatusFilter);
    }

    this.filteredItems = temp;
    this.gridData = process(this.filteredItems, this.gridState) as { data: OutboxItem[]; total: number };
    this.fp.save('outbox', {
      searchQuery: this.searchQuery, activeCategoryFilter: this.activeCategoryFilter,
      activeStatusFilter: this.activeStatusFilter, gridDensity: this.gridDensity
    });
  }

  onStateChange(state: DataStateChangeEvent): void {
    this.gridState = state;
    this.applyFilter();
  }

  // ── Single Operations ──────────────────────────────────────────────────────
  openReviewPanel(item: OutboxItem): void {
    this.selectedItem = { ...item };
    this.reviewerNotes = '';
    this.reviewPanelOpen = true;
    this.panelIndex = this.filteredItems.findIndex(i => i.id === item.id);
    if (this.panelIndex < 0) this.panelIndex = 0;
    this.ks.register('outbox-panel', {
      'Escape':     () => this.closeReviewPanel(),
      'ArrowLeft':  () => this.navigatePanel(-1),
      'ArrowRight': () => this.navigatePanel(1),
    });
  }

  navigatePanel(dir: -1 | 1): void {
    const next = this.panelIndex + dir;
    if (next < 0 || next >= this.filteredItems.length) return;
    this.panelIndex = next;
    this.openReviewPanel(this.filteredItems[next]);
  }

  closeReviewPanel(): void {
    this.reviewPanelOpen = false;
    this.selectedItem = null;
    this.ks.deregister('outbox-panel');
  }

  approveSingle(item: OutboxItem): void {
    this.outboxService.approveItem(item.id);
    this.closeReviewPanel();
  }

  rejectSingle(item: OutboxItem): void {
    this.itemToReject = item;
    this.rejectionRemarks = '';
    this.rejectDialogOpen = true;
    this.ks.register('outbox-dialog', {
      'Escape': () => this.cancelRejectDialog(),
      'Enter':  () => { if (this.rejectionRemarks.trim()) this.confirmReject(); },
    });
  }

  confirmReject(): void {
    if (!this.itemToReject) return;
    this.outboxService.rejectItem(this.itemToReject.id, this.rejectionRemarks.trim());
    this.rejectDialogOpen = false;
    this.itemToReject = null;
    this.ks.deregister('outbox-dialog');
    this.closeReviewPanel();
  }

  cancelRejectDialog(): void {
    this.rejectDialogOpen = false;
    this.itemToReject = null;
    this.rejectionRemarks = '';
    this.ks.deregister('outbox-dialog');
  }

  // ── Bulk Operations ────────────────────────────────────────────────────────
  bulkApproveSelected(): void {
    if (this.selectedKeys.length === 0) return;
    this.outboxService.bulkApprove(this.selectedKeys);
    this.selectedKeys = [];
  }

  bulkRejectSelected(): void {
    if (this.selectedKeys.length === 0) return;
    this.outboxService.bulkReject(this.selectedKeys);
    this.selectedKeys = [];
  }

  get selectedPendingCount(): number {
    return this.allItems.filter(i => this.selectedKeys.includes(i.id) && i.status === 'Pending Review').length;
  }

  // ── Stylings and Layout classes ────────────────────────────────────────────
  getCategoryIcon(cat: 'KYC' | 'Contract' | 'Termination'): string {
    const map = {
      KYC: 'fas fa-id-card',
      Contract: 'fas fa-file-contract',
      Termination: 'fas fa-times-circle',
    };
    return map[cat] || 'fas fa-envelope';
  }

  getCategoryClass(cat: 'KYC' | 'Contract' | 'Termination'): string {
    const map = {
      KYC: 'ob-badge-kyc',
      Contract: 'ob-badge-contract',
      Termination: 'ob-badge-term',
    };
    return map[cat] || '';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'Pending Review': 'ob-status-pending',
      Sent: 'ob-status-sent',
      Rejected: 'ob-status-rejected',
    };
    return map[status] || '';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'Pending Review': 'fas fa-hourglass-half',
      Sent: 'fas fa-check-circle',
      Rejected: 'fas fa-times-circle',
    };
    return map[status] || 'fas fa-circle';
  }

  getActionIcon(action: 'Send' | 'Resend' | 'Send Again'): string {
    const map = {
      Send: 'fas fa-paper-plane',
      Resend: 'fas fa-redo-alt',
      'Send Again': 'fas fa-reply-all',
    };
    return map[action] || 'fas fa-paper-plane';
  }

  getChannelIcon(channel: 'Email' | 'WhatsApp'): string {
    return channel === 'WhatsApp' ? 'fab fa-whatsapp' : 'far fa-envelope';
  }

  getChannelClass(channel: 'Email' | 'WhatsApp'): string {
    return channel === 'WhatsApp' ? 'ob-ch-whatsapp' : 'ob-ch-email';
  }

  buildMessagePreview(item: OutboxItem): { subject?: string; body: string; salutation: string; closing?: string } {
    const name = item.contactName.split(' ').slice(-1)[0]; // last name e.g. "Al Rashid"
    const salutation = `Dear ${item.contactName},`;

    if (item.channel === 'WhatsApp') {
      // Short WhatsApp message style
      if (item.category === 'KYC') {
        return {
          salutation,
          body: `Hi ${name}, this is a reminder from Unitecare Software Solutions regarding your KYC verification (Ref: ${item.reference}).\n\nYour documents are due for renewal. Please use the secure link below to upload your updated trade license and civil ID copies:\n\n🔗 https://kyc.unite.care/${item.reference}\n\nFor assistance, reply to this message or call +971 4 XXX XXXX.`,
        };
      }
      if (item.category === 'Contract') {
        return {
          salutation,
          body: `Hi ${name}, your UNITE EMR service agreement (Ref: ${item.reference}) is ready for review.\n\nPlease review and sign the attached Master Service Agreement at your earliest convenience:\n\n🔗 https://contracts.unite.care/${item.reference}\n\nQuestions? Reply here or call +971 4 XXX XXXX.`,
        };
      }
      return {
        salutation,
        body: `Hi ${name}, we are writing regarding your UNITE EMR termination notice (Ref: ${item.reference}).\n\nPlease complete the handover checklist and ensure all accounts are settled before the termination date.\n\n🔗 https://accounts.unite.care/${item.reference}\n\nThank you for your cooperation.`,
      };
    }

    // Email style
    const closing = `Kind Regards,\nContracts & Compliance Team\nUnitecare Software Solutions FZE\nDubai Silicon Oasis, Dubai, UAE`;

    if (item.category === 'KYC') {
      return {
        subject: `Action Required: KYC Document Renewal — ${item.reference}`,
        salutation,
        body: `We hope this message finds you well.\n\nOur records indicate that your KYC compliance documentation associated with reference <strong>${item.reference}</strong> requires renewal. To maintain uninterrupted access to the UNITE EMR platform, please upload your updated documents at your earliest convenience.\n\nThe following documents are required:\n• Valid Trade License\n• Civil ID / Passport copies of authorised signatory\n• Emirates ID (if applicable)\n\nYou may submit your documents securely through our portal using the link below:\n\n🔗 <a href="#">KYC Upload Portal — ${item.reference}</a>\n\nShould you require any assistance or have questions, please do not hesitate to contact our compliance team.`,
        closing,
      };
    }
    if (item.category === 'Contract') {
      return {
        subject: `Master Service Agreement — ${item.reference} | Action Required`,
        salutation,
        body: `We are pleased to share the Master Service Agreement (MSA) between <strong>${item.companyName}</strong> and Unitecare Software Solutions FZE for the UNITE EMR Application.\n\nThis agreement outlines the terms of service, subscription details, support obligations, and compliance requirements for your facility.\n\nPlease review the attached document and return a signed copy at your earliest convenience. Should you wish to request any amendments or clarifications, please reach out to our contracts team directly.\n\n📄 <a href="#">View / Download Agreement — ${item.reference}</a>\n\nWe look forward to a long and productive partnership.`,
        closing,
      };
    }
    return {
      subject: `Termination Notice & Handover Package — ${item.reference}`,
      salutation,
      body: `This communication serves as the formal termination notice for your UNITE EMR subscription associated with reference <strong>${item.reference}</strong>.\n\nAs part of the offboarding process, please ensure the following steps are completed before the termination date:\n\n1. Complete the handover checklist (attached)\n2. Settle any outstanding invoices\n3. Confirm data export requirements with our support team\n4. Return any provisioned hardware or access credentials\n\nOur team will remain available to assist you through the transition period. For any queries, please contact our accounts team at accounts@unite.care.`,
      closing,
    };
  }
}
