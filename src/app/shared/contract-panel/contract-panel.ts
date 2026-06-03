import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';

@Component({
  selector: 'app-contract-panel',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ButtonModule],
  templateUrl: './contract-panel.html',
  styleUrl: './contract-panel.scss',
})
export class ContractPanelComponent implements OnChanges {
  @Input() record: any;
  @Input() mode: 'preview' | 'amend' = 'preview';

  @Output() close = new EventEmitter<void>();
  @Output() sendReminder = new EventEmitter<void>();
  @Output() requestAmendment = new EventEmitter<void>();
  @Output() addAmendmentEvent = new EventEmitter<{desc: string}>();

  // Selected version index for history tracking
  selectedContractIdx = 0;

  // Amendment panel state
  amendPanelActiveIdx = 0;
  newAmendDesc = '';

  // Download & Print States
  isDownloading = false;
  isPrinting = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['record']) {
      // Default to the last version (latest) in history if present
      if (this.record?.contractHistory?.length) {
        this.selectedContractIdx = this.record.contractHistory.length - 1;
      } else {
        this.selectedContractIdx = 0;
      }
    }
  }

  // ── Version Getters ────────────────────────────────────────────────────────
  get activeVersion(): any {
    if (this.record?.contractHistory?.length) {
      return this.record.contractHistory[this.selectedContractIdx];
    }
    return null;
  }

  get contractRef(): string {
    return this.activeVersion?.ref || this.record?.contractRef || 'ZC-2025-000';
  }

  get contractStatus(): string {
    if (this.activeVersion) {
      return this.activeVersion.status === 'active' 
        ? 'Contract Signed' 
        : this.activeVersion.status === 'pending' 
          ? 'Contract Sent' 
          : 'Contract Expired';
    }
    return this.record?.contractStatus || '';
  }

  contractStartDate(): Date {
    return this.activeVersion?.startDate || this.record?.contractSentOn || new Date();
  }

  contractEndDate(): Date {
    return this.activeVersion?.endDate || (this.record?.contractSentOn ? new Date(new Date(this.record.contractSentOn).getTime() + 365 * 86_400_000) : new Date());
  }

  contractAnnualValue(): string {
    return this.activeVersion?.annualValue || this.record?.annualValue || `AED ${45 + (this.record?.id || 0) * 2},000`;
  }

  contractSignedOn(): Date | null {
    if (this.activeVersion) {
      return this.activeVersion.status === 'active' ? this.activeVersion.startDate : null;
    }
    return this.record?.contractSignedOn || null;
  }

  // ── Action Handlers ────────────────────────────────────────────────────────
  onDownloadPdf(): void {
    this.isDownloading = true;
    setTimeout(() => {
      this.isDownloading = false;
      const blob = new Blob([
        `UNITECARE SOFTWARE AGREEMENT\n==========================\nReference: ${this.contractRef}\nClient: ${this.record?.companyName}\nSignatory: ${this.record?.contactName || this.record?.customerName}\nAnnual Value: ${this.contractAnnualValue()}\n\nThis is a certified contract agreement, containing:\n- Page 1: Terms of Agreement\n- Page 2: Annexure A (SLA Commitments)\n- Page 3: Annexure B (UAE Healthcare Regulatory Compliance & Data Residency)`
      ], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.contractRef}_Agreement.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 1500);
  }

  onPrintContract(): void {
    this.isPrinting = true;
    setTimeout(() => {
      this.isPrinting = false;
      window.print();
    }, 1000);
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'Draft':               'cs-badge-draft',
      'Amendments Added':    'cs-badge-amend',
      'Ready':               'cs-badge-ready',
      'Contract Sent':       'cs-badge-sent',
      'Contract Signed':     'cs-badge-signed',
      'Contract Terminated': 'cs-badge-terminated',
      'Contract Expired':    'cs-badge-expired',
    };
    return map[status] || 'cs-badge-draft';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'Draft':               'fas fa-pencil-ruler',
      'Amendments Added':    'fas fa-file-signature',
      'Ready':               'fas fa-check-double',
      'Contract Sent':       'fas fa-paper-plane',
      'Contract Signed':     'fas fa-file-contract',
      'Contract Terminated': 'fas fa-times-circle',
      'Contract Expired':    'fas fa-calendar-times',
    };
    return map[status] || 'fas fa-circle';
  }

  canAddAmendment(): boolean {
    return ['Contract Signed', 'Amendments Added'].includes(this.contractStatus);
  }

  onClose(): void {
    this.close.emit();
  }

  onSendReminder(): void {
    this.sendReminder.emit();
  }

  onRequestAmendment(): void {
    this.requestAmendment.emit();
  }

  onAddAmendment(): void {
    if (this.newAmendDesc.trim()) {
      this.addAmendmentEvent.emit({ desc: this.newAmendDesc });
      this.newAmendDesc = '';
    }
  }
}
