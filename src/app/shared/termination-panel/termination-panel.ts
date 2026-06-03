import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';

@Component({
  selector: 'app-termination-panel',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ButtonModule],
  templateUrl: './termination-panel.html',
  styleUrl: './termination-panel.scss',
})
export class TerminationPanel {
  /** Full CustomerRecord passed in from the dashboard */
  @Input() record: any;

  /** Close / dismiss the panel */
  @Output() close = new EventEmitter<void>();

  /** User clicked Approve Termination */
  @Output() approve = new EventEmitter<void>();

  /** User confirmed Call-Off — emits the mandatory remark text */
  @Output() callOff = new EventEmitter<{ remark: string }>();

  // ── Call-Off inline form state ──────────────────────────────────────────────
  showCallOffForm   = false;
  callOffRemark     = '';
  callOffRemarkError = false;

  // ── Negotiation Remarks ───────────────────────────────────────────────────
  negotiationHistoryOpen = false;
  negotiationRemarks = '';

  // ── Computed notice-period helpers ─────────────────────────────────────────
  get noticeEndDate(): Date | null {
    if (!this.record?.terminationDate) { return null; }
    const d = new Date(this.record.terminationDate);
    d.setDate(d.getDate() + 30);
    return d;
  }

  get daysUntilNoticeEnd(): number {
    if (!this.noticeEndDate) { return 0; }
    return Math.max(0, Math.ceil((this.noticeEndDate.getTime() - Date.now()) / 86_400_000));
  }

  get contractRef(): string {
    if (!this.record?.contractHistory?.length) { return 'ZC-2025-000'; }
    return this.record.contractHistory[this.record.contractHistory.length - 1].ref;
  }

  get annualValue(): string {
    if (!this.record?.contractHistory?.length) { return 'AED 45,000'; }
    return this.record.contractHistory[this.record.contractHistory.length - 1].annualValue;
  }

  get pendingClearanceValue(): string | null {
    const s = this.record?.status;
    if (s !== 'Termination Approved' && s !== 'Terminated') return null;
    return this.record?.pendingClearanceValue ?? null;
  }

  // ── Stepper Helpers ────────────────────────────────────────────────────────
  isStepDone(step: string): boolean {
    const order = ['Termination Requested', 'Under Review', 'Notice Period', 'Terminated'];
    const currentStatus = this.record?.status;
    let currentIdx = 0;
    if (currentStatus === 'Termination Approved') {
      currentIdx = 2; // Notice Period
    } else if (currentStatus === 'Terminated') {
      currentIdx = 3;
    }
    const targetIdx = order.indexOf(step);
    return targetIdx < currentIdx && currentIdx !== -1;
  }

  isStepActive(step: string): boolean {
    const currentStatus = this.record?.status;
    if (currentStatus === 'Termination Requested') {
      return step === 'Termination Requested';
    }
    if (currentStatus === 'Termination Approved') {
      return step === 'Notice Period';
    }
    if (currentStatus === 'Terminated') {
      return step === 'Terminated';
    }
    return false;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'Termination Requested': 'tm-badge-requested',
      'Termination Approved':  'tm-badge-notice',
      'Terminated':            'tm-badge-terminated',
      'Call-Off':              'tm-badge-calloff',
    };
    return map[status] ?? 'badge-secondary';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'Termination Requested': 'fas fa-exclamation-circle',
      'Termination Approved':  'fas fa-hourglass-half',
      'Terminated':            'fas fa-times-circle',
      'Call-Off':              'fas fa-undo',
    };
    return map[status] ?? 'fas fa-circle';
  }

  // ── Event Handlers ──────────────────────────────────────────────────────────
  onClose(): void {
    this.showCallOffForm      = false;
    this.callOffRemark        = '';
    this.callOffRemarkError   = false;
    this.negotiationHistoryOpen = false;
    this.negotiationRemarks   = '';
    this.close.emit();
  }

  onApprove(): void {
    this.approve.emit();
  }

  onConfirmCallOff(): void {
    if (!this.callOffRemark.trim()) {
      this.callOffRemarkError = true;
      return;
    }
    this.callOff.emit({ remark: this.callOffRemark });
  }
}
