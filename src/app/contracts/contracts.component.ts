import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
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
import { MultiSelectModule } from '@progress/kendo-angular-dropdowns';
import { DateInputsModule } from '@progress/kendo-angular-dateinputs';
import { process, State } from '@progress/kendo-data-query';
import { OutboxService } from '../shared/outbox.service';
import { OutboxReviewPanelComponent } from '../shared/outbox-review-panel/outbox-review-panel';
import { FilterPersistenceService } from '../shared/filter-persistence.service';
import { KeyboardShortcutService } from '../shared/keyboard-shortcut.service';

export type ContractStatus =
  | 'Contract Sent'
  | 'Contract Signed'
  | 'Contract Terminated'
  | 'Renewal In Progress';

export interface ContractRecord {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  mobile: string;
  contractStatus: ContractStatus;
  contractRef: string;
  contractSentOn: Date;
  contractSignedOn: Date | null;
  salesPerson: string;
  subscriptionPlan?: string;
  clinicCount?: number;
  activeUsers?: number;
  boughtAddOns?: string[];
  salesRepresentative?: string;
  isVip?: boolean;
}

@Component({
  selector: 'app-contracts',
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
    MultiSelectModule,
    DateInputsModule,
    OutboxReviewPanelComponent,
  ],
  templateUrl: './contracts.component.html',
  styleUrls: ['./contracts.component.scss'],
})
export class ContractsComponent implements OnInit {

  constructor(
    private cdr: ChangeDetectorRef,
    private outboxService: OutboxService,
    private fp: FilterPersistenceService,
    private ks: KeyboardShortcutService
  ) {}

  @Input() set initialFilter(status: string | null) {
    if (status) this.selectedStatuses = [status as ContractStatus];
  }

  @Input() set openRecordId(id: number | null) {
    if (id != null) {
      setTimeout(() => {
        const record = this.records.find(r => r.id === id);
        if (record) {
          this.openContractPanel(record);
        }
      }, 100);
    }
  }
  @Output() panelClosed = new EventEmitter<void>();

  // ── Grid State ─────────────────────────────────────────────────────────────
  records: ContractRecord[] = [];
  gridData: { data: ContractRecord[]; total: number } = { data: [], total: 0 };

  gridState: State = { sort: [] };
  selectableSettings: SelectableSettings = { checkboxOnly: true, mode: 'multiple' };
  selectedKeys: number[] = [];
  outboxReviewOpen = false;

  // ── Search & Filter State ──────────────────────────────────────────────────
  searchQuery: string = '';
  selectedStatuses: ContractStatus[] = [];
  selectedDateFilters: string[] = [];
  dateRangeFilter: { start: Date | null; end: Date | null } = { start: null, end: null };

  readonly dateFilterOptions: string[] = [
    'MTD',
    'Last Month',
    'Last Quarter',
    'Last 6 Months',
    'YTD',
    'As of Date',
  ];

  readonly availableStatuses: ContractStatus[] = [
    'Contract Sent',
    'Contract Signed',
    'Contract Terminated',
    'Renewal In Progress',
  ];

  // ── Status Tabs ────────────────────────────────────────────────────────────
  readonly statusTabs: { id: ContractStatus | 'All'; label: string }[] = [
    { id: 'All',                  label: 'All'         },
    { id: 'Contract Sent',        label: 'Pending'     },
    { id: 'Contract Signed',      label: 'Signed'      },
    { id: 'Contract Terminated',  label: 'Terminated'  },
    { id: 'Renewal In Progress',  label: 'Renewal'     },
  ];

  // ── Grid Density ──────────────────────────────────────────────────────────
  gridDensity: 'comfortable' | 'compact' = 'comfortable';

  toggleDensity(): void {
    this.gridDensity = this.gridDensity === 'compact' ? 'comfortable' : 'compact';
    this.fp.save('contracts', {
      searchQuery: this.searchQuery, selectedStatuses: this.selectedStatuses,
      selectedDateFilters: this.selectedDateFilters, dateRangeFilter: this.dateRangeFilter,
      activeMetricFilter: this.activeMetricFilter, activeTab: this.activeTab,
      gridDensity: this.gridDensity
    });
  }

  // ── Metric Filter ─────────────────────────────────────────────────────────
  activeMetricFilter = 'all';
  activeTab: ContractStatus | 'All' = 'All';

  // ── Dialog State ───────────────────────────────────────────────────────────
  sendDialogOpen = false;
  selectedRecord: ContractRecord | null = null;

  // ── Clinic Info Card (click-toggle, X button to close) ──────────────────
  hoverRecord: ContractRecord | null = null;
  hoverCardStyle: { top: string; left: string } = { top: '-9999px', left: '-9999px' };
  hoverCardReady = false;

  toggleHoverCard(event: MouseEvent, record: ContractRecord): void {
    // Toggle off when clicking the same icon again
    if (this.hoverRecord?.id === record.id) {
      this.hoverRecord = null; this.hoverCardReady = false; return;
    }

    const triggerRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    // Render off-screen first, flush to DOM, measure actual height, then position
    this.hoverRecord    = record;
    this.hoverCardReady = false;
    this.hoverCardStyle = { top: '-9999px', left: '-9999px' };
    this.cdr.detectChanges();   // force Angular to render @if(hoverRecord) to DOM now

    setTimeout(() => {
      const card = document.querySelector('.clinic-hover-card') as HTMLElement | null;
      if (!card || !this.hoverRecord) return;
      this.hoverCardStyle = this._calcCardPos(triggerRect, card.offsetWidth, card.offsetHeight);
      this.hoverCardReady = true;
      this.cdr.detectChanges();
    }, 0);
  }

  private _calcCardPos(trigger: DOMRect, cardW: number, cardH: number): { top: string; left: string } {
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const gap = 12;

    // Horizontal: centre on trigger, clamp within viewport
    let left = trigger.left + trigger.width / 2 - cardW / 2;
    left = Math.max(gap, Math.min(left, vw - cardW - gap));

    // Vertical: prefer below; flip above if not enough room
    const top = (vh - trigger.bottom >= cardH + gap)
      ? trigger.bottom + gap
      : Math.max(gap, trigger.top - cardH - gap);

    return { top: `${top}px`, left: `${left}px` };
  }

  // ── Contract Preview Panel ──────────────────────────────────────────────────
  contractPanelOpen = false;
  contractPanelRecord: ContractRecord | null = null;
  filteredRecords: ContractRecord[] = [];
  panelIndex = 0;

  // History navigation
  historyList: ContractRecord[] = [];
  historyIndex = 0;
  private contractHistoryMap = new Map<number, ContractRecord[]>();

  openContractPanel(record: ContractRecord): void {
    this.historyList = this.contractHistoryMap.get(record.id) ?? [record];
    this.historyIndex = 0;
    this.contractPanelRecord = { ...this.historyList[0] };
    this.contractPanelOpen   = true;
    this.panelIndex = this.filteredRecords.findIndex(r => r.id === record.id);
    if (this.panelIndex < 0) this.panelIndex = 0;
    this.ks.register('contracts-panel', {
      'Escape':      () => this.closeContractPanel(),
      'ArrowLeft':   () => this.navigatePanel(-1),
      'ArrowRight':  () => this.navigatePanel(1),
    });
  }

  navigatePanel(dir: -1 | 1): void {
    const next = this.panelIndex + dir;
    if (next < 0 || next >= this.filteredRecords.length) return;
    this.panelIndex = next;
    this.openContractPanel(this.filteredRecords[next]);
  }

  navigateHistory(dir: 1 | -1): void {
    const next = this.historyIndex + dir;
    if (next < 0 || next >= this.historyList.length) return;
    this.historyIndex = next;
    this.contractPanelRecord = { ...this.historyList[next] };
  }

  jumpHistory(index: number): void {
    if (index < 0 || index >= this.historyList.length) return;
    this.historyIndex = index;
    this.contractPanelRecord = { ...this.historyList[index] };
  }

  downloadPdf(): void {
    const paper = document.querySelector('.cp-paper') as HTMLElement | null;
    if (!paper) return;

    // Clone the rendered paper (Angular _ngcontent attrs cloned too — scoped CSS still applies)
    const clone = paper.cloneNode(true) as HTMLElement;
    clone.id = 'pdf-print-target';
    document.body.appendChild(clone);
    document.body.classList.add('print-pdf-mode');

    window.onafterprint = () => {
      document.body.classList.remove('print-pdf-mode');
      clone.parentNode?.removeChild(clone);
    };
    window.print();
  }

  closeContractPanel(): void {
    this.contractPanelOpen   = false;
    this.contractPanelRecord = null;
    this.ks.deregister('contracts-panel');
    this.panelClosed.emit();
  }

  contractStartDate(r: ContractRecord): Date {
    return r.contractSentOn;
  }

  contractEndDate(r: ContractRecord): Date {
    return new Date(this.contractStartDate(r).getTime() + 365 * 86_400_000);
  }

  contractAnnualValue(r: ContractRecord): string {
    return `AED ${45 + r.id * 2},000`;
  }

  isAboutToExpire(r: ContractRecord): boolean {
    if (r.contractStatus !== 'Contract Signed') return false;
    const now = Date.now();
    const window = 30 * 86_400_000;
    const end = this.contractEndDate(r).getTime();
    return end >= now && end <= now + window;
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  get totalCount()              { return this.records.length; }
  get contractSentCount()       { return this.records.filter(r => r.contractStatus === 'Contract Sent').length; }
  get signedCount()             { return this.records.filter(r => ['Contract Signed', 'Contract Terminated'].includes(r.contractStatus)).length; }
  get unsignedCount()           { return this.records.filter(r => ['Contract Sent', 'Renewal In Progress'].includes(r.contractStatus)).length; }
  get activeCount()             { return this.records.filter(r => r.contractStatus === 'Contract Signed' && !this.isAboutToExpire(r)).length; }
  get aboutToExpireCount()      { return this.records.filter(r => this.isAboutToExpire(r)).length; }
  get inactiveCount()           { return this.records.filter(r => r.contractStatus === 'Contract Terminated').length; }
  get terminatedCount()         { return this.records.filter(r => r.contractStatus === 'Contract Terminated').length; }
  get renewalEmailSentCount()   { return this.records.filter(r => r.contractStatus === 'Renewal In Progress').length; }
  get pendingWithUniteCount()   { return this.records.filter(r => r.contractStatus === 'Renewal In Progress').length; }
  get pendingWithCustomerCount(){ return this.records.filter(r => r.contractStatus === 'Contract Sent').length; }

  setMetricFilter(filter: string): void {
    this.activeMetricFilter = this.activeMetricFilter === filter ? 'all' : filter;
    this.applyFilter();
  }

  ngOnInit(): void {
    this.seedRecords();
    this.seedContractHistory();
    this.restoreFilters();
    this.applyFilter();
  }

  private restoreFilters(): void {
    const s = this.fp.load<Record<string, unknown>>('contracts');
    if (!s) return;
    this.searchQuery        = (s['searchQuery']        as string)  ?? this.searchQuery;
    this.selectedStatuses   = (s['selectedStatuses']   as any[])   ?? this.selectedStatuses;
    this.selectedDateFilters= (s['selectedDateFilters']as string[]) ?? this.selectedDateFilters;
    this.dateRangeFilter    = (s['dateRangeFilter']    as any)     ?? this.dateRangeFilter;
    this.activeMetricFilter = (s['activeMetricFilter'] as string)  ?? this.activeMetricFilter;
    this.activeTab          = (s['activeTab']          as any)     ?? this.activeTab;
    this.gridDensity        = (s['gridDensity']        as any)     ?? this.gridDensity;
  }

  seedRecords(): void {
    const DAY = 86_400_000;

    const seed: Array<{
      company: string; contact: string; email: string; mobile: string;
      status: ContractStatus; manager: string;
      sentDaysAgo: number; signedDaysAgo?: number;
    }> = [
      { company: 'CityCare Medical Clinic',   contact: 'Dr. Mohammed Al Futtaim', email: 'mo.futtaim@citycare.ae',     mobile: '+971 50 111 2233', status: 'Contract Signed',     manager: 'Ali Hassan',    sentDaysAgo: 30,  signedDaysAgo: 20  },
      { company: 'Wellness Dental Center',    contact: 'Dr. Sarah Al Rashid',     email: 's.rashid@wellnessdental.ae', mobile: '+971 55 222 3344', status: 'Contract Sent',       manager: 'Sara Mohammed', sentDaysAgo: 5   },
      { company: 'Apex Healthcare Group',     contact: 'Dr. Ahmed Hassan',        email: 'a.hassan@apexhealthcare.ae', mobile: '+971 54 333 4455', status: 'Contract Sent',       manager: 'John Smith',    sentDaysAgo: 7   },
      { company: 'Oasis Pediatric Clinic',    contact: 'Dr. Fatima Al Zaabi',     email: 'f.zaabi@oasispediatric.ae', mobile: '+971 56 444 5566', status: 'Contract Sent',       manager: 'Layla Ibrahim', sentDaysAgo: 2   },
      { company: 'Prime Physio Specialists',  contact: 'Dr. James Crawford',      email: 'j.crawford@primephysio.ae', mobile: '+971 50 555 6677', status: 'Contract Sent',       manager: 'Ali Hassan',    sentDaysAgo: 12  },
      { company: 'Luminous Eye Care Center',  contact: 'Dr. Nour Al Hamdan',      email: 'n.hamdan@luminouseye.ae',   mobile: '+971 55 666 7788', status: 'Renewal In Progress', manager: 'Sara Mohammed', sentDaysAgo: 410, signedDaysAgo: 390 },
      { company: 'Sunrise Family Clinic',     contact: 'Dr. Khalid Al Mansoori',  email: 'k.mansoori@sunrise.ae',     mobile: '+971 54 777 8899', status: 'Contract Terminated', manager: 'John Smith',    sentDaysAgo: 400, signedDaysAgo: 380 },
      { company: 'Emirates Dermatology Hub',  contact: 'Dr. Priya Sharma',        email: 'p.sharma@emiratesderm.ae',  mobile: '+971 56 888 9900', status: 'Contract Sent',       manager: 'Layla Ibrahim', sentDaysAgo: 3   },
      { company: 'Horizon Orthopedics',       contact: 'Dr. Omar Al Suwaidi',     email: 'o.suwaidi@horizonortho.ae', mobile: '+971 50 999 0011', status: 'Contract Sent',       manager: 'Ali Hassan',    sentDaysAgo: 9   },
      { company: 'Vitality Women Clinic',     contact: 'Dr. Chen Wei',            email: 'c.wei@vitalitywomen.ae',    mobile: '+971 55 100 2222', status: 'Contract Sent',       manager: 'Sara Mohammed', sentDaysAgo: 1   },
      { company: 'Harmony Psychiatry Center', contact: 'Dr. Isabella Ferrari',    email: 'i.ferrari@harmony.ae',      mobile: '+971 54 200 3333', status: 'Contract Sent',       manager: 'John Smith',    sentDaysAgo: 15  },
      { company: 'Nightingale Medical Group', contact: 'Dr. Rashid Al Nuaimi',    email: 'r.nuaimi@nightingale.ae',   mobile: '+971 56 300 4444', status: 'Contract Signed',     manager: 'Layla Ibrahim', sentDaysAgo: 340, signedDaysAgo: 325 },
    ];

    const planOptions = ['Basic', 'Basic Plus', 'Professional', 'Enterprise'];
    const vipIds = new Set([0, 2, 5, 8, 11]);
    const addOnList = [
      ['SMS Alerts', 'Custom Branding', 'WhatsApp Alerts', 'Advanced Reports'],
      ['Telehealth Pro', 'AI Scribe', 'Digital Forms', 'Lab Integration', 'Payment Gateway'],
      ['Advanced Analytics', 'Custom Branding', 'SMS Alerts', 'Telehealth Lite'],
      ['AI Scribe', 'WhatsApp Alerts', 'Custom Reports', 'Digital Consent', 'Lab Module'],
    ];

    this.records = seed.map((row, i) => ({
      id:              i + 1,
      companyName:     row.company,
      contactName:     row.contact,
      email:           row.email,
      mobile:          row.mobile,
      contractStatus:  row.status,
      contractRef:     `CTR-2025-${String(i + 101).padStart(4, '0')}`,
      contractSentOn:  new Date(Date.now() - row.sentDaysAgo * DAY),
      contractSignedOn: row.signedDaysAgo ? new Date(Date.now() - row.signedDaysAgo * DAY) : null,
      salesPerson:     row.manager,
      subscriptionPlan: planOptions[i % planOptions.length],
      clinicCount:     ((i * 3) % 7) + 1,
      activeUsers:     ((i * 12) % 45) + 5,
      boughtAddOns:      addOnList[i % addOnList.length],
      salesRepresentative: row.manager,
      isVip:               vipIds.has(i),
    }));
  }

  private seedContractHistory(): void {
    const DAY = 86_400_000;

    const past = (base: ContractRecord, yearOffset: number, refYear: string): ContractRecord => ({
      ...base,
      contractRef: `CTR-${refYear}-${base.contractRef.slice(-4)}`,
      contractStatus: 'Contract Signed',
      contractSentOn:   new Date(base.contractSentOn.getTime()   - yearOffset * 365 * DAY),
      contractSignedOn: new Date((base.contractSignedOn ?? base.contractSentOn).getTime() - yearOffset * 365 * DAY),
    });

    for (const r of this.records) {
      const history: ContractRecord[] = [{ ...r }];

      // Customers with at least one prior signed period
      if ([1, 6, 7, 12].includes(r.id)) {
        history.push(past(r, 1, '2024'));
      }
      // Longer-tenure customers get a second prior period
      if ([6, 7].includes(r.id)) {
        history.push(past(r, 2, '2023'));
      }

      if (history.length > 1) {
        this.contractHistoryMap.set(r.id, history);
      }
    }
  }

  // ── Tab helpers ────────────────────────────────────────────────────────────
  setTab(tab: ContractStatus | 'All'): void {
    this.activeTab = tab;
    this.applyFilter();
  }

  tabCount(tab: ContractStatus | 'All'): number {
    return tab === 'All' ? this.records.length : this.records.filter(r => r.contractStatus === tab).length;
  }

  matchDateFilters(dateToCheck: Date | string | null | undefined, selectedFilters: string[]): boolean {
    if (!selectedFilters || selectedFilters.length === 0) return true;
    if (!dateToCheck) return false;
    const d = new Date(dateToCheck);
    if (isNaN(d.getTime())) return false;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const recordYear = d.getFullYear();
    const recordMonth = d.getMonth();

    for (const filter of selectedFilters) {
      const norm = filter.toLowerCase().trim();
      if (norm === 'this month' || norm === 'mtd') {
        if (recordMonth === currentMonth && recordYear === currentYear) return true;
      } else if (norm === 'last month') {
        const lm = new Date(currentYear, currentMonth - 1, 1);
        if (recordMonth === lm.getMonth() && recordYear === lm.getFullYear()) return true;
      } else if (norm === 'this quarter') {
        const currentQ = Math.floor(currentMonth / 3);
        if (Math.floor(recordMonth / 3) === currentQ && recordYear === currentYear) return true;
      } else if (norm === 'last quarter') {
        const currentQuarter = Math.floor(currentMonth / 3);
        let targetQuarter = currentQuarter - 1;
        let targetYear = currentYear;
        if (targetQuarter < 0) {
          targetQuarter = 3;
          targetYear = currentYear - 1;
        }
        const recordQuarter = Math.floor(recordMonth / 3);
        if (recordQuarter === targetQuarter && recordYear === targetYear) return true;
      } else if (norm === 'last 6 months') {
        const sixAgo = new Date();
        sixAgo.setMonth(today.getMonth() - 6);
        if (d >= sixAgo && d <= today) return true;
      } else if (norm === 'last year') {
        if (recordYear === currentYear - 1) return true;
      } else if (norm === 'ytd') {
        if (recordYear === currentYear && d.getTime() <= today.getTime()) return true;
      } else if (norm === 'as of date') {
        if (d <= today) return true;
      }
    }
    return false;
  }

  get isFilterApplied(): boolean {
    return !!(
      this.searchQuery ||
      this.selectedStatuses.length > 0 ||
      this.selectedDateFilters.length > 0 ||
      this.dateRangeFilter.start ||
      this.dateRangeFilter.end ||
      this.activeMetricFilter !== 'all'
    );
  }

  clearAllFilters(): void {
    this.searchQuery        = '';
    this.selectedStatuses   = [];
    this.selectedDateFilters = [];
    this.dateRangeFilter    = { start: null, end: null };
    this.activeMetricFilter = 'all';
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

  bulkSendContracts(): void {
    const sendable = this.records.filter(r =>
      this.selectedKeys.includes(r.id) && this.canSend(r)
    );
    if (!sendable.length) {
      alert('Select one or more contracts pending customer signature to resend.');
      return;
    }
    
    sendable.forEach(r => {
      this.outboxService.addItem({
        companyName: r.companyName,
        contactName: r.contactName,
        email: r.email,
        channel: 'Email',
        category: 'Contract',
        actionType: 'Resend',
        reference: r.contractRef || 'N/A',
        originalRecordId: r.id,
        details: 'Bulk resending contract document to customer for review and signature.',
      });
    });

    alert(`${sendable.length} contract renewal request(s) queued to Outbox for Final Approval.`);
    this.selectedKeys = [];
  }

  applyFilter(): void {
    let filtered = this.records;

    // 1. Text Search
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(r =>
        (r.companyName  && r.companyName.toLowerCase().includes(query))  ||
        (r.contactName  && r.contactName.toLowerCase().includes(query))  ||
        (r.email        && r.email.toLowerCase().includes(query))        ||
        (r.contractRef  && r.contractRef.toLowerCase().includes(query))  ||
        (r.salesPerson  && r.salesPerson.toLowerCase().includes(query))
      );
    }

    // 2. Status MultiSelect
    if (this.selectedStatuses.length > 0) {
      filtered = filtered.filter(r => this.selectedStatuses.includes(r.contractStatus));
    }

    // 3. Date Dropdown Filter
    if (this.selectedDateFilters.length > 0) {
      filtered = filtered.filter(r => {
        const date = r.contractSentOn || r.contractSignedOn;
        return this.matchDateFilters(date, this.selectedDateFilters);
      });
    }

    // 4. Date Range Filter
    if (this.dateRangeFilter.start || this.dateRangeFilter.end) {
      filtered = filtered.filter(r => {
        const date = r.contractSentOn || r.contractSignedOn;
        if (!date) return false;
        const { start, end } = this.dateRangeFilter;
        if (start && end) return date >= start && date <= end;
        if (start)        return date >= start;
        if (end)          return date <= end;
        return true;
      });
    }

    // 5. Metric card filter
    if (this.activeMetricFilter !== 'all') {
      const mf  = this.activeMetricFilter;
      filtered = filtered.filter(r => {
        switch (mf) {
          case 'signed':
            return ['Contract Signed', 'Contract Terminated'].includes(r.contractStatus);
          case 'active':
            return r.contractStatus === 'Contract Signed' && !this.isAboutToExpire(r);
          case 'about-to-expire':
            return this.isAboutToExpire(r);
          case 'inactive':
            return r.contractStatus === 'Contract Terminated';
          case 'renewal-email-sent':
            return r.contractStatus === 'Renewal In Progress';
          case 'unsigned':
            return ['Contract Sent', 'Renewal In Progress'].includes(r.contractStatus);
          case 'pending-unite':
            return r.contractStatus === 'Renewal In Progress';
          case 'pending-customer':
            return r.contractStatus === 'Contract Sent';
          case 'contract-sent':
            return r.contractStatus === 'Contract Sent';
          case 'terminated':
            return r.contractStatus === 'Contract Terminated';
          default:
            return true;
        }
      });
    }

    this.filteredRecords = filtered;
    this.gridData = process(filtered, this.gridState) as { data: ContractRecord[]; total: number };
    this.fp.save('contracts', {
      searchQuery: this.searchQuery, selectedStatuses: this.selectedStatuses,
      selectedDateFilters: this.selectedDateFilters, dateRangeFilter: this.dateRangeFilter,
      activeMetricFilter: this.activeMetricFilter, activeTab: this.activeTab,
      gridDensity: this.gridDensity
    });
  }

  onStateChange(state: DataStateChangeEvent): void {
    this.gridState = state;
    this.applyFilter();
  }

  getDisplayStatus(r: ContractRecord): string {
    if (r.contractStatus === 'Contract Terminated') return 'Terminated';
    if (r.contractStatus === 'Contract Signed') {
      if (this.contractEndDate(r) < new Date()) return 'Expired';
      return this.isAboutToExpire(r) ? 'Nearing Expiry' : 'Valid';
    }
    if (r.contractStatus === 'Contract Sent')       return 'Pending with Customer';
    if (r.contractStatus === 'Renewal In Progress') return 'Renewal Email Sent';
    return '';
  }

  // ── Status helpers ─────────────────────────────────────────────────────────
  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'Valid':                 'cs-badge-success',
      'Pending with Customer': 'cs-badge-primary',
      'Nearing Expiry':        'cs-badge-warning',
      'Renewal Email Sent':    'cs-badge-purple',
      'Terminated':            'cs-badge-danger',
      'Expired':               'cs-badge-expired',
    };
    return map[status] ?? 'cs-badge-neutral';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'Valid':                 'fas fa-signature',
      'Pending with Customer': 'fas fa-paper-plane',
      'Nearing Expiry':        'fas fa-clock',
      'Renewal Email Sent':    'fas fa-rotate-right',
      'Terminated':            'fas fa-times-circle',
      'Expired':               'fas fa-calendar-xmark',
    };
    return map[status] ?? 'fas fa-file';
  }

  getHistoryCount(r: ContractRecord): number {
    return this.contractHistoryMap.get(r.id)?.length ?? 1;
  }

  canSend(r: ContractRecord): boolean {
    return r.contractStatus === 'Contract Sent';
  }

  // ── Send Contract Dialog ───────────────────────────────────────────────────
  openSendDialog(record: ContractRecord): void {
    this.selectedRecord = record;
    this.sendDialogOpen = true;
    this.ks.register('contracts-dialog', {
      'Escape': () => this.closeSendDialog(),
      'Enter':  () => { if (this.selectedRecord) this.confirmSend(); },
    });
  }

  closeSendDialog(): void {
    this.sendDialogOpen = false;
    this.selectedRecord = null;
    this.ks.deregister('contracts-dialog');
  }

  confirmSend(): void {
    if (!this.selectedRecord) return;
    this.outboxService.addItem({
      companyName: this.selectedRecord.companyName,
      contactName: this.selectedRecord.contactName,
      email: this.selectedRecord.email,
      channel: 'Email',
      category: 'Contract',
      actionType: 'Send',
      reference: this.selectedRecord.contractRef,
      originalRecordId: this.selectedRecord.id,
      originalPatch: { contractSentOn: new Date() },
      details: 'Dispatched contract document for customer signature and review.'
    });
    alert(`Contract dispatch request for ${this.selectedRecord.companyName} queued to Outbox for Final Approval.`);
    this.closeSendDialog();
  }

  private _patch(id: number, patch: Partial<ContractRecord>): void {
    const rec = this.records.find(r => r.id === id);
    if (rec) { Object.assign(rec, patch); this.applyFilter(); }
  }
}
