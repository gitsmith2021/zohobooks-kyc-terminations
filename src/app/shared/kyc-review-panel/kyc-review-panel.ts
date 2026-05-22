import { Component, EventEmitter, Input, Output, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';

@Component({
  selector: 'app-kyc-review-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule],
  templateUrl: './kyc-review-panel.html',
  styleUrl: './kyc-review-panel.scss',
})
export class KycReviewPanelComponent implements OnInit, OnChanges {
  @Input() record: any; // accepts KycRecord or CustomerRecord
  @Input() documents: any[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() approve = new EventEmitter<{notes: string}>();
  @Output() reject = new EventEmitter<{notes: string, reason: string}>();
  @Output() requestCorrection = new EventEmitter<{notes: string, fieldErrors?: any}>();
  @Output() resendKyc = new EventEmitter<void>(); // specific to dashboard expired KYC

  reviewerNotes = '';
  rejectionReason = '';
  showRejectForm = false;
  previewDoc: any = null;

  fieldCorrections: Record<string, { invalid: boolean; comment: string }> = {};

  ngOnInit(): void {
    this.initCorrections();
  }

  ngOnChanges(): void {
    this.initCorrections();
  }

  initCorrections(): void {
    this.fieldCorrections = {};
    if (this.record?.fieldErrors) {
      for (const [key, val] of Object.entries(this.record.fieldErrors)) {
        this.fieldCorrections[key] = {
          invalid: true,
          comment: val as string
        };
      }
    }
  }

  toggleCorrection(field: string): void {
    if (!this.fieldCorrections[field]) {
      this.fieldCorrections[field] = { invalid: false, comment: '' };
    }
    this.fieldCorrections[field].invalid = !this.fieldCorrections[field].invalid;
    if (!this.fieldCorrections[field].invalid) {
      this.fieldCorrections[field].comment = '';
    }
  }

  getContactName(): string {
    return this.record?.contactName || this.record?.customerName || '';
  }

  getClinicEmail(): string {
    return this.record?.clinicEmail || this.record?.email || '';
  }

  getClinicPhone(): string {
    return this.record?.clinicPhone || this.record?.mobile || '';
  }

  getSignatoryMobile(): string {
    return this.record?.signatoryMobile || this.record?.mobile || '';
  }

  getDocuments(): any[] {
    return this.documents?.length ? this.documents : (this.record?.documents || []);
  }

  isReviewable(): boolean {
    const s = this.record?.status;
    return ['KYC Submitted', 'Under Review', 'Re-submission'].includes(s);
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'KYC Pending':   'badge-neutral',
      'KYC Form Sent': 'badge-info',
      'KYC Submitted': 'badge-primary',
      'Under Review':  'badge-warning',
      'KYC Approved':  'badge-success',
      'KYC Rejected':  'badge-danger',
      'Re-submission': 'badge-resubmit',
      'KYC Expired':   'badge-expired',
    };
    return map[status] || 'badge-secondary';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'KYC Pending':   'fas fa-clock',
      'KYC Form Sent': 'fas fa-paper-plane',
      'KYC Submitted': 'fas fa-inbox',
      'Under Review':  'fas fa-search',
      'KYC Approved':  'fas fa-check-circle',
      'KYC Rejected':  'fas fa-times-circle',
      'Re-submission': 'fas fa-redo',
      'KYC Expired':   'fas fa-exclamation-triangle',
    };
    return map[status] || 'fas fa-circle';
  }

  onClose(): void {
    this.close.emit();
  }

  onApprove(): void {
    this.approve.emit({ notes: this.reviewerNotes });
  }

  onRequestCorrection(): void {
    this.requestCorrection.emit({ notes: this.reviewerNotes, fieldErrors: this.fieldCorrections });
  }

  onReject(): void {
    if (!this.rejectionReason.trim()) { return; }
    this.reject.emit({ notes: this.reviewerNotes, reason: this.rejectionReason });
  }

  onResendKyc(): void {
    this.resendKyc.emit();
  }

  previewDocument(doc: any): void {
    this.previewDoc = doc;
  }

  closePreview(): void {
    this.previewDoc = null;
  }
}
