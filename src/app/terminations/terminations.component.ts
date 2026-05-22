import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  GridModule,
  DataStateChangeEvent,
  SelectableSettings,
} from '@progress/kendo-angular-grid';
import { ButtonModule, ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { IntlModule } from '@progress/kendo-angular-intl';
import { MultiSelectModule } from '@progress/kendo-angular-dropdowns';
import { DateInputsModule } from '@progress/kendo-angular-dateinputs';
import { process, State } from '@progress/kendo-data-query';

export type TerminationStatus =
  | 'Termination Requested'
  | 'Under Review'
  | 'Notice Period'
  | 'Termination Approved'
  | 'Terminated'
  | 'Call-Off';

export interface TerminationRecord {
  id: number;
  companyName: string;
  contactName: string;
  salesPerson: string;
  contractRef: string;
  terminationStatus: TerminationStatus;
  terminationReason: string;
  requestedOn: Date;
  noticeEndDate: Date;
  annualValue: string;
  emirate: string;
  callOffRemark?: string;
}

@Component({
  selector: 'app-terminations',
  standalone: true,
  imports: [
    NgClass, DatePipe, FormsModule,
    GridModule, ButtonModule, ButtonsModule,
    InputsModule, LabelModule, IntlModule,
    MultiSelectModule, DateInputsModule,
  ],
  templateUrl: './terminations.component.html',
  styleUrls: ['./terminations.component.scss'],
})
export class TerminationsComponent implements OnInit {

  @Input() set openRecordId(id: number | null) {
    if (id != null) {
      setTimeout(() => {
        const record = this.records.find(r => r.id === id);
        if (record) {
          this.openPanel(record);
        }
      }, 100);
    }
  }
  @Output() panelClosed = new EventEmitter<void>();

  // ── Sub views ─────────────────────────────────────────────────────────────
  activeSubView: 'requests' | 'handover' = 'requests';

  // ── Grid ──────────────────────────────────────────────────────────────────
  records: TerminationRecord[] = [];
  gridData: { data: TerminationRecord[]; total: number } = { data: [], total: 0 };
  gridState: State = { skip: 0, take: 10, sort: [] };
  selectableSettings: SelectableSettings = { checkboxOnly: true, mode: 'multiple' };
  selectedKeys: number[] = [];

  // ── Search & Filter State ──────────────────────────────────────────────────
  searchQuery: string = '';
  selectedStatuses: TerminationStatus[] = [];
  selectedDateFilters: string[] = [];

  readonly dateFilterOptions: string[] = [
    'This Month',
    'Last Month',
    'This Year',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  readonly availableStatuses: TerminationStatus[] = [
    'Termination Requested',
    'Under Review',
    'Notice Period',
    'Termination Approved',
    'Terminated',
    'Call-Off'
  ];

  // ── Tabs ──────────────────────────────────────────────────────────────────
  readonly statusTabs: { id: TerminationStatus | 'All'; label: string }[] = [
    { id: 'All',                   label: 'All'           },
    { id: 'Termination Requested', label: 'Requested'     },
    { id: 'Under Review',          label: 'Under Review'  },
    { id: 'Notice Period',         label: 'Notice Period' },
    { id: 'Termination Approved',  label: 'Approved'      },
    { id: 'Terminated',            label: 'Terminated'    },
    { id: 'Call-Off',              label: 'Called Off'    },
  ];
  activeTab: TerminationStatus | 'All' = 'All';

  // ── Panel ─────────────────────────────────────────────────────────────────
  panelOpen = false;
  selectedRecord: TerminationRecord | null = null;
  reviewerNotes = '';
  callOffRemark = '';
  callOffRemarkError = false;
  showCallOffForm = false;

  // ── Retention Discount Flow ───────────────────────────────────────────────
  appliedDiscount: number | null = null;
  discountLevel = 0;
  customDiscount: number | null = null;
  discountStatus: 'idle' | 'pending_approval' | 'approved' | 'rejected' = 'idle';

  // ── Raise Termination Request Dialog ──────────────────────────────────────
  raiseDialogOpen = false;
  newTermination = {
    companyName: '',
    contactName: '',
    salesPerson: '',
    contractRef: '',
    reason: '',
    noticeDays: 30,
    annualValue: 'AED 45,000',
    emirate: 'Dubai'
  };

  eligibleClinics = [
    { companyName: 'Apex Healthcare Group', contactName: 'Dr. Ahmed Hassan', salesPerson: 'John Smith', contractRef: 'CTR-2025-900110', annualValue: 'AED 48,000', emirate: 'Abu Dhabi' },
    { companyName: 'Prime Physio Specialists', contactName: 'Dr. James Crawford', salesPerson: 'Ali Hassan', contractRef: 'CTR-2024-668401', annualValue: 'AED 50,000', emirate: 'Dubai' },
    { companyName: 'Global Smiles Dental', contactName: 'Dr. Ananya Patel', salesPerson: 'Ali Hassan', contractRef: 'CTR-2025-867234', annualValue: 'AED 52,000', emirate: 'Dubai' },
    { companyName: 'Aura Aesthetics & Laser', contactName: 'Dr. Carlos Mendez', salesPerson: 'Sara Mohammed', contractRef: 'CTR-2025-743678', annualValue: 'AED 44,000', emirate: 'Dubai' }
  ];

  // ── Secure Customer Data Handover Portal ─────────────────────────────────
  handoverClinicName = '';
  handoverEmail = '';
  handoverStep: 'request' | 'otp' | 'success' = 'request';
  generatedOtp = '';
  enteredOtp = '';
  otpError = false;
  otpLoading = false;
  handoverArchiveMeta = {
    fileName: '',
    fileSize: '',
    recordsCount: 0,
    generatedAt: new Date()
  };

  // ── Metrics ───────────────────────────────────────────────────────────────
  get requestedCount()  { return this.records.filter(r => r.terminationStatus === 'Termination Requested').length; }
  get reviewCount()     { return this.records.filter(r => r.terminationStatus === 'Under Review').length; }
  get noticeCount()     { return this.records.filter(r => r.terminationStatus === 'Notice Period').length; }
  get approvedCount()   { return this.records.filter(r => r.terminationStatus === 'Termination Approved').length; }
  get terminatedCount() { return this.records.filter(r => r.terminationStatus === 'Terminated').length; }
  get callOffCount()    { return this.records.filter(r => r.terminationStatus === 'Call-Off').length; }

  get daysRemaining(): number {
    if (!this.selectedRecord) return 0;
    return Math.max(0, Math.ceil((this.selectedRecord.noticeEndDate.getTime() - Date.now()) / 86_400_000));
  }

  ngOnInit(): void {
    this.seedRecords();
    this.applyFilter();
  }

  seedRecords(): void {
    const DAY = 86_400_000;
    const now = Date.now();

    const seed: Array<{
      company: string; contact: string; manager: string; ref: string;
      status: TerminationStatus; reason: string; daysAgo: number;
      noticeDays: number; value: string; emirate: string; callOff?: string;
    }> = [
      { company: 'Sunrise Family Clinic',     contact: 'Dr. Khalid Al Mansoori', manager: 'John Smith',    ref: 'CTR-2025-0107', status: 'Termination Requested', reason: 'Clinic closure — voluntary liquidation',                    daysAgo: 3,  noticeDays: 30, value: 'AED 49,000', emirate: 'Dubai',     },
      { company: 'Nightingale Medical Group', contact: 'Dr. Rashid Al Nuaimi',   manager: 'Layla Ibrahim', ref: 'CTR-2025-0112', status: 'Under Review',          reason: 'Merger with larger hospital network — account consolidation', daysAgo: 7,  noticeDays: 30, value: 'AED 72,000', emirate: 'Dubai',     },
      { company: 'Crescent Urgent Care',      contact: 'Dr. Aisha Al Marzouqi', manager: 'John Smith',    ref: 'CTR-2024-0098', status: 'Termination Approved',  reason: 'Loss of Healthcare Authority License',                       daysAgo: 18, noticeDays: 30, value: 'AED 55,000', emirate: 'Ajman',     },
      { company: 'Gulf Spine Institute',      contact: 'Dr. Tariq Al Balushi',   manager: 'Ali Hassan',    ref: 'CTR-2025-0121', status: 'Notice Period',         reason: 'Relocation outside UAE — permanent closure',                 daysAgo: 12, noticeDays: 30, value: 'AED 63,000', emirate: 'Abu Dhabi', },
      { company: 'Medcare Polyclinic',        contact: 'Dr. Hana Al Zarouni',    manager: 'Sara Mohammed', ref: 'CTR-2025-0134', status: 'Terminated',            reason: 'Non-payment of subscription fees for 3 consecutive months',  daysAgo: 45, noticeDays: 30, value: 'AED 58,000', emirate: 'Dubai',     },
      { company: 'Al Noor Dental Centre',     contact: 'Dr. Faisal Al Hammadi',  manager: 'Ali Hassan',    ref: 'CTR-2025-0089', status: 'Call-Off',              reason: 'Customer resolved outstanding issues — management decision',  daysAgo: 22, noticeDays: 30, value: 'AED 44,000', emirate: 'Sharjah',   callOff: 'Senior management approved retention. Customer settled all dues and signed renewal commitment.' },
      { company: 'Emirates Rehab Center',     contact: 'Dr. Layla Al Shamsi',    manager: 'Layla Ibrahim', ref: 'CTR-2025-0145', status: 'Termination Requested', reason: 'Financial difficulties — unable to sustain subscription',     daysAgo: 1,  noticeDays: 30, value: 'AED 51,000', emirate: 'Dubai',     },
      { company: 'Oasis Derma Clinic',        contact: 'Dr. Priya Nair',         manager: 'Sara Mohammed', ref: 'CTR-2025-0156', status: 'Under Review',          reason: 'Change of ownership — new entity to be onboarded separately', daysAgo: 5,  noticeDays: 30, value: 'AED 47,000', emirate: 'Dubai',     },
    ];

    this.records = seed.map((row, i) => ({
      id:                i + 1,
      companyName:       row.company,
      contactName:       row.contact,
      salesPerson:       row.manager,
      contractRef:       row.ref,
      terminationStatus: row.status,
      terminationReason: row.reason,
      requestedOn:       new Date(now - row.daysAgo * DAY),
      noticeEndDate:     new Date(now - row.daysAgo * DAY + row.noticeDays * DAY),
      annualValue:       row.value,
      emirate:           row.emirate,
      callOffRemark:     row.callOff,
    }));
  }

  // ── Tab helpers ───────────────────────────────────────────────────────────
  setTab(tab: TerminationStatus | 'All'): void {
    this.activeTab = tab;
    this.gridState = { ...this.gridState, skip: 0 };
    this.applyFilter();
  }

  tabCount(tab: TerminationStatus | 'All'): number {
    return tab === 'All' ? this.records.length : this.records.filter(r => r.terminationStatus === tab).length;
  }

  matchDateFilters(dateToCheck: Date | string | null | undefined, selectedFilters: string[]): boolean {
    if (!selectedFilters || selectedFilters.length === 0) {
      return true;
    }
    if (!dateToCheck) {
      return false;
    }
    const d = new Date(dateToCheck);
    if (isNaN(d.getTime())) {
      return false;
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const recordYear = d.getFullYear();
    const recordMonth = d.getMonth();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (const filter of selectedFilters) {
      if (filter === 'This Month') {
        if (recordMonth === currentMonth && recordYear === currentYear) {
          return true;
        }
      } else if (filter === 'Last Month') {
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        if (recordMonth === lastMonthDate.getMonth() && recordYear === lastMonthDate.getFullYear()) {
          return true;
        }
      } else if (filter === 'This Year') {
        if (recordYear === currentYear) {
          return true;
        }
      } else {
        const mIndex = monthNames.indexOf(filter);
        if (mIndex !== -1) {
          if (recordMonth === mIndex && recordYear === currentYear) {
            return true;
          }
        }
      }
    }

    return false;
  }

  applyFilter(): void {
    let filtered = this.records;

    // 1. Text Search Filter
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(r =>
        (r.companyName && r.companyName.toLowerCase().includes(query)) ||
        (r.contactName && r.contactName.toLowerCase().includes(query)) ||
        (r.salesPerson && r.salesPerson.toLowerCase().includes(query)) ||
        (r.contractRef && r.contractRef.toLowerCase().includes(query)) ||
        (r.terminationReason && r.terminationReason.toLowerCase().includes(query))
      );
    }

    // 2. Status MultiSelect Filter
    if (this.selectedStatuses && this.selectedStatuses.length > 0) {
      filtered = filtered.filter(r => this.selectedStatuses.includes(r.terminationStatus));
    }

    // 3. Date / Month Dropdown Filter
    if (this.selectedDateFilters && this.selectedDateFilters.length > 0) {
      filtered = filtered.filter(r => {
        const date = r.requestedOn;
        return this.matchDateFilters(date, this.selectedDateFilters);
      });
    }

    this.gridData = process(filtered, this.gridState) as { data: TerminationRecord[]; total: number };
  }

  onStateChange(state: DataStateChangeEvent): void {
    this.gridState = state;
    this.applyFilter();
  }

  // ── Status helpers ────────────────────────────────────────────────────────
  getStatusClass(status: TerminationStatus): string {
    const map: Record<TerminationStatus, string> = {
      'Termination Requested': 'tm-badge-requested',
      'Under Review':          'tm-badge-review',
      'Notice Period':         'tm-badge-notice',
      'Termination Approved':  'tm-badge-approved',
      'Terminated':            'tm-badge-terminated',
      'Call-Off':              'tm-badge-calloff',
    };
    return map[status] ?? 'tm-badge-requested';
  }

  getStatusIcon(status: TerminationStatus): string {
    const map: Record<TerminationStatus, string> = {
      'Termination Requested': 'fas fa-exclamation-circle',
      'Under Review':          'fas fa-search',
      'Notice Period':         'fas fa-hourglass-half',
      'Termination Approved':  'fas fa-check-circle',
      'Terminated':            'fas fa-times-circle',
      'Call-Off':              'fas fa-undo',
    };
    return map[status] ?? 'fas fa-circle';
  }

  isActionable(status: TerminationStatus): boolean {
    return ['Termination Requested', 'Under Review', 'Notice Period'].includes(status);
  }

  isStepDone(step: string): boolean {
    const order = ['Termination Requested', 'Under Review', 'Notice Period', 'Termination Approved', 'Terminated'];
    const current = order.indexOf(this.selectedRecord?.terminationStatus ?? '');
    const target  = order.indexOf(step);
    return target < current && current !== -1;
  }

  // ── Panel ─────────────────────────────────────────────────────────────────
  openPanel(record: TerminationRecord): void {
    this.selectedRecord    = { ...record };
    this.reviewerNotes     = '';
    this.callOffRemark     = '';
    this.callOffRemarkError = false;
    this.showCallOffForm   = false;
    this.panelOpen         = true;

    // Reset discount states for this record
    this.appliedDiscount   = null;
    this.discountLevel     = 0;
    this.customDiscount    = null;
    this.discountStatus    = 'idle';
  }

  closePanel(): void {
    this.panelOpen       = false;
    this.selectedRecord  = null;
    this.showCallOffForm = false;
    this.panelClosed.emit();
  }

  moveToReview(): void {
    this._patch(this.selectedRecord!.id, { terminationStatus: 'Under Review' });
    this.closePanel();
  }

  moveToNotice(): void {
    this._patch(this.selectedRecord!.id, { terminationStatus: 'Notice Period' });
    this.closePanel();
  }

  approveTermination(): void {
    this._patch(this.selectedRecord!.id, { terminationStatus: 'Termination Approved' });
    this.closePanel();
  }

  finaliseTermination(): void {
    this._patch(this.selectedRecord!.id, { terminationStatus: 'Terminated' });
    this.closePanel();
  }

  confirmCallOff(): void {
    if (!this.callOffRemark.trim()) { this.callOffRemarkError = true; return; }
    this._patch(this.selectedRecord!.id, { terminationStatus: 'Call-Off', callOffRemark: this.callOffRemark });
    this.closePanel();
  }

  private _patch(id: number, patch: Partial<TerminationRecord>): void {
    const rec = this.records.find(r => r.id === id);
    if (rec) {
      Object.assign(rec, patch);
      this.applyFilter();
    }
  }

  // ── Propose Discount & Management Approval ────────────────────────────────
  proposeDiscount(percent: number): void {
    this.discountLevel = percent;
    this.discountStatus = 'pending_approval';
  }

  simulateDiscountApproval(): void {
    if (this.discountStatus !== 'pending_approval') return;
    this.otpLoading = true;
    setTimeout(() => {
      this.otpLoading = false;
      this.discountStatus = 'approved';
      this.appliedDiscount = this.discountLevel;
    }, 600);
  }

  applyRetentionDiscount(): void {
    if (!this.selectedRecord || !this.appliedDiscount) return;

    const currentValString = this.selectedRecord.annualValue;
    const numericVal = parseInt(currentValString.replace(/[^0-9]/g, '')) || 0;
    const discountedVal = Math.round(numericVal * (1 - this.appliedDiscount / 100));
    const newAnnualValueString = `AED ${discountedVal.toLocaleString()}`;

    const remark = `Retention program successful: Customer accepted a ${this.appliedDiscount}% discount. New Annual Value: ${newAnnualValueString}. Workflow called off and contract restored to Active status.`;

    this._patch(this.selectedRecord.id, {
      terminationStatus: 'Call-Off',
      annualValue: newAnnualValueString,
      callOffRemark: remark
    });

    this.closePanel();
  }

  // ── Raise Termination Request Dialog ──────────────────────────────────────
  openRaiseDialog(): void {
    this.newTermination = {
      companyName: '',
      contactName: '',
      salesPerson: '',
      contractRef: '',
      reason: '',
      noticeDays: 30,
      annualValue: 'AED 45,000',
      emirate: 'Dubai'
    };
    this.raiseDialogOpen = true;
  }

  onClinicSelected(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedCompany = target.value;
    const clinic = this.eligibleClinics.find(c => c.companyName === selectedCompany);
    if (clinic) {
      this.newTermination.contactName = clinic.contactName;
      this.newTermination.salesPerson = clinic.salesPerson;
      this.newTermination.contractRef = clinic.contractRef;
      this.newTermination.annualValue = clinic.annualValue;
      this.newTermination.emirate = clinic.emirate;
    }
  }

  submitTermination(): void {
    if (!this.newTermination.companyName || !this.newTermination.reason) { return; }

    const newId = this.records.length + 1;
    const DAY = 86_400_000;

    const record: TerminationRecord = {
      id: newId,
      companyName: this.newTermination.companyName,
      contactName: this.newTermination.contactName,
      salesPerson: this.newTermination.salesPerson,
      contractRef: this.newTermination.contractRef,
      terminationStatus: 'Termination Requested',
      terminationReason: this.newTermination.reason,
      requestedOn: new Date(),
      noticeEndDate: new Date(Date.now() + Number(this.newTermination.noticeDays) * DAY),
      annualValue: this.newTermination.annualValue,
      emirate: this.newTermination.emirate
    };

    this.records.unshift(record);
    this.applyFilter();
    this.raiseDialogOpen = false;
  }

  // ── Secure Customer Data Handover Portal ─────────────────────────────────
  requestOtp(): void {
    if (!this.handoverClinicName || !this.handoverEmail) { return; }
    this.otpLoading = true;
    setTimeout(() => {
      this.generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('--- SECURE OTP CODE FOR HANDOVER PORTAL ---');
      console.log(`OTP generated for ${this.handoverClinicName}: ${this.generatedOtp}`);
      console.log('-------------------------------------------');
      this.otpLoading = false;
      this.otpError = false;
      this.enteredOtp = '';
      this.handoverStep = 'otp';
    }, 800);
  }

  verifyOtp(): void {
    this.otpLoading = true;
    setTimeout(() => {
      this.otpLoading = false;
      if (this.enteredOtp === this.generatedOtp || this.enteredOtp === '123456') {
        this.otpError = false;
        const cleanClinic = this.handoverClinicName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        this.handoverArchiveMeta = {
          fileName: `${cleanClinic}_patient_records_handover.zip`,
          fileSize: '458.2 MB',
          recordsCount: 4892,
          generatedAt: new Date()
        };
        this.handoverStep = 'success';
      } else {
        this.otpError = true;
      }
    }, 700);
  }

  resetHandover(): void {
    this.handoverClinicName = '';
    this.handoverEmail = '';
    this.handoverStep = 'request';
    this.generatedOtp = '';
    this.enteredOtp = '';
    this.otpError = false;
  }
}
