import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
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

export type ContractStatus =
  | 'Draft'
  | 'Amendments Added'
  | 'Ready'
  | 'Contract Sent'
  | 'Contract Signed'
  | 'Contract Terminated'
  | 'Contract Expired';

export interface Amendment {
  id: number;
  description: string;
  author: string;
  addedOn: Date;
}

export interface ContractRecord {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  mobile: string;
  contractStatus: ContractStatus;
  approach: 1 | 2;
  amendments: Amendment[];
  contractRef: string;
  contractSentOn: Date | null;
  contractSignedOn: Date | null;
  salesPerson: string;
  subscriptionPaid: boolean;
  overrideJustification?: string;
  subscriptionPlan?: string;
  clinicCount?: number;
  activeUsers?: number;
  boughtAddOns?: string[];
  salesRepresentative?: string;
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
  ],
  templateUrl: './contracts.component.html',
  styleUrls: ['./contracts.component.scss'],
})
export class ContractsComponent implements OnInit {

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

  gridState: State = { skip: 0, take: 10, sort: [] };
  selectableSettings: SelectableSettings = { checkboxOnly: true, mode: 'multiple' };
  selectedKeys: number[] = [];

  // ── Search & Filter State ──────────────────────────────────────────────────
  searchQuery: string = '';
  selectedStatuses: ContractStatus[] = [];
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

  readonly availableStatuses: ContractStatus[] = [
    'Draft',
    'Amendments Added',
    'Ready',
    'Contract Sent',
    'Contract Signed',
    'Contract Terminated',
    'Contract Expired'
  ];

  // ── Status Tabs ────────────────────────────────────────────────────────────
  readonly statusTabs: { id: ContractStatus | 'All'; label: string }[] = [
    { id: 'All',                label: 'All'            },
    { id: 'Draft',              label: 'Draft'          },
    { id: 'Amendments Added',   label: 'Amendments'     },
    { id: 'Ready',              label: 'Ready to Send'  },
    { id: 'Contract Sent',      label: 'Sent'           },
    { id: 'Contract Signed',    label: 'Signed'         },
    { id: 'Contract Terminated',label: 'Terminated'     },
    { id: 'Contract Expired',   label: 'Expired'        },
  ];
  activeTab: ContractStatus | 'All' = 'All';

  // ── Dialog State ───────────────────────────────────────────────────────────
  sendDialogOpen       = false;
  amendDialogOpen      = false;
  detailDialogOpen     = false;
  selectedRecord: ContractRecord | null = null;

  // Send dialog
  selectedApproach: 1 | 2 = 1;
  overrideJustification   = '';
  disclaimerAcknowledged  = false;

  // Add amendment
  newAmendDesc  = '';
  newAmendAuthor = 'Ali Hassan';

  // ── Contract Preview Panel ──────────────────────────────────────────────────
  contractPanelOpen = false;
  contractPanelRecord: ContractRecord | null = null;

  openContractPanel(record: ContractRecord): void {
    this.contractPanelRecord = { ...record };
    this.contractPanelOpen   = true;
  }

  closeContractPanel(): void {
    this.contractPanelOpen   = false;
    this.contractPanelRecord = null;
    this.panelClosed.emit();
  }

  contractStartDate(r: ContractRecord): Date {
    return r.contractSentOn ?? new Date();
  }

  contractEndDate(r: ContractRecord): Date {
    return new Date(this.contractStartDate(r).getTime() + 365 * 86_400_000);
  }

  contractAnnualValue(r: ContractRecord): string {
    return `AED ${45 + r.id * 2},000`;
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  get draftCount()      { return this.records.filter(r => r.contractStatus === 'Draft').length; }
  get readyCount()      { return this.records.filter(r => r.contractStatus === 'Ready').length; }
  get sentCount()       { return this.records.filter(r => r.contractStatus === 'Contract Sent').length; }
  get signedCount()     { return this.records.filter(r => r.contractStatus === 'Contract Signed').length; }
  get amendedCount()    { return this.records.filter(r => r.contractStatus === 'Amendments Added').length; }

  ngOnInit(): void {
    this.seedRecords();
    this.applyFilter();
  }

  seedRecords(): void {
    const DAY = 86_400_000;

    const baseAmendments: Amendment[] = [
      { id: 1, description: 'Custom pricing: 15% discount on annual subscription', author: 'Ali Hassan', addedOn: new Date('2025-04-12') },
      { id: 2, description: 'SLA: Response time reduced to 4 hours for critical issues', author: 'Sara Mohammed', addedOn: new Date('2025-04-14') },
    ];

    const seed: Array<{
      company: string; contact: string; email: string; mobile: string;
      status: ContractStatus; approach: 1 | 2; manager: string;
      paid: boolean; amendments: Amendment[];
      sentDaysAgo?: number; signedDaysAgo?: number;
      overrideJustification?: string;
    }> = [
      { company: 'CityCare Medical Clinic',    contact: 'Dr. Mohammed Al Futtaim', email: 'mo.futtaim@citycare.ae',     mobile: '+971 50 111 2233', status: 'Contract Signed',    approach: 1, manager: 'Ali Hassan',    paid: true,  amendments: baseAmendments, sentDaysAgo: 30, signedDaysAgo: 20 },
      { company: 'Wellness Dental Center',     contact: 'Dr. Sarah Al Rashid',     email: 's.rashid@wellnessdental.ae', mobile: '+971 55 222 3344', status: 'Contract Sent',      approach: 1, manager: 'Sara Mohammed', paid: true,  amendments: [baseAmendments[0]], sentDaysAgo: 5 },
      { company: 'Apex Healthcare Group',      contact: 'Dr. Ahmed Hassan',        email: 'a.hassan@apexhealthcare.ae', mobile: '+971 54 333 4455', status: 'Ready',              approach: 1, manager: 'John Smith',    paid: true,  amendments: baseAmendments },
      { company: 'Oasis Pediatric Clinic',     contact: 'Dr. Fatima Al Zaabi',     email: 'f.zaabi@oasispediatric.ae', mobile: '+971 56 444 5566', status: 'Amendments Added',   approach: 2, manager: 'Layla Ibrahim', paid: false, amendments: [baseAmendments[1]] },
      { company: 'Prime Physio Specialists',   contact: 'Dr. James Crawford',      email: 'j.crawford@primephysio.ae', mobile: '+971 50 555 6677', status: 'Draft',              approach: 1, manager: 'Ali Hassan',    paid: false, amendments: [] },
      { company: 'Luminous Eye Care Center',   contact: 'Dr. Nour Al Hamdan',      email: 'n.hamdan@luminouseye.ae',   mobile: '+971 55 666 7788', status: 'Contract Signed',    approach: 1, manager: 'Sara Mohammed', paid: true,  amendments: baseAmendments, sentDaysAgo: 60, signedDaysAgo: 45 },
      { company: 'Sunrise Family Clinic',      contact: 'Dr. Khalid Al Mansoori',  email: 'k.mansoori@sunrise.ae',     mobile: '+971 54 777 8899', status: 'Contract Terminated',approach: 1, manager: 'John Smith',    paid: true,  amendments: [] },
      { company: 'Emirates Dermatology Hub',   contact: 'Dr. Priya Sharma',        email: 'p.sharma@emiratesderm.ae',  mobile: '+971 56 888 9900', status: 'Contract Sent',      approach: 2, manager: 'Layla Ibrahim', paid: false, amendments: [baseAmendments[0]], sentDaysAgo: 3, overrideJustification: 'Senior management approval. Customer is a strategic partner.' },
      { company: 'Horizon Orthopedics',        contact: 'Dr. Omar Al Suwaidi',     email: 'o.suwaidi@horizonortho.ae', mobile: '+971 50 999 0011', status: 'Ready',              approach: 1, manager: 'Ali Hassan',    paid: true,  amendments: [] },
      { company: 'Vitality Women Clinic',      contact: 'Dr. Chen Wei',            email: 'c.wei@vitalitywomen.ae',    mobile: '+971 55 100 2222', status: 'Draft',              approach: 1, manager: 'Sara Mohammed', paid: false, amendments: [] },
      { company: 'Harmony Psychiatry Center',  contact: 'Dr. Isabella Ferrari',    email: 'i.ferrari@harmony.ae',      mobile: '+971 54 200 3333', status: 'Amendments Added',   approach: 1, manager: 'John Smith',    paid: true,  amendments: baseAmendments },
      { company: 'Nightingale Medical Group',  contact: 'Dr. Rashid Al Nuaimi',    email: 'r.nuaimi@nightingale.ae',   mobile: '+971 56 300 4444', status: 'Contract Signed',    approach: 1, manager: 'Layla Ibrahim', paid: true,  amendments: [baseAmendments[0]], sentDaysAgo: 90, signedDaysAgo: 75 },
    ];

    const planOptions = ['Standard Health Plan', 'Premium Care Hub', 'Elite Medical Enterprise'];
    const addOnList = [['SMS Alerts', 'Custom Branding'], ['Telehealth Pro', 'AI Scribe'], ['Advanced Analytics']];

    this.records = seed.map((row, i) => ({
      id:                i + 1,
      companyName:       row.company,
      contactName:       row.contact,
      email:             row.email,
      mobile:            row.mobile,
      contractStatus:    row.status,
      approach:          row.approach,
      amendments:        row.amendments,
      contractRef:       `CTR-2025-${String(i + 101).padStart(4, '0')}`,
      contractSentOn:    row.sentDaysAgo   ? new Date(Date.now() - row.sentDaysAgo   * DAY) : null,
      contractSignedOn:  row.signedDaysAgo ? new Date(Date.now() - row.signedDaysAgo * DAY) : null,
      salesPerson:       row.manager,
      subscriptionPaid:  row.paid,
      overrideJustification: (row as any).overrideJustification,
      subscriptionPlan:  planOptions[i % planOptions.length],
      clinicCount:       ((i * 3) % 7) + 1,
      activeUsers:       ((i * 12) % 45) + 5,
      boughtAddOns:      addOnList[i % addOnList.length],
      salesRepresentative: row.manager,
    }));
  }

  // ── Tab helpers ────────────────────────────────────────────────────────────
  setTab(tab: ContractStatus | 'All'): void {
    this.activeTab = tab;
    this.gridState = { ...this.gridState, skip: 0 };
    this.applyFilter();
  }

  tabCount(tab: ContractStatus | 'All'): number {
    return tab === 'All' ? this.records.length : this.records.filter(r => r.contractStatus === tab).length;
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
        (r.email && r.email.toLowerCase().includes(query)) ||
        (r.contractRef && r.contractRef.toLowerCase().includes(query)) ||
        (r.salesPerson && r.salesPerson.toLowerCase().includes(query))
      );
    }

    // 2. Status MultiSelect Filter
    if (this.selectedStatuses && this.selectedStatuses.length > 0) {
      filtered = filtered.filter(r => this.selectedStatuses.includes(r.contractStatus));
    }

    // 3. Date / Month Dropdown Filter
    if (this.selectedDateFilters && this.selectedDateFilters.length > 0) {
      filtered = filtered.filter(r => {
        const date = r.contractSentOn || r.contractSignedOn;
        return this.matchDateFilters(date, this.selectedDateFilters);
      });
    }

    this.gridData = process(filtered, this.gridState) as { data: ContractRecord[]; total: number };
  }

  onStateChange(state: DataStateChangeEvent): void {
    this.gridState = state;
    this.applyFilter();
  }

  // ── Status helpers ─────────────────────────────────────────────────────────
  getStatusClass(status: ContractStatus): string {
    const map: Record<ContractStatus, string> = {
      'Draft':               'cs-badge-neutral',
      'Amendments Added':    'cs-badge-info',
      'Ready':               'cs-badge-warning',
      'Contract Sent':       'cs-badge-primary',
      'Contract Signed':     'cs-badge-success',
      'Contract Terminated': 'cs-badge-danger',
      'Contract Expired':    'cs-badge-expired',
    };
    return map[status] ?? 'cs-badge-neutral';
  }

  getStatusIcon(status: ContractStatus): string {
    const map: Record<ContractStatus, string> = {
      'Draft':               'fas fa-file',
      'Amendments Added':    'fas fa-edit',
      'Ready':               'fas fa-check',
      'Contract Sent':       'fas fa-paper-plane',
      'Contract Signed':     'fas fa-signature',
      'Contract Terminated': 'fas fa-times-circle',
      'Contract Expired':    'fas fa-calendar-times',
    };
    return map[status] ?? 'fas fa-file';
  }

  canSend(r: ContractRecord): boolean {
    return ['Draft', 'Amendments Added', 'Ready'].includes(r.contractStatus);
  }

  canAddAmendment(r: ContractRecord): boolean {
    return ['Draft', 'Amendments Added', 'Ready'].includes(r.contractStatus);
  }

  // ── Lifecycle steps ────────────────────────────────────────────────────────
  readonly lifecycleSteps: ContractStatus[] = ['Draft', 'Ready', 'Contract Sent', 'Contract Signed'];

  isStepDone(record: ContractRecord, step: ContractStatus): boolean {
    const order = this.lifecycleSteps;
    const current = order.indexOf(record.contractStatus);
    const target  = order.indexOf(step);
    return target < current;
  }

  isStepActive(record: ContractRecord, step: ContractStatus): boolean {
    return record.contractStatus === step;
  }

  // ── Send Contract Dialog ───────────────────────────────────────────────────
  openSendDialog(record: ContractRecord): void {
    this.selectedRecord          = record;
    this.selectedApproach        = record.subscriptionPaid ? 1 : 2;
    this.overrideJustification   = '';
    this.disclaimerAcknowledged  = false;
    this.sendDialogOpen          = true;
  }

  closeSendDialog(): void {
    this.sendDialogOpen  = false;
    this.selectedRecord  = null;
  }

  confirmSend(): void {
    if (!this.selectedRecord) { return; }
    if (this.selectedApproach === 2 && !this.disclaimerAcknowledged) { return; }

    this._patch(this.selectedRecord.id, {
      contractStatus:       'Contract Sent',
      approach:             this.selectedApproach,
      contractSentOn:       new Date(),
      overrideJustification: this.selectedApproach === 2 ? this.overrideJustification : undefined,
    });
    this.closeSendDialog();
  }

  // ── Amendment Panel ────────────────────────────────────────────────────────
  amendPanelActiveIdx = 0;

  openAmendDialog(record: ContractRecord): void {
    this.selectedRecord      = { ...record, amendments: [...record.amendments] };
    this.newAmendDesc        = '';
    this.amendPanelActiveIdx = 0;
    this.amendDialogOpen     = true;
  }

  closeAmendDialog(): void {
    this.amendDialogOpen = false;
    this.selectedRecord  = null;
    this.newAmendDesc    = '';
  }

  addAmendment(): void {
    if (!this.newAmendDesc.trim() || !this.selectedRecord) { return; }
    const newA: Amendment = {
      id:          Date.now(),
      description: this.newAmendDesc,
      author:      this.newAmendAuthor,
      addedOn:     new Date(),
    };
    const rec = this.records.find(r => r.id === this.selectedRecord!.id);
    if (rec) {
      rec.amendments = [...rec.amendments, newA];
      if (rec.contractStatus === 'Draft') { rec.contractStatus = 'Amendments Added'; }
      this.applyFilter();
    }
    this.newAmendDesc = '';
    this.selectedRecord = rec ? { ...rec, amendments: [...rec.amendments] } : null;
    this.amendPanelActiveIdx = (this.selectedRecord?.amendments.length ?? 1) - 1;
  }

  private _patch(id: number, patch: Partial<ContractRecord>): void {
    const rec = this.records.find(r => r.id === id);
    if (rec) { Object.assign(rec, patch); this.applyFilter(); }
  }
}
