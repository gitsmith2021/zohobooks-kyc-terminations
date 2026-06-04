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
import { DateInputsModule } from '@progress/kendo-angular-dateinputs';
import { process, State } from '@progress/kendo-data-query';
import { OutboxService } from '../shared/outbox.service';
import { OutboxReviewPanelComponent } from '../shared/outbox-review-panel/outbox-review-panel';
import { FilterPersistenceService } from '../shared/filter-persistence.service';
import { KeyboardShortcutService } from '../shared/keyboard-shortcut.service';

export interface NegotiationEntry {
  date: Date;
  role: 'reviewer' | 'customer' | 'management' | 'system';
  by: string;
  message: string;
  commMode?: string;
  poc?: string;
}

export interface TermHistory {
  date: Date;
  event: 'raised' | 'review' | 'notice' | 'called_off' | 'terminated';
  label: string;
  note?: string;
  by?: string;
}

export type TerminationStatus =
  | 'Termination Requested'
  | 'Under Review'
  | 'Sent for Negotiation'
  | 'Negotiation Approved'
  | 'Notice Period'
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
  pendingClearanceValue?: string;
  emirate: string;
  callOffRemark?: string;
  handoverStatus?: 'handover_email_sent' | 'accounts_clearance_pending' | 'accounts_clearance_complete' | 'termination_completed' | 'files_downloaded';
  ceoApprovalStatus?: 'pending' | 'approved';
  negotiationRemarks?: string;
  negotiationHistory?: NegotiationEntry[];
  history?: TermHistory[];
}

@Component({
  selector: 'app-terminations',
  standalone: true,
  imports: [
    NgClass, DatePipe, FormsModule,
    GridModule, ButtonModule, ButtonsModule,
    InputsModule, LabelModule, IntlModule,
    DateInputsModule,
    OutboxReviewPanelComponent,
  ],
  templateUrl: './terminations.component.html',
  styleUrls: ['./terminations.component.scss'],
})
export class TerminationsComponent implements OnInit {
  constructor(
    private outboxService: OutboxService,
    private fp: FilterPersistenceService,
    private ks: KeyboardShortcutService
  ) {}

  @Input() set initialFilter(status: string | null) {
    if (status) this.selectedStatuses = [status as TerminationStatus];
  }

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

  // ── Grid ──────────────────────────────────────────────────────────────────
  records: TerminationRecord[] = [];
  gridData: { data: TerminationRecord[]; total: number } = { data: [], total: 0 };
  gridState: State = { sort: [] };
  selectableSettings: SelectableSettings = { checkboxOnly: true, mode: 'multiple' };
  selectedKeys: number[] = [];
  outboxReviewOpen = false;

  // ── Search & Filter State ──────────────────────────────────────────────────
  searchQuery: string = '';
  selectedStatuses: TerminationStatus[] = [];
  selectedDateFilters: string[] = [];
  dateRangeFilter: { start: Date | null; end: Date | null } = { start: null, end: null };

  readonly availableStatuses: TerminationStatus[] = [
    'Termination Requested',
    'Under Review',
    'Sent for Negotiation',
    'Negotiation Approved',
    'Notice Period',
    'Terminated',
    'Call-Off'
  ];

  // ── Tabs ──────────────────────────────────────────────────────────────────
  readonly statusTabs: { id: TerminationStatus | 'All'; label: string }[] = [
    { id: 'All',                   label: 'All'           },
    { id: 'Termination Requested', label: 'Requested'     },
    { id: 'Under Review',          label: 'Under Review'  },
    { id: 'Notice Period',         label: 'Notice Period' },
    { id: 'Terminated',            label: 'Terminated'    },
    { id: 'Call-Off',              label: 'Called Off'    },
  ];
  activeTab: TerminationStatus | 'All' | 'Under Negotiation' = 'All';
  selectedHandoverSubFilter: string | null = null;

  // ── Grid Density ──────────────────────────────────────────────────────────
  gridDensity: 'comfortable' | 'compact' = 'comfortable';

  toggleDensity(): void {
    this.gridDensity = this.gridDensity === 'compact' ? 'comfortable' : 'compact';
    this.fp.save('terminations', {
      searchQuery: this.searchQuery, selectedStatuses: this.selectedStatuses,
      selectedDateFilters: this.selectedDateFilters, dateRangeFilter: this.dateRangeFilter,
      activeTab: this.activeTab, selectedHandoverSubFilter: this.selectedHandoverSubFilter,
      gridDensity: this.gridDensity
    });
  }

  // ── Panel ─────────────────────────────────────────────────────────────────
  panelOpen = false;
  selectedRecord: TerminationRecord | null = null;
  filteredRecords: TerminationRecord[] = [];
  panelIndex = 0;
  reviewerNotes = '';
  negotiationHistoryOpen = false;

  // Negotiation remarks
  negotiationRemarks      = '';
  negotiationRemarksError = false;
  negCommMode             = 'Phone Call';
  negPOC                  = '';
  negPOCError             = false;

  roleLabel(role: NegotiationEntry['role']): string {
    const map: Record<string, string> = {
      reviewer:   'Reviewer',
      customer:   'Customer',
      management: 'CEO / Mgmt',
      system:     'System',
    };
    return map[role] ?? role;
  }

  // Call-Off modal
  callOffModalOpen   = false;
  callOffModalRemark = '';
  callOffModalError  = false;

  // Handover completed modal
  handoverCompletedModalOpen = false;
  handoverDownloadLink       = '';
  linkCopied                 = false;

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

  noticePeriodOptions = [
    { days: 15, label: 'Accelerated'  },
    { days: 30, label: 'Standard'     },
    { days: 60, label: 'Extended'     },
    { days: 90, label: 'Enterprise'   },
  ];

  // ── Metrics ───────────────────────────────────────────────────────────────
  get requestedCount()        { return this.records.filter(r => r.terminationStatus === 'Termination Requested').length; }
  get reviewCount()           { return this.records.filter(r => r.terminationStatus === 'Under Review').length; }
  get noticeCount()           { return this.records.filter(r => r.terminationStatus === 'Notice Period').length; }
  get terminatedCount()       { return this.records.filter(r => r.terminationStatus === 'Terminated').length; }
  get callOffCount()          { return this.records.filter(r => r.terminationStatus === 'Call-Off').length; }
  get underReviewTotalCount()          { return this.requestedCount + this.reviewCount; }
  get totalCount()                     { return this.records.length; }
  get handoverEmailSentCount()         { return this.records.filter(r => r.terminationStatus === 'Terminated' && r.handoverStatus === 'handover_email_sent').length; }
  get accountsClearancePendingCount()  { return this.records.filter(r => r.terminationStatus === 'Notice Period' && r.handoverStatus === 'accounts_clearance_pending').length; }
  get accountsClearanceCompleteCount() { return this.records.filter(r => r.terminationStatus === 'Notice Period' && r.handoverStatus === 'accounts_clearance_complete').length; }
  get terminationCompletedCount()      { return this.records.filter(r => r.terminationStatus === 'Terminated' && r.handoverStatus === 'termination_completed').length; }
  get filesDownloadedCount()           { return this.records.filter(r => r.terminationStatus === 'Terminated' && r.handoverStatus === 'files_downloaded').length; }
  get noticePeriodCardCount()          { return this.accountsClearancePendingCount + this.accountsClearanceCompleteCount; }
  get sentForNegotiationCount()        { return this.records.filter(r => r.terminationStatus === 'Sent for Negotiation').length; }
  get negotiationApprovedCount()       { return this.records.filter(r => r.terminationStatus === 'Negotiation Approved').length; }
  get underNegotiationCount()          { return this.sentForNegotiationCount + this.negotiationApprovedCount; }

  get showPendingClearance(): boolean {
    if (!this.selectedRecord?.pendingClearanceValue) return false;
    const s = this.selectedRecord.terminationStatus;
    return s === 'Notice Period' || s === 'Terminated';
  }

  get daysRemaining(): number {
    if (!this.selectedRecord) return 0;
    return Math.max(0, Math.ceil((this.selectedRecord.noticeEndDate.getTime() - Date.now()) / 86_400_000));
  }

  ngOnInit(): void {
    this.seedRecords();
    this.restoreFilters();
    this.applyFilter();
  }

  private restoreFilters(): void {
    const s = this.fp.load<Record<string, unknown>>('terminations');
    if (!s) return;
    this.searchQuery             = (s['searchQuery']             as string)   ?? this.searchQuery;
    this.selectedStatuses        = (s['selectedStatuses']        as any[])    ?? this.selectedStatuses;
    this.selectedDateFilters     = (s['selectedDateFilters']     as string[]) ?? this.selectedDateFilters;
    this.dateRangeFilter         = (s['dateRangeFilter']         as any)      ?? this.dateRangeFilter;
    this.activeTab               = (s['activeTab']               as any)      ?? this.activeTab;
    this.selectedHandoverSubFilter = (s['selectedHandoverSubFilter'] as string | null) ?? this.selectedHandoverSubFilter;
    this.gridDensity             = (s['gridDensity']             as any)      ?? this.gridDensity;
  }

  seedRecords(): void {
    const DAY = 86_400_000;
    const now = Date.now();

    const seed: Array<{
      company: string; contact: string; manager: string; ref: string;
      status: TerminationStatus; reason: string; daysAgo: number;
      noticeDays: number; value: string; emirate: string; callOff?: string;
      pendingClearanceValue?: string;
      handoverStatus?: 'handover_email_sent' | 'accounts_clearance_pending' | 'accounts_clearance_complete' | 'termination_completed' | 'files_downloaded';
      negotiationRemarks?: string;
    }> = [
      { company: 'Sunrise Family Clinic',     contact: 'Dr. Khalid Al Mansoori', manager: 'John Smith',    ref: 'CTR-2025-0107', status: 'Under Review',          reason: 'Clinic closure — voluntary liquidation',                    daysAgo: 3,  noticeDays: 30, value: 'AED 49,000', emirate: 'Dubai',     },
      { company: 'Nightingale Medical Group', contact: 'Dr. Rashid Al Nuaimi',   manager: 'Layla Ibrahim', ref: 'CTR-2025-0112', status: 'Under Review',          reason: 'Merger with larger hospital network — account consolidation', daysAgo: 7,  noticeDays: 30, value: 'AED 72,000', emirate: 'Dubai',     },
      { company: 'Crescent Urgent Care',      contact: 'Dr. Aisha Al Marzouqi', manager: 'John Smith',    ref: 'CTR-2024-0098', status: 'Terminated',            reason: 'Loss of Healthcare Authority License',                       daysAgo: 18, noticeDays: 30, value: 'AED 55,000', emirate: 'Ajman',     handoverStatus: 'handover_email_sent',          pendingClearanceValue: 'AED 4,600' },
      { company: 'Gulf Spine Institute',      contact: 'Dr. Tariq Al Balushi',   manager: 'Ali Hassan',    ref: 'CTR-2025-0121', status: 'Notice Period',         reason: 'Relocation outside UAE — permanent closure',                 daysAgo: 12, noticeDays: 30, value: 'AED 63,000', emirate: 'Abu Dhabi', handoverStatus: 'accounts_clearance_pending',    pendingClearanceValue: 'AED 10,500' },
      { company: 'Medcare Polyclinic',        contact: 'Dr. Hana Al Zarouni',    manager: 'Sara Mohammed', ref: 'CTR-2025-0134', status: 'Notice Period',          reason: 'Non-payment of subscription fees for 3 consecutive months',  daysAgo: 45, noticeDays: 30, value: 'AED 58,000', emirate: 'Dubai',     handoverStatus: 'accounts_clearance_pending',    pendingClearanceValue: 'AED 14,500' },
      { company: 'Al Noor Dental Centre',     contact: 'Dr. Faisal Al Hammadi',  manager: 'Ali Hassan',    ref: 'CTR-2025-0089', status: 'Call-Off',              reason: 'Customer resolved outstanding issues — management decision',  daysAgo: 22, noticeDays: 30, value: 'AED 44,000', emirate: 'Sharjah',   callOff: 'Senior management approved retention. Customer settled all dues and signed renewal commitment.' },
      { company: 'Emirates Rehab Center',     contact: 'Dr. Layla Al Shamsi',    manager: 'Layla Ibrahim', ref: 'CTR-2025-0145', status: 'Under Review',          reason: 'Financial difficulties — unable to sustain subscription',     daysAgo: 1,  noticeDays: 30, value: 'AED 51,000', emirate: 'Dubai',     },
      { company: 'Oasis Derma Clinic',        contact: 'Dr. Priya Nair',         manager: 'Sara Mohammed', ref: 'CTR-2025-0156', status: 'Under Review',          reason: 'Change of ownership — new entity to be onboarded separately', daysAgo: 5,  noticeDays: 30, value: 'AED 47,000', emirate: 'Dubai',     },
      { company: 'LifeCare Day Surgery',      contact: 'Dr. Amara Osei',         manager: 'John Smith',    ref: 'CTR-2024-0076', status: 'Notice Period',         reason: 'Facility converted to insurance-panel-only model',           daysAgo: 60, noticeDays: 30, value: 'AED 62,000', emirate: 'Dubai',     handoverStatus: 'accounts_clearance_complete' },
      { company: 'Pinnacle Spine & Sports',   contact: 'Dr. Ravi Krishnan',      manager: 'Layla Ibrahim', ref: 'CTR-2024-0059', status: 'Terminated',            reason: 'Voluntary wind-down; principal relocated abroad',            daysAgo: 90, noticeDays: 30, value: 'AED 39,000', emirate: 'Abu Dhabi', handoverStatus: 'termination_completed' },
      { company: 'Royal Dental Clinic',       contact: 'Dr. Omar Al Farsi',      manager: 'Sara Mohammed', ref: 'CTR-2023-0044', status: 'Terminated',            reason: 'Voluntary closure — owner retirement',                       daysAgo: 120, noticeDays: 30, value: 'AED 35,000', emirate: 'Dubai',    handoverStatus: 'files_downloaded' },
      { company: 'Harmony Wellness Clinic',   contact: 'Dr. Nadia Al Rashid',    manager: 'Sara Mohammed', ref: 'CTR-2025-0167', status: 'Sent for Negotiation',  reason: 'Operational losses due to staff shortage — requesting early exit', daysAgo: 9,  noticeDays: 30, value: 'AED 46,000', emirate: 'Dubai',     negotiationRemarks: 'Customer has requested a 3-month grace period for dues. Terms are under management review and pending sign-off.' },
      { company: 'Peak Performance Sports',   contact: 'Dr. Carlos Rivera',      manager: 'John Smith',    ref: 'CTR-2025-0178', status: 'Negotiation Approved',  reason: 'Clinic downsizing — reduced capacity cannot sustain subscription', daysAgo: 14, noticeDays: 30, value: 'AED 53,000', emirate: 'Abu Dhabi', negotiationRemarks: 'Management approved a revised exit schedule. Customer agreed to 30-day handover window.' },
    ];

    const D = (s: string) => new Date(s);

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
      callOffRemark:          row.callOff,
      handoverStatus:         row.handoverStatus,
      pendingClearanceValue:  row.pendingClearanceValue,
      negotiationRemarks:     row.negotiationRemarks,
      history:            [],
    }));

    // Seed negotiation activity logs
    const h = (daysAgo: number, hoursOffset = 0) =>
      new Date(now - daysAgo * DAY + hoursOffset * 3600_000);

    const sunrise = this.records.find(r => r.companyName === 'Sunrise Family Clinic');
    if (sunrise) {
      sunrise.negotiationHistory = [
        { date: h(3, 1),  role: 'system',   by: 'System',                   message: 'Termination request raised and assigned for initial review.' },
        { date: h(2, 4),  role: 'reviewer', by: 'John Smith (Reviewer)',     message: 'Reviewed request. Clinic closure due to voluntary liquidation confirmed. Advising customer on data handover requirements and outstanding obligations.', commMode: 'Email', poc: 'Dr. Khalid Al Mansoori' },
      ];
    }

    const emirates = this.records.find(r => r.companyName === 'Emirates Rehab Center');
    if (emirates) {
      emirates.negotiationHistory = [
        { date: h(1, 1),  role: 'system',   by: 'System',                       message: 'Termination request raised. Assigned to Layla Ibrahim for review.' },
        { date: h(1, 3),  role: 'reviewer', by: 'Layla Ibrahim (Reviewer)',      message: 'Initial review started. Financial difficulties noted — customer contacted to explore negotiation options before proceeding.', commMode: 'Phone Call', poc: 'Dr. Layla Al Shamsi' },
        { date: h(0, 14), role: 'customer', by: 'Dr. Layla Al Shamsi (Customer)', message: 'Customer reached out requesting a 2-month grace period to secure alternative funding and avoid full termination of contract.', commMode: 'WhatsApp', poc: 'Layla Ibrahim' },
      ];
    }

    const harmony = this.records.find(r => r.companyName === 'Harmony Wellness Clinic');
    if (harmony) {
      harmony.negotiationHistory = [
        { date: h(9, 1),  role: 'system',   by: 'System',                        message: 'Termination request raised by Sara Mohammed.' },
        { date: h(8, 4),  role: 'reviewer', by: 'Sara Mohammed (Reviewer)',       message: 'Request reviewed. Customer cited operational losses due to staff shortage. Initiating negotiation process.', commMode: 'Email', poc: 'Dr. Nadia Al Rashid' },
        { date: h(7, 9),  role: 'customer', by: 'Dr. Nadia Al Rashid (Customer)', message: 'Customer responded via email. Requesting a 3-month grace period for outstanding dues and favourable early exit terms.', commMode: 'Email', poc: 'Sara Mohammed' },
        { date: h(5, 5),  role: 'reviewer', by: 'Sara Mohammed (Reviewer)',       message: 'Grace period and payment terms documented as negotiation remarks. Submitting to management for approval.', commMode: 'Phone Call', poc: 'Dr. Nadia Al Rashid' },
        { date: h(5, 6),  role: 'system',   by: 'System',                        message: 'Negotiation remarks submitted. Request sent for management approval.' },
      ];
    }

    const peak = this.records.find(r => r.companyName === 'Peak Performance Sports');
    if (peak) {
      peak.negotiationHistory = [
        { date: h(14, 1), role: 'system',   by: 'System',                        message: 'Termination request raised by John Smith.' },
        { date: h(13, 4), role: 'reviewer', by: 'John Smith (Reviewer)',          message: 'Under review. Customer contacted to discuss a revised exit schedule and outstanding dues.', commMode: 'Phone Call', poc: 'Dr. Carlos Rivera' },
        { date: h(11, 9), role: 'customer', by: 'Dr. Carlos Rivera (Customer)',   message: 'Customer agreed to a 30-day handover window and committed to settling remaining dues before the notice period ends.', commMode: 'WhatsApp', poc: 'John Smith' },
        { date: h(10, 5), role: 'reviewer', by: 'John Smith (Reviewer)',          message: 'Exit schedule and payment commitment documented. Negotiation remarks finalised and submitted for management sign-off.', commMode: 'Email', poc: 'Dr. Carlos Rivera' },
        { date: h(8, 3),  role: 'management', by: 'Management (Approver)',        message: 'Negotiation terms reviewed and approved. Customer may proceed under the agreed 30-day handover schedule.' },
      ];
    }

    // Seed rich call-off history for Al Noor Dental Centre (2-cycle raise→calloff)
    const alNoor = this.records.find(r => r.companyName === 'Al Noor Dental Centre');
    if (alNoor) {
      alNoor.history = [
        { date: D('2024-09-15'), event: 'raised',    label: 'Termination Request Raised — Cycle 1',    note: 'Non-payment of dues for 2 consecutive months. Warning notices sent but unresponded.', by: 'Ali Hassan' },
        { date: D('2024-09-22'), event: 'review',    label: 'Moved to Under Review',                   by: 'Layla Ibrahim' },
        { date: D('2024-10-01'), event: 'called_off', label: 'Called Off — Cycle 1 Resolved',          note: 'Customer committed to clearing all outstanding dues within 30 days. Signed a payment plan agreement.', by: 'Sales Manager' },
        { date: D('2025-01-05'), event: 'raised',    label: 'Termination Request Raised — Cycle 2',    note: 'Customer defaulted on the agreed payment plan. No response to follow-up calls for 3 weeks.', by: 'Ali Hassan' },
        { date: D('2025-01-12'), event: 'review',    label: 'Moved to Under Review',                   by: 'Layla Ibrahim' },
        { date: D('2025-01-22'), event: 'called_off', label: 'Called Off — Cycle 2 (Current)',         note: 'Senior management approved retention. Customer settled all dues and signed renewal commitment.', by: 'Senior Management' },
      ];
    }
  }

  // ── Tab helpers ───────────────────────────────────────────────────────────
  setTab(tab: TerminationStatus | 'All' | 'Under Negotiation'): void {
    this.selectedHandoverSubFilter = null;
    if (this.activeTab === tab) {
      this.activeTab = 'All';
    } else {
      this.activeTab = tab;
    }
    this.applyFilter();
  }

  setHandoverFilter(status: string): void {
    if (this.selectedHandoverSubFilter === status) {
      this.selectedHandoverSubFilter = null;
    } else {
      this.selectedHandoverSubFilter = status;
      this.activeTab = ['accounts_clearance_pending', 'accounts_clearance_complete'].includes(status)
        ? 'Notice Period'
        : 'Terminated';
    }
    this.applyFilter();
  }

  toggleDateFilter(filter: string): void {
    if (this.selectedDateFilters.includes(filter)) {
      this.selectedDateFilters = [];
    } else {
      this.selectedDateFilters = [filter];
    }
    this.applyFilter();
  }

  clearAllFilters(): void {
    this.searchQuery = '';
    this.selectedDateFilters = [];
    this.selectedStatuses = [];
    this.dateRangeFilter = { start: null, end: null };
    this.activeTab = 'All';
    this.selectedHandoverSubFilter = null;
    this.applyFilter();
  }

  get isFilterApplied(): boolean {
    return !!(
      this.searchQuery.trim() ||
      this.selectedDateFilters.length > 0 ||
      this.selectedStatuses.length > 0 ||
      this.dateRangeFilter.start ||
      this.dateRangeFilter.end ||
      (this.activeTab && this.activeTab !== 'All') ||
      this.selectedHandoverSubFilter
    );
  }

  tabCount(tab: TerminationStatus | 'All'): number {
    return tab === 'All' ? this.records.length : this.records.filter(r => r.terminationStatus === tab).length;
  }

  matchDateFilters(dateToCheck: Date | string | null | undefined, selectedFilters: string[]): boolean {
    if (!selectedFilters || selectedFilters.length === 0) return true;
    if (!dateToCheck) return false;
    const d = new Date(dateToCheck);
    if (isNaN(d.getTime())) return false;

    const today = new Date();
    const now = today.getTime();
    const DAY = 86_400_000;

    for (const filter of selectedFilters) {
      if (filter === 'MTD') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        if (d >= startOfMonth && d <= today) return true;
      } else if (filter === 'Last Month') {
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
        if (d >= startOfLastMonth && d <= endOfLastMonth) return true;
      } else if (filter === 'Last Quarter') {
        const start = new Date(now - 90 * DAY);
        if (d >= start && d <= today) return true;
      } else if (filter === 'Last 6 Months') {
        const start = new Date(now - 180 * DAY);
        if (d >= start && d <= today) return true;
      } else if (filter === 'YTD') {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        if (d >= startOfYear && d <= today) return true;
      } else if (filter === 'As of Date') {
        return true;
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

    // 3. Date Button Filter
    if (this.selectedDateFilters && this.selectedDateFilters.length > 0) {
      filtered = filtered.filter(r => this.matchDateFilters(r.requestedOn, this.selectedDateFilters));
    }

    // 4. Date Range Picker Filter
    if (this.dateRangeFilter.start || this.dateRangeFilter.end) {
      filtered = filtered.filter(r => {
        const d = r.requestedOn;
        if (!d) return false;
        if (this.dateRangeFilter.start && d < this.dateRangeFilter.start) return false;
        if (this.dateRangeFilter.end) {
          const endOfDay = new Date(this.dateRangeFilter.end);
          endOfDay.setHours(23, 59, 59, 999);
          if (d > endOfDay) return false;
        }
        return true;
      });
    }

    // 5. Active Tab Card Filter (applies to the grid only)
    if (this.activeTab && this.activeTab !== 'All') {
      if (this.activeTab === 'Under Review') {
        filtered = filtered.filter(r => r.terminationStatus === 'Under Review' || r.terminationStatus === 'Termination Requested');
      } else if (this.activeTab === 'Under Negotiation') {
        filtered = filtered.filter(r => r.terminationStatus === 'Sent for Negotiation' || r.terminationStatus === 'Negotiation Approved');
      } else {
        filtered = filtered.filter(r => r.terminationStatus === this.activeTab);
      }
    }

    // 6. Handover sub-stage filter (inner chips of Notice Period / Terminated cards)
    if (this.selectedHandoverSubFilter) {
      filtered = filtered.filter(r => r.handoverStatus === this.selectedHandoverSubFilter);
    }

    this.filteredRecords = filtered;
    this.gridData = process(filtered, this.gridState) as { data: TerminationRecord[]; total: number };
    this.fp.save('terminations', {
      searchQuery: this.searchQuery, selectedStatuses: this.selectedStatuses,
      selectedDateFilters: this.selectedDateFilters, dateRangeFilter: this.dateRangeFilter,
      activeTab: this.activeTab, selectedHandoverSubFilter: this.selectedHandoverSubFilter,
      gridDensity: this.gridDensity
    });
  }

  onStateChange(state: DataStateChangeEvent): void {
    this.gridState = state;
    this.applyFilter();
  }

  // ── Status helpers ────────────────────────────────────────────────────────
  getStatusLabel(status: TerminationStatus): string {
    const map: Record<TerminationStatus, string> = {
      'Termination Requested': 'Under Review',
      'Under Review':          'Under Review',
      'Sent for Negotiation':  'Under Negotiation',
      'Negotiation Approved':  'Under Negotiation',
      'Notice Period':         'In Notice Period',
      'Terminated':            'Terminated',
      'Call-Off':              'Called-Off',
    };
    return map[status] ?? status;
  }

  getStatusClass(status: TerminationStatus): string {
    const map: Record<TerminationStatus, string> = {
      'Termination Requested': 'tm-badge-review',
      'Under Review':          'tm-badge-review',
      'Sent for Negotiation':  'tm-badge-negotiation',
      'Negotiation Approved':  'tm-badge-negotiation',
      'Notice Period':         'tm-badge-notice',
      'Terminated':            'tm-badge-terminated',
      'Call-Off':              'tm-badge-calloff',
    };
    return map[status] ?? 'tm-badge-review';
  }

  getStatusIcon(status: TerminationStatus): string {
    const map: Record<TerminationStatus, string> = {
      'Termination Requested': 'fas fa-search',
      'Under Review':          'fas fa-search',
      'Sent for Negotiation':  'fas fa-handshake',
      'Negotiation Approved':  'fas fa-handshake',
      'Notice Period':         'fas fa-hourglass-half',
      'Terminated':            'fas fa-times-circle',
      'Call-Off':              'fas fa-undo',
    };
    return map[status] ?? 'fas fa-circle';
  }

  // Unified helpers for the grid Status/Stage cell — surfaces sub-stages as KPI labels
  getGridLabel(r: TerminationRecord): string {
    if (r.terminationStatus === 'Notice Period' && r.handoverStatus === 'accounts_clearance_pending') {
      return 'Clearance Pending';
    }
    if (r.terminationStatus === 'Terminated' && r.handoverStatus === 'handover_email_sent') {
      return 'Handover Email Sent';
    }
    return this.getStatusLabel(r.terminationStatus);
  }

  getGridClass(r: TerminationRecord): string {
    if (r.terminationStatus === 'Notice Period' && r.handoverStatus === 'accounts_clearance_pending') {
      return 'tm-badge-hs-pending';
    }
    if (r.terminationStatus === 'Terminated' && r.handoverStatus === 'handover_email_sent') {
      return 'tm-badge-hs-sent';
    }
    return this.getStatusClass(r.terminationStatus);
  }

  getGridIcon(r: TerminationRecord): string {
    if (r.terminationStatus === 'Notice Period' && r.handoverStatus === 'accounts_clearance_pending') {
      return 'fas fa-shield-alt';
    }
    if (r.terminationStatus === 'Terminated' && r.handoverStatus === 'handover_email_sent') {
      return 'fas fa-envelope';
    }
    return this.getStatusIcon(r.terminationStatus);
  }

  getHandoverLabel(status: string): string {
    const map: Record<string, string> = {
      'handover_email_sent':         'Handover Email Sent',
      'accounts_clearance_pending':  'Accounts Clearance Pending',
      'accounts_clearance_complete': 'Accounts Clearance Complete',
      'termination_completed':       'Handover Pending',
      'files_downloaded':            'Handover Completed',
    };
    return map[status] ?? status;
  }

  getHandoverClass(status: string): string {
    const map: Record<string, string> = {
      'handover_email_sent':         'tm-badge-hs-sent',
      'accounts_clearance_pending':  'tm-badge-hs-pending',
      'accounts_clearance_complete': 'tm-badge-hs-done',
      'termination_completed':       'tm-badge-hs-complete',
      'files_downloaded':            'tm-badge-hs-files',
    };
    return map[status] ?? 'tm-badge-terminated';
  }

  getHandoverIcon(status: string): string {
    const map: Record<string, string> = {
      'handover_email_sent':         'fas fa-envelope',
      'accounts_clearance_pending':  'fas fa-hourglass-half',
      'accounts_clearance_complete': 'fas fa-check-circle',
      'termination_completed':       'fas fa-flag-checkered',
      'files_downloaded':            'fas fa-file-download',
    };
    return map[status] ?? 'fas fa-circle';
  }

  isActionable(status: TerminationStatus): boolean {
    return ['Under Review', 'Sent for Negotiation', 'Negotiation Approved', 'Notice Period'].includes(status);
  }

  isStepDone(step: string): boolean {
    const order = ['Under Review', 'Notice Period', 'Terminated'];
    const s = this.selectedRecord?.terminationStatus ?? '';
    const mapped = (s === 'Sent for Negotiation' || s === 'Negotiation Approved') ? 'Under Review' : s;
    const current = order.indexOf(mapped);
    const target  = order.indexOf(step);
    return target < current && current !== -1;
  }

  isStepActive(step: string): boolean {
    const s = this.selectedRecord?.terminationStatus ?? '';
    if (step === 'Under Review') {
      return s === 'Under Review' || s === 'Sent for Negotiation' || s === 'Negotiation Approved';
    }
    return s === step;
  }

  // ── Panel ─────────────────────────────────────────────────────────────────
  openPanel(record: TerminationRecord): void {
    this.selectedRecord         = { ...record };
    this.reviewerNotes          = '';
    this.negotiationRemarks     = '';
    this.negotiationRemarksError = false;
    this.negCommMode             = 'Phone Call';
    this.negPOC                  = '';
    this.negPOCError             = false;
    this.callOffModalOpen       = false;
    this.panelOpen              = true;
    this.panelIndex = this.filteredRecords.findIndex(r => r.id === record.id);
    if (this.panelIndex < 0) this.panelIndex = 0;
    this.ks.register('term-panel', {
      'Escape':     () => this.closePanel(),
      'ArrowLeft':  () => this.navigatePanel(-1),
      'ArrowRight': () => this.navigatePanel(1),
    });
  }

  navigatePanel(dir: -1 | 1): void {
    const next = this.panelIndex + dir;
    if (next < 0 || next >= this.filteredRecords.length) return;
    this.panelIndex = next;
    this.openPanel(this.filteredRecords[next]);
  }

  closePanel(): void {
    this.panelOpen              = false;
    this.selectedRecord         = null;
    this.negotiationHistoryOpen = false;
    this.negCommMode             = 'Phone Call';
    this.negPOC                  = '';
    this.negPOCError             = false;
    this.ks.deregister('term-panel');
    this.panelClosed.emit();
  }

  getCommModeIcon(mode: string): string {
    const map: Record<string, string> = {
      'Phone Call':   'fas fa-phone-alt',
      'WhatsApp':     'fab fa-whatsapp',
      'Email':        'fas fa-envelope',
      'Text Message': 'fas fa-sms',
    };
    return map[mode] ?? 'fas fa-comments';
  }

  addNegotiationLogEntry(): void {
    if (!this.selectedRecord) return;
    if (!this.negotiationRemarks.trim()) {
      this.negotiationRemarksError = true;
      return;
    }
    if (!this.negPOC.trim()) {
      this.negPOCError = true;
      return;
    }

    const rec = this.records.find(r => r.id === this.selectedRecord!.id);
    if (rec) {
      if (!rec.negotiationHistory) {
        rec.negotiationHistory = [];
      }
      const entry: NegotiationEntry = {
        date: new Date(),
        role: 'reviewer',
        by: rec.salesPerson || 'Reviewer',
        message: this.negotiationRemarks,
        commMode: this.negCommMode,
        poc: this.negPOC
      };
      rec.negotiationHistory.push(entry);
      this.selectedRecord!.negotiationHistory = [...rec.negotiationHistory];
      
      // Clear fields for next entry
      this.negotiationRemarks = '';
      this.negPOC = '';
      this.negCommMode = 'Phone Call';
      this.negotiationRemarksError = false;
      this.negPOCError = false;
      this.applyFilter();
    }
  }

  submitForApproval(): void {
    if (!this.selectedRecord) return;
    
    // If there is an active unsaved remark in the textarea, log it first!
    if (this.negotiationRemarks.trim()) {
      if (!this.negPOC.trim()) {
        this.negPOCError = true;
        return;
      }
      
      const rec = this.records.find(r => r.id === this.selectedRecord!.id);
      if (rec) {
        if (!rec.negotiationHistory) {
          rec.negotiationHistory = [];
        }
        rec.negotiationHistory.push({
          date: new Date(),
          role: 'reviewer',
          by: rec.salesPerson || 'Reviewer',
          message: this.negotiationRemarks,
          commMode: this.negCommMode,
          poc: this.negPOC
        });
        this.selectedRecord!.negotiationHistory = [...rec.negotiationHistory];
      }
    } else {
      // If textarea is empty, we must have at least one negotiation entry in the log to submit!
      const hasHistory = this.selectedRecord?.negotiationHistory && this.selectedRecord.negotiationHistory.length > 0;
      if (!hasHistory) {
        this.negotiationRemarksError = true;
        return;
      }
    }

    // Save the final negotiationRemarks to patch the record (taking the last message or a general summary)
    const finalRemarks = this.selectedRecord?.negotiationHistory?.filter(h => h.role === 'reviewer')?.pop()?.message || '';

    this._addHistory({
      event: 'review',
      label: 'Sent for Negotiation — Awaiting Management Approval',
      note: finalRemarks || 'Negotiation terms logged and submitted.',
      by: 'Reviewer'
    });
    
    this._patch(this.selectedRecord!.id, {
      terminationStatus: 'Sent for Negotiation',
      negotiationRemarks: finalRemarks || 'Negotiation terms logged and submitted.'
    });

    // Clear fields
    this.negotiationRemarks = '';
    this.negPOC = '';
    this.negCommMode = 'Phone Call';
    this.negotiationRemarksError = false;
    this.negPOCError = false;
    
    this.closePanel();
  }

  approveNegotiation(): void {
    this._addHistory({ event: 'review', label: 'Negotiation Approved by Management', by: 'Management' });
    this._patch(this.selectedRecord!.id, { terminationStatus: 'Negotiation Approved' });
    this.closePanel();
  }

  proceedForTermination(): void {
    this._addHistory({ event: 'notice', label: 'Notice Period Initiated — Accounts Team Notified', by: 'Reviewer' });
    this._patch(this.selectedRecord!.id, { terminationStatus: 'Notice Period', handoverStatus: 'accounts_clearance_pending' });
    this.closePanel();
  }

  markAccountsClearanceComplete(): void {
    this._addHistory({ event: 'notice', label: 'Accounts Clearance Confirmed', by: 'Accounts Team' });
    this._patch(this.selectedRecord!.id, { handoverStatus: 'accounts_clearance_complete' });
    this.closePanel();
  }

  initiateHandover(): void {
    if (!this.selectedRecord) return;
    const email = `${this.selectedRecord.contactName.toLowerCase().replace(/dr\.\s+/g, '').replace(/\s+/g, '.')}@clinic.ae`;
    this.outboxService.addItem({
      companyName: this.selectedRecord.companyName,
      contactName: this.selectedRecord.contactName,
      email: email,
      channel: 'Email',
      category: 'Termination',
      actionType: 'Send',
      reference: this.selectedRecord.contractRef,
      originalRecordId: this.selectedRecord.id,
      details: 'Exit handover notice email dispatch to customer and transition instructions.',
    });
    alert(`Handover notice dispatch request for ${this.selectedRecord.companyName} queued to Outbox for Final Approval.`);
    this.closePanel();
  }

  completeHandover(): void {
    if (!this.selectedRecord) return;
    const email = `${this.selectedRecord.contactName.toLowerCase().replace(/dr\.\s+/g, '').replace(/\s+/g, '.')}@clinic.ae`;
    this.outboxService.addItem({
      companyName: this.selectedRecord.companyName,
      contactName: this.selectedRecord.contactName,
      email: email,
      channel: 'Email',
      category: 'Termination',
      actionType: 'Send Again',
      reference: this.selectedRecord.contractRef,
      originalRecordId: this.selectedRecord.id,
      details: 'Handover completed successfully. Final checklist and archival download package transmission.',
    });
    alert(`Handover completion request for ${this.selectedRecord.companyName} queued to Outbox for Final Approval.`);
    this.closePanel();
  }

  copyDownloadLink(): void {
    navigator.clipboard.writeText(this.handoverDownloadLink).catch(() => {});
    this.linkCopied = true;
    setTimeout(() => this.linkCopied = false, 2000);
  }

  openCallOffModal(): void {
    this.callOffModalOpen   = true;
    this.callOffModalRemark = '';
    this.callOffModalError  = false;
    this.ks.register('term-dialog', {
      'Escape': () => this.closeCallOffModal(),
      'Enter':  () => { if (this.callOffModalRemark.trim()) this.submitCallOff(); },
    });
  }

  closeCallOffModal(): void {
    this.callOffModalOpen = false;
    this.ks.deregister('term-dialog');
  }

  submitCallOff(): void {
    if (!this.callOffModalRemark.trim()) { this.callOffModalError = true; return; }
    const rec = this.records.find(r => r.id === this.selectedRecord!.id);
    const cycle = (rec?.history?.filter(h => h.event === 'called_off').length ?? 0) + 1;
    this._addHistory({ event: 'called_off', label: `Called Off — Cycle ${cycle}`, note: this.callOffModalRemark, by: 'Reviewer' });
    this._patch(this.selectedRecord!.id, { terminationStatus: 'Call-Off', callOffRemark: this.callOffModalRemark });
    this.callOffModalOpen = false;
    this.ks.deregister('term-dialog');
    this.closePanel();
  }

  private _patch(id: number, patch: Partial<TerminationRecord>): void {
    const rec = this.records.find(r => r.id === id);
    if (rec) { Object.assign(rec, patch); this.applyFilter(); }
  }

  private _addHistory(entry: Omit<TermHistory, 'date'>): void {
    const rec = this.records.find(r => r.id === this.selectedRecord!.id);
    if (!rec) return;
    if (!rec.history) rec.history = [];
    rec.history.push({ ...entry, date: new Date() });
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
      terminationStatus: 'Under Review',
      terminationReason: this.newTermination.reason,
      requestedOn: new Date(),
      noticeEndDate: new Date(Date.now() + Number(this.newTermination.noticeDays) * DAY),
      annualValue: this.newTermination.annualValue,
      emirate: this.newTermination.emirate,
      history: [{ date: new Date(), event: 'review', label: 'Termination Request Raised — Under Review', note: this.newTermination.reason, by: this.newTermination.salesPerson }],
    };

    this.records.unshift(record);
    this.applyFilter();
    this.raiseDialogOpen = false;
  }

}
