import { Component, OnInit, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { DatePipe } from '@angular/common';
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
import { PopupModule } from '@progress/kendo-angular-popup';
import { KycReviewPanelComponent } from '../shared/kyc-review-panel/kyc-review-panel';
import { KycFormbuilderComponent } from '../shared/kyc-formbuilder/kyc-formbuilder.component';
import { KycMigrateExcelComponent } from '../shared/kyc-migrate-excel/kyc-migrate-excel.component';
import { FilterPersistenceService } from '../shared/filter-persistence.service';
import { KeyboardShortcutService } from '../shared/keyboard-shortcut.service';
import { process, State } from '@progress/kendo-data-query';
import { OutboxService } from '../shared/outbox.service';
import { OutboxReviewPanelComponent } from '../shared/outbox-review-panel/outbox-review-panel';

export type KycStatus =
  | 'KYC Pending'
  | 'KYC Form Sent'
  | 'KYC Submitted'
  | 'Under Review'
  | 'KYC Approved'
  | 'KYC Rejected'
  | 'Re-submission'
  | 'KYC Expired';

export interface KycDocument {
  name: string;
  fileType: string;
  uploadedOn: Date;
  icon: string;
  verified: boolean;
}

export interface KycRecord {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  mobile: string;
  status: KycStatus;
  kycFormSentOn: Date | null;
  kycSubmittedOn: Date | null;
  kycExpiryDate: Date | null;
  salesPerson: string;
  documents: KycDocument[];
  reviewNotes: string;
  rejectionReason?: string;
  goLiveReadiness?: 'go-live' | 'yet-to-go-live';
  
  // KYC Form Template Fields
  tradeLicenseNumber: string;
  tradeLicenseExpiry: Date | null;
  tradeLicenseAuthority: string;
  vatTrnNumber: string;
  registeredAddress: string;

  // Contact Persons (POCs)
  signatoryDesignation: string;
  signatoryEmail: string;
  signatoryPhone: string;
  signatoryRemarks?: string;

  implementationName: string;
  implementationEmail: string;
  implementationPhone: string;

  operationsName: string;
  operationsEmail: string;
  operationsPhone: string;

  accountsName: string;
  accountsEmail: string;
  accountsPhone: string;

  complianceName: string;
  complianceEmail: string;
  compliancePhone: string;

  // Document Uploads
  fileDhaLicense: string;
  fileTradeLicense: string;
  fileVatCertificate?: string;

  // Legacy fields kept for backward compatibility
  dhaLicenseNumber?: string;
  emirate?: string;
  website?: string;
  fileEmiratiesId?: string;
  filePassport?: string;
  fileSignatureProof?: string;

  kycType?: 'new' | 'renewal';
  fieldErrors?: Partial<Record<string, string>>;
  fieldErrorsHistory?: Partial<Record<string, Array<{
    timestamp: Date;
    reviewerComment: string;
    correctedValue?: string;
  }>>>;
  resubmissionHistory?: ResubmissionHistoryEntry[];
}

export interface ResubmissionHistoryEntry {
  personName: string;
  timestamp: Date;
  action: string;
  comments: string;
}

@Component({
  selector: 'app-kyc-verification',
  standalone: true,
  imports: [
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
    PopupModule,
    KycReviewPanelComponent,
    KycFormbuilderComponent,
    KycMigrateExcelComponent,
    OutboxReviewPanelComponent,
  ],
  templateUrl: './kyc-verification.component.html',
  styleUrls: ['./kyc-verification.component.scss'],
})
export class KycVerificationComponent implements OnInit {

  // ── Re-Submission History Popover State ─────────────────────────────────────
  showResubHistory = false;
  activeResubRecord: KycRecord | null = null;
  activeResubAnchor?: any;

  @Input() set initialFilter(status: string | null) {
    if (status) this.selectedStatuses = [status as KycStatus];
  }

  @Input() set openRecordId(id: number | null) {
    if (id != null) {
      setTimeout(() => {
        const record = this.records.find(r => r.id === id);
        if (record) {
          this.openReviewPanel(record);
        }
      }, 100);
    }
  }
  @Output() panelClosed = new EventEmitter<void>();

  constructor(
    private outboxService: OutboxService,
    private fp: FilterPersistenceService,
    private ks: KeyboardShortcutService
  ) {}

  // ── Grid State ─────────────────────────────────────────────────────────────
  records: KycRecord[] = [];
  pageFilteredRecords: KycRecord[] = [];
  gridData: { data: KycRecord[]; total: number } = { data: [], total: 0 };

  gridState: State = {
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  selectableSettings: SelectableSettings = { checkboxOnly: true, mode: 'multiple' };
  selectedKeys: number[] = [];
  outboxReviewOpen = false;

  // ── Search & Filter State ──────────────────────────────────────────────────
  searchQuery: string = '';
  selectedStatuses: KycStatus[] = [];
  selectedDateFilters: string[] = [];
  activeMetricFilter: string | null = null;
  inProgressGoLiveFilter: 'all' | 'go-live' | 'yet-to-go-live' = 'all';

  setMetricFilter(filter: string): void {
    if (this.activeMetricFilter === filter) {
      this.activeMetricFilter = null;
    } else {
      this.activeMetricFilter = filter;
    }
    this.applyFilter();
  }

  dateRangeFilter: { start: Date | null, end: Date | null } = { start: null, end: null };

  readonly dateFilterOptions: string[] = [
    'MTD',
    'Last Month',
    'Last Quarter',
    'Last 6 Months',
    'YTD',
    'As of Date'
  ];

  readonly availableStatuses: KycStatus[] = [
    'KYC Pending',
    'KYC Form Sent',
    'KYC Submitted',
    'Under Review',
    'KYC Approved',
    'KYC Rejected',
    'Re-submission',
    'KYC Expired'
  ];

  // ── Status filter tabs ─────────────────────────────────────────────────────
  readonly statusTabs: { id: KycStatus | 'All'; label: string }[] = [
    { id: 'All',           label: 'All' },
    { id: 'KYC Submitted', label: 'Submitted' },
    { id: 'Under Review',  label: 'Under Review' },
    { id: 'KYC Approved',  label: 'Approved' },
    { id: 'KYC Rejected',  label: 'Rejected' },
    { id: 'Re-submission', label: 'Re-submission' },
    { id: 'KYC Expired',   label: 'Expired' },
  ];
  activeTab: KycStatus | 'All' = 'All';

  // ── Grid Density ──────────────────────────────────────────────────────────
  gridDensity: 'comfortable' | 'compact' = 'comfortable';

  toggleDensity(): void {
    this.gridDensity = this.gridDensity === 'compact' ? 'comfortable' : 'compact';
    this.fp.save('kyc', {
      searchQuery: this.searchQuery, selectedStatuses: this.selectedStatuses,
      selectedDateFilters: this.selectedDateFilters, dateRangeFilter: this.dateRangeFilter,
      activeMetricFilter: this.activeMetricFilter, inProgressGoLiveFilter: this.inProgressGoLiveFilter,
      activeTab: this.activeTab, gridDensity: this.gridDensity
    });
  }

  // ── Form Builder ──────────────────────────────────────────────────────────
  builderSlideOpen = false;

  // ── Migrate from Excel ────────────────────────────────────────────────────
  migrateSlideOpen = false;

  // ── Dialog state ───────────────────────────────────────────────────────────
  reviewPanelOpen = false;
  selectedRecord: KycRecord | null = null;
  filteredRecords: KycRecord[] = [];
  panelIndex = 0;
  reviewerNotes   = '';
  rejectionReason = '';
  showRejectForm  = false;

  // ── Bulk actions ───────────────────────────────────────────────────────────
  get selectedSendableCount(): number {
    return this.records.filter(r =>
      this.selectedKeys.includes(r.id) &&
      (r.status === 'KYC Expired' || this.isExpiringSoon(r))
    ).length;
  }

  /** Count of all currently selected rows — drives the Send KYC button badge. */
  get selectedKycCount(): number {
    return this.selectedKeys.length;
  }

  /** Queue all selected records into the outbox for approval before dispatch. */
  bulkSendKyc(): void {
    const targets = this.records.filter(r => this.selectedKeys.includes(r.id));
    if (!targets.length) return;

    targets.forEach(r => {
      const actionType = r.status === 'KYC Pending' ? 'Send' : 'Resend';
      this.outboxService.addItem({
        companyName:      r.companyName,
        contactName:      r.contactName,
        email:            r.email,
        channel:          'Email',
        category:         'KYC',
        actionType,
        reference:        r.tradeLicenseNumber || `KYC-${r.id}`,
        originalRecordId: r.id,
        details:          `KYC ${actionType === 'Send' ? 'initial send' : 'resend'} queued for ${r.companyName}. Status at dispatch: ${r.status}.`,
      });
    });

    this.selectedKeys = [];
  }

  ngOnInit(): void {
    this.seedRecords();
    this.restoreFilters();
    this.applyFilter();
  }

  private restoreFilters(): void {
    const s = this.fp.load<Record<string, unknown>>('kyc');
    if (!s) return;
    this.searchQuery          = (s['searchQuery']          as string)  ?? this.searchQuery;
    this.selectedStatuses     = (s['selectedStatuses']     as any[])   ?? this.selectedStatuses;
    this.selectedDateFilters  = (s['selectedDateFilters']  as string[]) ?? this.selectedDateFilters;
    this.dateRangeFilter      = (s['dateRangeFilter']      as any)     ?? this.dateRangeFilter;
    this.activeMetricFilter   = (s['activeMetricFilter']   as string)  ?? this.activeMetricFilter;
    this.inProgressGoLiveFilter = (s['inProgressGoLiveFilter'] as any) ?? this.inProgressGoLiveFilter;
    this.activeTab            = (s['activeTab']            as any)     ?? this.activeTab;
    this.gridDensity          = (s['gridDensity']          as any)     ?? this.gridDensity;
  }

  seedRecords(): void {
    const DAY = 86_400_000;
    const docs: KycDocument[] = [
      { name: 'Medical Practice License',      fileType: 'PDF', uploadedOn: new Date('2025-04-10'), icon: 'fas fa-file-medical', verified: true  },
      { name: 'Health Authority Registration', fileType: 'PDF', uploadedOn: new Date('2025-04-09'), icon: 'fas fa-hospital',     verified: true  },
      { name: 'Doctor ID / Passport',          fileType: 'PDF', uploadedOn: new Date('2025-04-08'), icon: 'fas fa-user-md',      verified: false },
      { name: 'Facility Operating License',    fileType: 'JPG', uploadedOn: new Date('2025-04-07'), icon: 'fas fa-certificate',  verified: false },
    ];

    type SeedRow = {
      company: string; contact: string; email: string; mobile: string;
      status: KycStatus; manager: string; tlNum: string; tlExp: Date;
      dhaNum: string; vat: string; emirate: string; web: string; addr: string;
      desig: string; sigEmail: string; eid: string; passport: string; sigProof: string;
      expiryDays?: number; rejectionReason?: string; fieldErrors?: Partial<Record<string, string>>;
      goLiveReadiness?: 'go-live' | 'yet-to-go-live';
      kycType?: 'new' | 'renewal';
    };

    const seed: SeedRow[] = [
      // ── KYC Approved — far expiry (16) ──────────────────────────────────────
      { company: 'Al Zahra Medical Centre',               contact: 'Dr. Fatima Al Mansouri',   email: 'info@alzahra.ae',               mobile: '+971 4 331 2345', status: 'KYC Approved' as KycStatus, manager: 'Ali Hassan',      tlNum: 'TL-2025-100001', tlExp: new Date('2026-08-31'), dhaNum: 'DHA-MC-20251101', vat: '100100001200003', emirate: 'Dubai',          web: 'www.alzahra.ae',            addr: 'Al Zahra Bldg, Al Barsha, Dubai, UAE',                          desig: 'Director',               sigEmail: 'f.mansouri@alzahra.ae',          eid: 'eid_fatima_m.pdf',      passport: 'pp_fatima_m.pdf',     sigProof: 'board_alzahra.pdf'       },
      { company: 'Mediclinic City Hospital',              contact: 'Dr. Samer Fouad',          email: 'info@mediclinic.ae',            mobile: '+971 4 435 9999', status: 'KYC Approved' as KycStatus, manager: 'Sara Mohammed',   tlNum: 'TL-2025-100002', tlExp: new Date('2026-09-30'), dhaNum: 'DHA-MC-20251102', vat: '100100002200003', emirate: 'Dubai',          web: 'www.mediclinic.ae',         addr: 'Healthcare City Phase 2, Dubai, UAE',                           desig: 'Medical Director',  sigEmail: 's.fouad@mediclinic.ae',          eid: 'eid_samer.pdf',         passport: 'pp_samer.pdf',        sigProof: 'authority_samer.pdf'     },
      { company: 'Saudi German Hospital Dubai',           contact: 'Dr. Ibrahim Al Hajj',      email: 'info@sghgroup.ae',              mobile: '+971 4 444 5664', status: 'KYC Approved' as KycStatus, manager: 'John Smith',      tlNum: 'TL-2025-100003', tlExp: new Date('2026-07-31'), dhaNum: 'DHA-GH-20251103', vat: '100100003200003', emirate: 'Dubai',          web: 'www.sghgroup.ae',           addr: 'Al Barsha South 3, Dubai, UAE',                                 desig: 'Managing Director', sigEmail: 'i.hajj@sghgroup.ae',             eid: 'eid_ibrahim.pdf',       passport: 'pp_ibrahim.pdf',      sigProof: 'moa_sgh.pdf'             },
      { company: 'American Hospital Dubai',               contact: 'Dr. Jennifer Williams',    email: 'info@ahdubai.com',              mobile: '+971 4 336 7777', status: 'KYC Approved' as KycStatus, manager: 'Layla Ibrahim',   tlNum: 'TL-2025-100004', tlExp: new Date('2026-10-31'), dhaNum: 'DHA-AH-20251104', vat: '100100004200003', emirate: 'Dubai',          web: 'www.ahdubai.com',           addr: '19th St, Oud Metha, Dubai, UAE',                                desig: 'Director',               sigEmail: 'j.williams@ahdubai.com',         eid: 'eid_jennifer.pdf',      passport: 'pp_jennifer.pdf',     sigProof: 'board_ahd.pdf'           },
      { company: 'Aster Clinic Bur Dubai',                contact: 'Dr. Ravi Krishnan',        email: 'info@asterclinic.ae',           mobile: '+971 4 440 7700', status: 'KYC Approved' as KycStatus, manager: 'Fatima Al Zaabi', tlNum: 'TL-2025-100005', tlExp: new Date('2026-05-31'), dhaNum: 'DHA-AC-20251105', vat: '100100005200003', emirate: 'Dubai',          web: 'www.asterclinic.ae',        addr: 'Khalid Bin Al Waleed Rd, Bur Dubai, UAE',                       desig: 'Director',          sigEmail: 'r.krishnan@aster.ae',            eid: 'eid_ravi.pdf',          passport: 'pp_ravi.pdf',         sigProof: 'dir_cert_aster.pdf'      },
      { company: 'NMC Royal Hospital',                    contact: 'Dr. Mohammed Al Kaabi',    email: 'info@nmcroyal.ae',              mobile: '+971 2 626 5555', status: 'KYC Approved' as KycStatus, manager: 'Ali Hassan',      tlNum: 'TL-2025-100006', tlExp: new Date('2026-06-30'), dhaNum: 'DHA-RH-20251106', vat: '100100006200003', emirate: 'Abu Dhabi',      web: 'www.nmcroyal.ae',           addr: 'Airport Road, Khalidiyah, Abu Dhabi, UAE',                      desig: 'Chairman',          sigEmail: 'm.kaabi@nmcroyal.ae',            eid: 'eid_mohammed_k.pdf',    passport: 'pp_mohammed_k.pdf',   sigProof: 'auth_nmc.pdf'            },
      { company: 'Emirates Hospital Jumeirah',            contact: 'Dr. Hana Al Shamsi',       email: 'info@emirateshospital.ae',      mobile: '+971 4 349 6666', status: 'KYC Approved' as KycStatus, manager: 'Sara Mohammed',   tlNum: 'TL-2025-100007', tlExp: new Date('2026-11-30'), dhaNum: 'DHA-EH-20251107', vat: '100100007200003', emirate: 'Dubai',          web: 'www.emirateshospital.ae',   addr: 'Jumeirah Beach Rd, Jumeirah, Dubai, UAE',                       desig: 'Medical Director',  sigEmail: 'h.shamsi@emirateshospital.ae',   eid: 'eid_hana.pdf',          passport: 'pp_hana.pdf',         sigProof: 'dir_proof_eh.pdf'        },
      { company: 'Prime Hospital Dubai',                  contact: 'Dr. Carlos Rodriguez',     email: 'info@primehospital.ae',         mobile: '+971 4 220 8000', status: 'KYC Approved' as KycStatus, manager: 'John Smith',      tlNum: 'TL-2025-100008', tlExp: new Date('2026-04-30'), dhaNum: 'DHA-PH-20251108', vat: '100100008200003', emirate: 'Dubai',          web: 'www.primehospital.ae',      addr: 'Al Nahda 2, Dubai, UAE',                                        desig: 'Director',               sigEmail: 'c.rodriguez@primehospital.ae',   eid: 'eid_carlos.pdf',        passport: 'pp_carlos.pdf',       sigProof: 'board_prime.pdf'         },
      { company: 'Burjeel Hospital Abu Dhabi',            contact: 'Dr. Yousuf Al Dhaheri',    email: 'info@burjeel.com',              mobile: '+971 2 508 5555', status: 'KYC Approved' as KycStatus, manager: 'Layla Ibrahim',   tlNum: 'TL-2025-100009', tlExp: new Date('2026-12-31'), dhaNum: 'DHA-BH-20251109', vat: '100100009200003', emirate: 'Abu Dhabi',      web: 'www.burjeel.com',           addr: 'Muroor Road, Abu Dhabi, UAE',                                   desig: 'Managing Director', sigEmail: 'y.dhaheri@burjeel.com',          eid: 'eid_yousuf.pdf',        passport: 'pp_yousuf.pdf',       sigProof: 'moa_burjeel.pdf'         },
      { company: 'LLH Hospital Abu Dhabi',                contact: 'Dr. Meera Nair',           email: 'info@llhhospital.ae',           mobile: '+971 2 633 3333', status: 'KYC Approved' as KycStatus, manager: 'Fatima Al Zaabi', tlNum: 'TL-2025-100010', tlExp: new Date('2026-03-31'), dhaNum: 'DHA-LH-20251110', vat: '100100010200003', emirate: 'Abu Dhabi',      web: 'www.llhhospital.ae',        addr: 'Al Nahyan Camp, Abu Dhabi, UAE',                                desig: 'Director',               sigEmail: 'm.nair@llhhospital.ae',          eid: 'eid_meera.pdf',         passport: 'pp_meera.pdf',        sigProof: 'authority_llh.pdf'       },
      { company: 'Al Noor Hospital Abu Dhabi',            contact: 'Dr. Waleed Al Muhairi',    email: 'info@alnoorhospital.ae',        mobile: '+971 2 626 5500', status: 'KYC Approved' as KycStatus, manager: 'Ali Hassan',      tlNum: 'TL-2025-100011', tlExp: new Date('2027-01-31'), dhaNum: 'DHA-NH-20251111', vat: '100100011200003', emirate: 'Abu Dhabi',      web: 'www.alnoorhospital.ae',     addr: 'Khalifa Street, Abu Dhabi, UAE',                                desig: 'Director',          sigEmail: 'w.muhairi@alnoorhospital.ae',    eid: 'eid_waleed.pdf',        passport: 'pp_waleed.pdf',       sigProof: 'dir_alnoor.pdf'          },
      { company: 'Zulekha Hospital Sharjah',              contact: 'Dr. Parveen Mirza',        email: 'info@zulekha.ae',               mobile: '+971 6 566 0006', status: 'KYC Approved' as KycStatus, manager: 'Sara Mohammed',   tlNum: 'TL-2025-100012', tlExp: new Date('2026-08-31'), dhaNum: 'DHA-ZH-20251112', vat: '100100012200003', emirate: 'Sharjah',        web: 'www.zulekha.ae',            addr: 'Al Qasimia, Sharjah, UAE',                                      desig: 'Medical Director',  sigEmail: 'p.mirza@zulekha.ae',             eid: 'eid_parveen.pdf',       passport: 'pp_parveen.pdf',      sigProof: 'dir_zulekha.pdf'         },
      { company: 'Gulf Medical Hospital Ajman',           contact: 'Dr. Thomas George',        email: 'info@gulfmedical.ae',           mobile: '+971 6 743 9999', status: 'KYC Approved' as KycStatus, manager: 'John Smith',      tlNum: 'TL-2025-100013', tlExp: new Date('2026-07-31'), dhaNum: 'DHA-GM-20251113', vat: '100100013200003', emirate: 'Ajman',          web: 'www.gulfmedical.ae',        addr: 'Medical Area, Ajman, UAE',                                      desig: 'Director',               sigEmail: 't.george@gulfmedical.ae',        eid: 'eid_thomas.pdf',        passport: 'pp_thomas.pdf',       sigProof: 'board_gulf.pdf'          },
      { company: 'University Hospital Sharjah',           contact: 'Dr. Ahmad Al Suwaidi',     email: 'info@uhs.ae',                   mobile: '+971 6 505 8000', status: 'KYC Approved' as KycStatus, manager: 'Layla Ibrahim',   tlNum: 'TL-2025-100014', tlExp: new Date('2026-06-30'), dhaNum: 'DHA-UH-20251114', vat: '100100014200003', emirate: 'Sharjah',        web: 'www.uhs.ae',                addr: 'University City, Sharjah, UAE',                                 desig: 'Managing Director', sigEmail: 'a.suwaidi@uhs.ae',               eid: 'eid_ahmad.pdf',         passport: 'pp_ahmad.pdf',        sigProof: 'moa_uhs.pdf'             },
      { company: 'RAK Hospital Ras Al Khaimah',           contact: 'Dr. Rashida Kamali',       email: 'info@rakhospital.ae',           mobile: '+971 7 207 4444', status: 'KYC Approved' as KycStatus, manager: 'Fatima Al Zaabi', tlNum: 'TL-2025-100015', tlExp: new Date('2026-09-30'), dhaNum: 'DHA-RK-20251115', vat: '100100015200003', emirate: 'Ras Al Khaimah', web: 'www.rakhospital.ae',        addr: 'Al Nakheel, Ras Al Khaimah, UAE',                               desig: 'Director',               sigEmail: 'r.kamali@rakhospital.ae',        eid: 'eid_rashida.pdf',       passport: 'pp_rashida.pdf',      sigProof: 'authority_rak.pdf'       },
      { company: 'Thumbay Hospital Ajman',                contact: 'Dr. Anil Kumar',           email: 'info@thumbay.com',              mobile: '+971 6 743 1111', status: 'KYC Approved' as KycStatus, manager: 'Ali Hassan',      tlNum: 'TL-2025-100016', tlExp: new Date('2026-05-31'), dhaNum: 'DHA-TH-20251116', vat: '100100016200003', emirate: 'Ajman',          web: 'www.thumbay.com',           addr: 'Thumbay Medical City, Ajman, UAE',                              desig: 'Director',          sigEmail: 'a.kumar@thumbay.com',            eid: 'eid_anil.pdf',          passport: 'pp_anil.pdf',         sigProof: 'dir_thumbay.pdf'         },
      // ── KYC Approved — expiring soon within 30 days (4) ────────────────────
      { company: 'Orchid Medical Centre',                 contact: 'Dr. Nadia Al Romaithi',    email: 'info@orchidmc.ae',              mobile: '+971 4 388 0011', status: 'KYC Approved' as KycStatus, manager: 'Sara Mohammed',   tlNum: 'TL-2022-200001', tlExp: new Date('2026-06-22'), dhaNum: 'DHA-OM-20251117', vat: '100200001200003', emirate: 'Dubai',          web: 'www.orchidmc.ae',           addr: 'Al Mankhool Rd, Bur Dubai, Dubai, UAE',                         desig: 'Medical Director',  sigEmail: 'n.romaithi@orchidmc.ae',         eid: 'eid_nadia.pdf',         passport: 'pp_nadia.pdf',        sigProof: 'auth_orchid.pdf',       expiryDays: 7,  kycType: 'renewal' },
      { company: 'Belhoul Speciality Hospital',           contact: 'Dr. Peter Johnson',        email: 'info@belhoul.ae',               mobile: '+971 4 345 6789', status: 'KYC Approved' as KycStatus, manager: 'John Smith',      tlNum: 'TL-2022-200002', tlExp: new Date('2026-06-22'), dhaNum: 'DHA-BS-20251118', vat: '100200002200003', emirate: 'Dubai',          web: 'www.belhoul.ae',            addr: 'Al Dhiyafah St, Satwa, Dubai, UAE',                             desig: 'Director',               sigEmail: 'p.johnson@belhoul.ae',           eid: 'eid_peter.pdf',         passport: 'pp_peter.pdf',        sigProof: 'board_belhoul.pdf',     expiryDays: 14, kycType: 'renewal' },
      { company: 'Al Garhoud Private Hospital',           contact: 'Dr. Aisha Al Falasi',      email: 'info@algarhoud.ae',             mobile: '+971 4 282 0000', status: 'KYC Approved' as KycStatus, manager: 'Layla Ibrahim',   tlNum: 'TL-2022-200003', tlExp: new Date('2026-06-22'), dhaNum: 'DHA-GP-20251119', vat: '100200003200003', emirate: 'Dubai',          web: 'www.algarhoud.ae',          addr: 'Al Garhoud, Dubai, UAE',                                        desig: 'Managing Director', sigEmail: 'a.falasi@algarhoud.ae',          eid: 'eid_aisha_f.pdf',       passport: 'pp_aisha_f.pdf',      sigProof: 'moa_garhoud.pdf',       expiryDays: 21, kycType: 'renewal' },
      { company: 'New Medical Centre Dubai',              contact: 'Dr. Khaled Al Mansouri',   email: 'info@nmc.ae',                   mobile: '+971 2 621 2000', status: 'KYC Approved' as KycStatus, manager: 'Fatima Al Zaabi', tlNum: 'TL-2022-200004', tlExp: new Date('2026-06-22'), dhaNum: 'DHA-NM-20251120', vat: '100200004200003', emirate: 'Abu Dhabi',      web: 'www.nmc.ae',                addr: 'Al Muroor Road, Abu Dhabi, UAE',                                desig: 'Chairman',          sigEmail: 'k.mansouri@nmc.ae',              eid: 'eid_khaled_m.pdf',      passport: 'pp_khaled_m.pdf',     sigProof: 'dir_nmc.pdf',           expiryDays: 28, kycType: 'renewal' },
      // ── KYC Form Sent (10) ───────────────────────────────────────────────────
      { company: 'Mediclinic Welcare Hospital',           contact: 'Dr. Omar Al Rashed',       email: 'info@welcare.ae',               mobile: '+971 4 282 7788', status: 'KYC Form Sent' as KycStatus, manager: 'Ali Hassan',      tlNum: 'TL-2025-300001', tlExp: new Date('2026-10-31'), dhaNum: 'DHA-WH-20251121', vat: '100300001200003', emirate: 'Dubai',          web: 'www.welcare.ae',            addr: 'Garhoud, Dubai, UAE',                                           desig: 'Director',               sigEmail: 'o.rashed@welcare.ae',            eid: '',                      passport: '',                    sigProof: '', goLiveReadiness: 'go-live' },
      { company: 'Danat Al Emarat Hospital',              contact: 'Dr. Sara Al Dhaheri',      email: 'info@danatemarat.ae',           mobile: '+971 2 204 4440', status: 'KYC Form Sent' as KycStatus, manager: 'Sara Mohammed',   tlNum: 'TL-2025-300002', tlExp: new Date('2026-11-30'), dhaNum: 'DHA-DE-20251122', vat: '', emirate: 'Abu Dhabi',      web: 'www.danatemarat.ae',        addr: 'Al Meena Street, Abu Dhabi, UAE',                               desig: 'Medical Director',  sigEmail: 's.dhaheri@danat.ae',             eid: '',                      passport: '',                    sigProof: '', goLiveReadiness: 'yet-to-go-live' },
      { company: 'Al Zahra Hospital Sharjah',             contact: 'Dr. Hamid Mirza',          email: 'info@alzahrasharjah.ae',        mobile: '+971 6 561 4444', status: 'KYC Form Sent' as KycStatus, manager: 'John Smith',      tlNum: 'TL-2025-300003', tlExp: new Date('2026-08-31'), dhaNum: 'DHA-ZS-20251123', vat: '100300003200003', emirate: 'Sharjah',        web: 'www.alzahrasharjah.ae',     addr: 'Al Zahra Street, Al Qasimia, Sharjah, UAE',                     desig: 'Director',          sigEmail: 'h.mirza@alzahrasharjah.ae',      eid: '',                      passport: '',                    sigProof: '', goLiveReadiness: 'go-live' },
      { company: 'Healthpoint Hospital Abu Dhabi',        contact: 'Dr. Priya Sharma',         email: 'info@healthpoint.ae',           mobile: '+971 2 406 1000', status: 'KYC Form Sent' as KycStatus, manager: 'Layla Ibrahim',   tlNum: 'TL-2025-300004', tlExp: new Date('2026-09-30'), dhaNum: 'DHA-HP-20251124', vat: '100300004200003', emirate: 'Abu Dhabi',      web: 'www.healthpoint.ae',        addr: 'Zayed Sports City, Abu Dhabi, UAE',                             desig: 'Director',               sigEmail: 'p.sharma@healthpoint.ae',        eid: '',                      passport: '',                    sigProof: '', goLiveReadiness: 'yet-to-go-live' },
      { company: 'Moorfields Eye Hospital Dubai',         contact: 'Dr. David Turner',         email: 'info@moorfields.ae',            mobile: '+971 4 429 7888', status: 'KYC Form Sent' as KycStatus, manager: 'Fatima Al Zaabi', tlNum: 'TL-2025-300005', tlExp: new Date('2026-07-31'), dhaNum: 'DHA-ME-20251125', vat: '100300005200003', emirate: 'Dubai',          web: 'www.moorfields.ae',         addr: 'DHCC, Dubai, UAE',                                              desig: 'Medical Director',  sigEmail: 'd.turner@moorfields.ae',         eid: '',                      passport: '',                    sigProof: '', goLiveReadiness: 'go-live' },
      { company: 'Iranian Hospital Dubai',                contact: 'Dr. Reza Tehrani',         email: 'info@iranianhospital.ae',       mobile: '+971 4 344 0250', status: 'KYC Form Sent' as KycStatus, manager: 'Ali Hassan',      tlNum: 'TL-2025-300006', tlExp: new Date('2026-06-30'), dhaNum: 'DHA-IH-20251126', vat: '', emirate: 'Dubai',          web: 'www.iranianhospital.ae',    addr: 'Al Wasl Road, Jumeirah, Dubai, UAE',                            desig: 'Director',               sigEmail: 'r.tehrani@iranianhospital.ae',   eid: '',                      passport: '',                    sigProof: '', goLiveReadiness: 'yet-to-go-live' },
      { company: 'Mediclinic Parkview Hospital',          contact: 'Dr. Leila Al Hashimi',     email: 'info@parkview.ae',              mobile: '+971 4 414 2000', status: 'KYC Form Sent' as KycStatus, manager: 'Sara Mohammed',   tlNum: 'TL-2025-300007', tlExp: new Date('2026-05-31'), dhaNum: 'DHA-PV-20251127', vat: '100300007200003', emirate: 'Dubai',          web: 'www.parkview.ae',           addr: 'Arjan, Al Barsha South, Dubai, UAE',                            desig: 'Managing Director', sigEmail: 'l.hashimi@parkview.ae',          eid: '',                      passport: '',                    sigProof: '', goLiveReadiness: 'yet-to-go-live' },
      { company: 'Emirates Specialty Hospital',           contact: 'Dr. Mark Thompson',        email: 'info@emiratesh.ae',             mobile: '+971 4 362 2222', status: 'KYC Pending' as KycStatus, manager: 'John Smith',      tlNum: 'TL-2025-300008', tlExp: new Date('2026-04-30'), dhaNum: 'DHA-ES-20251128', vat: '100300008200003', emirate: 'Dubai',          web: 'www.emiratesh.ae',          addr: 'Al Garhoud, Dubai, UAE',                                        desig: 'Director',               sigEmail: 'm.thompson@emiratesh.ae',        eid: '',                      passport: '',                    sigProof: ''                        },
      { company: 'Al Zahra Paediatrics Sharjah',          contact: 'Dr. Maryam Al Falasi',     email: 'info@alzahrapaed.ae',           mobile: '+971 6 574 5400', status: 'KYC Pending' as KycStatus, manager: 'Layla Ibrahim',   tlNum: 'TL-2025-300009', tlExp: new Date('2026-12-31'), dhaNum: 'DHA-ZP-20251129', vat: '100300009200003', emirate: 'Sharjah',        web: 'www.alzahrapaed.ae',        addr: 'Al Qasimia, Sharjah, UAE',                                      desig: 'Director',          sigEmail: 'm.falasi@alzahrapaed.ae',        eid: '',                      passport: '',                    sigProof: ''                        },
      { company: 'Ibn Sina Medical Centre',               contact: 'Dr. Ahmed Qasimi',         email: 'info@ibnsina.ae',               mobile: '+971 4 298 8882', status: 'KYC Pending' as KycStatus, manager: 'Fatima Al Zaabi', tlNum: 'TL-2025-300010', tlExp: new Date('2026-11-30'), dhaNum: 'DHA-IS-20251130', vat: '100300010200003', emirate: 'Dubai',          web: 'www.ibnsina.ae',            addr: 'Deira, Dubai, UAE',                                             desig: 'Medical Director',  sigEmail: 'a.qasimi@ibnsina.ae',            eid: '',                      passport: '',                    sigProof: ''                        },
      // ── Under Review (5) ────────────────────────────────────────────────────
      { company: 'Gulf International Cancer Centre',      contact: 'Dr. Mahmoud Al Rashdi',    email: 'info@gicc.ae',                  mobile: '+971 4 434 4488', status: 'Under Review'  as KycStatus, manager: 'Ali Hassan',      tlNum: 'TL-2025-400001', tlExp: new Date('2026-08-31'), dhaNum: 'DHA-GC-20251131', vat: '', emirate: 'Dubai',          web: 'www.gicc.ae',               addr: 'DHCC, Dubai, UAE',                                              desig: 'Director',               sigEmail: 'm.rashdi@gicc.ae',               eid: 'eid_mahmoud.pdf',       passport: 'pp_mahmoud.pdf',      sigProof: 'board_gicc.pdf'          },
      { company: 'Adam & Eve Specialized Medical Centre', contact: 'Dr. Veena Pillai',         email: 'info@adameve.ae',               mobile: '+971 4 349 5555', status: 'Under Review'  as KycStatus, manager: 'Sara Mohammed',   tlNum: 'TL-2025-400002', tlExp: new Date('2026-07-31'), dhaNum: 'DHA-AE-20251132', vat: '100400002200003', emirate: 'Dubai',          web: 'www.adameve.ae',            addr: 'Jumeirah, Dubai, UAE',                                          desig: 'Medical Director',  sigEmail: 'v.pillai@adameve.ae',            eid: 'eid_veena.pdf',         passport: 'pp_veena.pdf',        sigProof: 'authority_ae.pdf'        },
      { company: 'Medeor 24x7 Hospital Dubai',            contact: 'Dr. Suresh Babu',          email: 'info@medeor.ae',                mobile: '+971 4 752 4700', status: 'Re-submission'  as KycStatus, manager: 'John Smith',      tlNum: 'TL-2025-400003', tlExp: new Date('2026-09-30'), dhaNum: 'DHA-MD-20251133', vat: '', emirate: 'Dubai',          web: 'www.medeor.ae',             addr: 'Al Qusais, Dubai, UAE',                                         desig: 'Director',          sigEmail: 's.babu@medeor.ae',               eid: 'eid_suresh.pdf',        passport: 'pp_suresh.pdf',       sigProof: 'dir_medeor.pdf',        fieldErrors: { tradeLicenseExpiry: 'Trade license expiry date entered (30 Sep 2026) does not match the uploaded document. Please re-upload a valid renewed copy.', vatTrnNumber: 'VAT TRN number provided is 15 digits but the format is incorrect — please verify and resubmit the correct number.' } },
      { company: 'Aster Hospital Mankhool',               contact: 'Dr. Sunita Krishnan',      email: 'info@aster.ae',                 mobile: '+971 4 354 0000', status: 'Under Review'  as KycStatus, manager: 'Layla Ibrahim',   tlNum: 'TL-2025-400004', tlExp: new Date('2026-10-31'), dhaNum: 'DHA-AM-20251134', vat: '100400004200003', emirate: 'Dubai',          web: 'www.aster.ae',              addr: 'Mankhool Road, Bur Dubai, Dubai, UAE',                          desig: 'Director',               sigEmail: 's.krishnan@aster.ae',            eid: 'eid_sunita.pdf',        passport: 'pp_sunita.pdf',       sigProof: 'board_aster.pdf'         },
      { company: 'Neuro Spinal Hospital Dubai',           contact: 'Dr. Tariq Al Maktoum',     email: 'info@nsh.ae',                   mobile: '+971 4 342 0000', status: 'Under Review'  as KycStatus, manager: 'Fatima Al Zaabi', tlNum: 'TL-2025-400005', tlExp: new Date('2026-06-30'), dhaNum: 'DHA-NS-20251135', vat: '100400005200003', emirate: 'Dubai',          web: 'www.nsh.ae',                addr: 'Al Barsha, Dubai, UAE',                                         desig: 'Managing Director', sigEmail: 't.maktoum@nsh.ae',               eid: 'eid_tariq.pdf',         passport: 'pp_tariq.pdf',        sigProof: 'moa_nsh.pdf'             },
      // ── KYC Expired (2) ─────────────────────────────────────────────────────
      { company: 'Al Raha Hospital Abu Dhabi',            contact: 'Dr. Nour Al Ameri',        email: 'info@alrahahospital.ae',        mobile: '+971 2 563 3333', status: 'KYC Expired'   as KycStatus, manager: 'Ali Hassan',      tlNum: 'TL-2023-500001', tlExp: new Date('2024-06-30'), dhaNum: 'DHA-RH-20231501', vat: '100500001200003', emirate: 'Abu Dhabi',      web: 'www.alrahahospital.ae',     addr: 'Al Raha Beach, Abu Dhabi, UAE',                                 desig: 'Director',               sigEmail: 'n.ameri@alrahahospital.ae',      eid: 'eid_nour_a.pdf',        passport: 'pp_nour_a.pdf',       sigProof: 'auth_alraha.pdf',       kycType: 'renewal' },
      { company: 'Capital Health Screening Centre',       contact: 'Dr. Elena Petrov',         email: 'info@capitalhealth.ae',         mobile: '+971 2 491 6011', status: 'KYC Expired'   as KycStatus, manager: 'Sara Mohammed',   tlNum: 'TL-2023-500002', tlExp: new Date('2024-08-31'), dhaNum: 'DHA-CH-20231502', vat: '100500002200003', emirate: 'Abu Dhabi',      web: 'www.capitalhealth.ae',      addr: 'Mussafah, Abu Dhabi, UAE',                                      desig: 'Medical Director',  sigEmail: 'e.petrov@capitalhealth.ae',      eid: 'eid_elena.pdf',         passport: 'pp_elena.pdf',        sigProof: 'dir_capital.pdf',       kycType: 'renewal' },
      // ── KYC Rejected (Converted to Re-submission for correct queue tallying) ──
      { company: 'Clover Medical Centre Dubai',           contact: 'Dr. James McAllister',     email: 'info@clovermed.ae',             mobile: '+971 4 337 1111', status: 'Re-submission' as KycStatus, manager: 'John Smith',      tlNum: 'TL-2022-600001', tlExp: new Date('2023-12-31'), dhaNum: 'DHA-CM-20221601', vat: '100600001200003', emirate: 'Dubai',          web: 'www.clovermed.ae',          addr: 'Al Rigga, Deira, Dubai, UAE',                                   desig: 'Director',               sigEmail: 'j.mcallister@clovermed.ae',      eid: 'eid_james_mc.pdf',      passport: 'pp_james_mc.pdf',     sigProof: '',                      rejectionReason: 'Trade License expired 31 Dec 2023. DHA License verification failed — please reapply with renewed documents.', fieldErrors: { tradeLicenseExpiry: 'Trade License expired — a valid renewed copy must be submitted.', dhaLicenseNumber: 'DHA License could not be verified — please resubmit with the correct number.' }, kycType: 'renewal' },
    ];

    this.records = seed.map((row, i) => ({
      id:                   i + 1,
      companyName:          row.company,
      contactName:          row.contact,
      email:                row.email,
      mobile:               row.mobile,
      status:               row.status,
      kycFormSentOn:        row.status === 'KYC Pending' ? null : new Date(Date.now() - (i + 2) * 3 * DAY),
      kycSubmittedOn:       ['KYC Submitted', 'Under Review', 'KYC Approved', 'KYC Rejected', 'Re-submission'].includes(row.status)
                              ? new Date(Date.now() - (i + 1) * 2 * DAY) : null,
      kycExpiryDate:        row.status === 'KYC Pending'
                              ? null
                              : row.status === 'KYC Expired'
                                ? new Date(Date.now() - (i + 1) * 5 * DAY)
                                : row.expiryDays != null
                                  ? new Date(Date.now() + row.expiryDays * DAY)
                                  : new Date(Date.now() + (400 + i * 5) * DAY),
      salesPerson:          row.manager,
      documents:            docs.map(d => ({ ...d })),
      reviewNotes:          '',
      rejectionReason:      row.rejectionReason,
      goLiveReadiness:      row.goLiveReadiness,
      tradeLicenseNumber:   row.tlNum,
      tradeLicenseExpiry:   row.tlExp,
      tradeLicenseAuthority: 'Dubai Economy (DED)',
      vatTrnNumber:         row.vat,
      registeredAddress:    row.addr,
      signatoryDesignation: row.desig,
      signatoryEmail:       row.sigEmail,
      signatoryPhone:       row.mobile || '+971 4 331 2345',
      signatoryRemarks:     'Main Signatory',
      implementationName:   'John Smith POC',
      implementationEmail:  'implementation@unitecare.com',
      implementationPhone:  '+971 4 331 1111',
      operationsName:       'Sarah Connor',
      operationsEmail:      'operations@unitecare.com',
      operationsPhone:      '+971 4 331 2222',
      accountsName:         'Bruce Wayne',
      accountsEmail:        'finance@unitecare.com',
      accountsPhone:        '+971 4 331 3333',
      complianceName:       'Compliance Officer',
      complianceEmail:      'compliance@unitecare.com',
      compliancePhone:      '+971 4 331 4444',
      fileDhaLicense:       'dha_license.pdf',
      fileTradeLicense:     'trade_license.pdf',
      fileVatCertificate:   row.vat ? 'vat_certificate.pdf' : undefined,
      dhaLicenseNumber:     row.dhaNum,
      emirate:              row.emirate,
      website:              row.web,
      fileEmiratiesId:      row.eid,
      filePassport:         row.passport,
      fileSignatureProof:   row.sigProof,
      fieldErrors:          row.fieldErrors,
      kycType:              row.kycType ?? 'new',
    }));

    const medeor = this.records.find(r => r.companyName === 'Medeor 24x7 Hospital Dubai');
    if (medeor) {
      medeor.reviewNotes = 'Two fields require correction before approval can proceed. Flagged and sent to customer on ' + new Date(Date.now() - 2 * 86_400_000).toLocaleDateString('en-GB') + '.';
      medeor.fieldErrorsHistory = {
        tradeLicenseExpiry: [
          {
            timestamp: new Date(Date.now() - 2 * 86_400_000),
            reviewerComment: 'Trade license expiry date entered (30 Sep 2026) does not match the uploaded document scan. Please re-upload a valid renewed copy of the trade license.'
          }
        ],
        vatTrnNumber: [
          {
            timestamp: new Date(Date.now() - 2 * 86_400_000),
            reviewerComment: 'VAT TRN number provided appears to have an incorrect format. The number must be exactly 15 digits. Please verify with your finance team and resubmit.'
          }
        ]
      };
    }

    const gicc = this.records.find(r => r.companyName === 'Gulf International Cancer Centre');
    if (gicc) {
      gicc.fieldErrorsHistory = {
        tradeLicenseExpiry: [
          {
            timestamp: new Date(Date.now() - 3 * 86_400_000),
            reviewerComment: 'The expiry date entered (31 Aug 2025) is in the past. Please verify and upload the renewed trade license.',
            correctedValue: '31 Aug 2026'
          }
        ],
        fileTradeLicense: [
          {
            timestamp: new Date(Date.now() - 7 * 86_400_000),
            reviewerComment: 'Trade license copy uploaded is cropped and details are unreadable. Please upload a clear copy.',
            correctedValue: 'Trade_License_Renewed_2026.pdf'
          }
        ],
        dhaLicenseNumber: [
          {
            timestamp: new Date(Date.now() - 3 * 86_400_000),
            reviewerComment: 'DHA License number does not match the format DHA-XX-XXXXXX.',
            correctedValue: 'DHA-GC-20251131'
          }
        ]
      };
    }

    // Seed Re-submission History
    if (medeor) {
      medeor.resubmissionHistory = [
        {
          personName: 'Dr. Suresh Babu',
          timestamp: new Date(Date.now() - 4 * 86_400_000),
          action: 'Form Submitted',
          comments: 'Initial submission of clinic details and certificates.'
        },
        {
          personName: 'Sara Mohammed (Reviewer)',
          timestamp: new Date(Date.now() - 2 * 86_400_000),
          action: 'Correction Required',
          comments: 'Trade license expiry date entered does not match the scan. VAT TRN number format is incorrect.'
        }
      ];
    }

    const clover = this.records.find(r => r.companyName === 'Clover Medical Centre Dubai');
    if (clover) {
      clover.resubmissionHistory = [
        {
          personName: 'Dr. James McAllister',
          timestamp: new Date(Date.now() - 10 * 86_400_000),
          action: 'Form Submitted',
          comments: 'Renewal submission with new documents.'
        },
        {
          personName: 'Sara Mohammed (Reviewer)',
          timestamp: new Date(Date.now() - 9 * 86_400_000),
          action: 'Correction Required',
          comments: 'Trade license scan is blurry. Please re-upload.'
        },
        {
          personName: 'Dr. James McAllister',
          timestamp: new Date(Date.now() - 6 * 86_400_000),
          action: 'Re-Submitted',
          comments: 'Re-uploaded clear trade license and DHA copy.'
        },
        {
          personName: 'John Smith (Reviewer)',
          timestamp: new Date(Date.now() - 4 * 86_400_000),
          action: 'Correction Required',
          comments: 'DHA License could not be verified. Trade License expired Dec 2023.'
        }
      ];
    }
  }

  // ── Tab filtering ──────────────────────────────────────────────────────────
  setTab(tab: KycStatus | 'All'): void {
    this.activeTab = tab;
    this.applyFilter();
  }

  tabCount(tab: KycStatus | 'All'): number {
    return tab === 'All'
      ? this.records.length
      : this.records.filter(r => r.status === tab).length;
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

    for (const filter of selectedFilters) {
      const normFilter = filter.toLowerCase().trim();
      
      if (normFilter === 'this month' || normFilter === 'mtd') {
        if (recordMonth === currentMonth && recordYear === currentYear) {
          return true;
        }
      } else if (normFilter === 'last month') {
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        if (recordMonth === lastMonthDate.getMonth() && recordYear === lastMonthDate.getFullYear()) {
          return true;
        }
      } else if (normFilter === 'this quarter') {
        const currentQuarter = Math.floor(currentMonth / 3);
        const recordQuarter = Math.floor(recordMonth / 3);
        if (recordQuarter === currentQuarter && recordYear === currentYear) {
          return true;
        }
      } else if (normFilter === 'last quarter') {
        const currentQuarter = Math.floor(currentMonth / 3);
        let targetQuarter = currentQuarter - 1;
        let targetYear = currentYear;
        if (targetQuarter < 0) {
          targetQuarter = 3;
          targetYear = currentYear - 1;
        }
        const recordQuarter = Math.floor(recordMonth / 3);
        if (recordQuarter === targetQuarter && recordYear === targetYear) {
          return true;
        }
      } else if (normFilter === 'last 6 months') {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        if (d.getTime() >= sixMonthsAgo.getTime() && d.getTime() <= today.getTime()) {
          return true;
        }
      } else if (normFilter === 'last year') {
        if (recordYear === currentYear - 1) {
          return true;
        }
      } else if (normFilter === 'ytd') {
        if (recordYear === currentYear && d.getTime() <= today.getTime()) {
          return true;
        }
      } else if (normFilter === 'as of date') {
        if (d.getTime() <= today.getTime()) {
          return true;
        }
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
      (this.activeMetricFilter && this.activeMetricFilter !== 'all')
    );
  }

  clearAllFilters(): void {
    this.searchQuery = '';
    this.selectedStatuses = [];
    this.selectedDateFilters = [];
    this.dateRangeFilter = { start: null, end: null };
    this.activeMetricFilter = null;
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

  applyPageFilters(): void {
    this.applyFilter();
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
        (r.salesPerson && r.salesPerson.toLowerCase().includes(query))
      );
    }

    // 2. Status MultiSelect Filter
    if (this.selectedStatuses && this.selectedStatuses.length > 0) {
      filtered = filtered.filter(r => this.selectedStatuses.includes(r.status));
    }

    // 3. Date / Month Dropdown Filter
    if (this.selectedDateFilters && this.selectedDateFilters.length > 0) {
      filtered = filtered.filter(r => {
        const date = r.kycSubmittedOn || r.kycFormSentOn || r.kycExpiryDate;
        return this.matchDateFilters(date, this.selectedDateFilters);
      });
    }

    // 4. Date Range Filter
    if (this.dateRangeFilter.start || this.dateRangeFilter.end) {
      filtered = filtered.filter(r => {
        const date = r.kycSubmittedOn || r.kycFormSentOn || r.kycExpiryDate;
        if (!date) return false;
        const start = this.dateRangeFilter.start;
        const end   = this.dateRangeFilter.end;
        if (start && end) return date >= start && date <= end;
        if (start)        return date >= start;
        if (end)          return date <= end;
        return true;
      });
    }

    // Set pageFilteredRecords here so overview KPI card counts are updated ONLY by search and date filters,
    // and are not filtered down by clicking the metric cards themselves.
    this.pageFilteredRecords = filtered;

    let gridFiltered = filtered;

    // 5. Metric Card Filter (applies to the grid only)
    if (this.activeMetricFilter) {
      const filter = this.activeMetricFilter;
      const now  = Date.now();
      const in30 = now + 30 * 86_400_000;
      
      if (filter === 'sent') {
        gridFiltered = gridFiltered.filter(r => r.status !== 'KYC Pending');
      } else if (filter === 'submitted') {
        gridFiltered = gridFiltered.filter(r => ['KYC Submitted', 'Under Review', 'Re-submission', 'KYC Approved', 'KYC Rejected', 'KYC Expired'].includes(r.status));
      } else if (filter === 'completed' || filter === 'approved') {
        gridFiltered = gridFiltered.filter(r => r.status === 'KYC Approved');
      } else if (filter === 'pending') {
        gridFiltered = gridFiltered.filter(r => r.status === 'KYC Pending');
      } else if (filter === 'form-sent') {
        gridFiltered = gridFiltered.filter(r => r.status === 'KYC Form Sent');
      } else if (filter === 'resubmission') {
        gridFiltered = gridFiltered.filter(r => r.status === 'Re-submission');
      } else if (filter === 'under-review') {
        gridFiltered = gridFiltered.filter(r => r.status === 'Under Review' || r.status === 'KYC Submitted');
      } else if (filter === 'rejected') {
        gridFiltered = gridFiltered.filter(r => r.status === 'KYC Rejected');
      } else if (filter === 'expiring-soon') {
        gridFiltered = gridFiltered.filter(r => 
          r.status !== 'KYC Expired' &&
          r.kycExpiryDate != null &&
          r.kycExpiryDate.getTime() >= now &&
          r.kycExpiryDate.getTime() <= in30
        );
      } else if (filter === 'expired') {
        gridFiltered = gridFiltered.filter(r => r.status === 'KYC Expired');
      } else if (filter === 'renewals') {
        gridFiltered = gridFiltered.filter(r => r.status === 'KYC Expired' || this.isExpiringSoon(r));
      } else if (filter === 'in-progress') {
        gridFiltered = gridFiltered.filter(r =>
          ['KYC Form Sent', 'KYC Submitted', 'Under Review', 'Re-submission'].includes(r.status)
        );
      } else if (filter === 'renewal-sent') {
        gridFiltered = gridFiltered.filter(r => r.status === 'KYC Expired' || this.isExpiringSoon(r));
      } else if (filter === 'renewal-under-review') {
        gridFiltered = gridFiltered.filter(r => r.status === 'KYC Expired');
      } else if (filter === 'renewal-pending') {
        gridFiltered = gridFiltered.filter(r => this.isExpiringSoon(r));
      } else if (filter === 'renewal-about-to-expire') {
        const now = Date.now();
        const in31 = now + 31 * 86_400_000;
        const in60 = now + 60 * 86_400_000;
        gridFiltered = gridFiltered.filter(r =>
          r.status !== 'KYC Expired' &&
          r.kycExpiryDate != null &&
          r.kycExpiryDate.getTime() > in31 &&
          r.kycExpiryDate.getTime() <= in60
        );
      }
    }

    // Default sort: urgency order, Approved always last.
    // Expiring-soon Approved records surface just above regular Approved.
    // Overridden when user clicks a column header.
    if (!this.gridState.sort || this.gridState.sort.length === 0) {
      const now  = Date.now();
      const in30 = now + 30 * 86_400_000;
      const basePriority: Partial<Record<KycStatus, number>> = {
        'KYC Expired':   0,
        'KYC Rejected':  1,
        'Re-submission': 2,
        'Under Review':  3,
        'KYC Submitted': 4,
        'KYC Form Sent': 5,
        'KYC Pending':   6,
        // Approved split below
      };
      gridFiltered = [...gridFiltered].sort((a, b) => {
        const pa = a.status === 'KYC Approved'
          ? (a.kycExpiryDate != null && a.kycExpiryDate.getTime() >= now && a.kycExpiryDate.getTime() <= in30 ? 7 : 8)
          : (basePriority[a.status] ?? 5);
        const pb = b.status === 'KYC Approved'
          ? (b.kycExpiryDate != null && b.kycExpiryDate.getTime() >= now && b.kycExpiryDate.getTime() <= in30 ? 7 : 8)
          : (basePriority[b.status] ?? 5);
        return pa - pb;
      });
    }

    this.filteredRecords = gridFiltered;
    this.gridData = process(gridFiltered, this.gridState) as { data: KycRecord[]; total: number };
    this.fp.save('kyc', {
      searchQuery: this.searchQuery, selectedStatuses: this.selectedStatuses,
      selectedDateFilters: this.selectedDateFilters, dateRangeFilter: this.dateRangeFilter,
      activeMetricFilter: this.activeMetricFilter, inProgressGoLiveFilter: this.inProgressGoLiveFilter,
      activeTab: this.activeTab, gridDensity: this.gridDensity
    });
  }

  onStateChange(state: DataStateChangeEvent): void {
    this.gridState = state;
    this.applyFilter();
  }

  // ── Status helpers ─────────────────────────────────────────────────────────
  getStatusClass(status: KycStatus): string {
    const map: Record<KycStatus, string> = {
      'KYC Pending':   'badge-neutral',
      'KYC Form Sent': 'badge-info',
      'KYC Submitted': 'badge-primary',
      'Under Review':  'badge-warning',
      'KYC Approved':  'badge-success',
      'KYC Rejected':  'badge-danger',
      'Re-submission': 'badge-resubmit',
      'KYC Expired':   'badge-expired',
    };
    return map[status] ?? 'badge-neutral';
  }

  getStatusIcon(status: KycStatus): string {
    const map: Record<KycStatus, string> = {
      'KYC Pending':   'fas fa-clock',
      'KYC Form Sent': 'fas fa-paper-plane',
      'KYC Submitted': 'fas fa-inbox',
      'Under Review':  'fas fa-search',
      'KYC Approved':  'fas fa-check-circle',
      'KYC Rejected':  'fas fa-times-circle',
      'Re-submission': 'fas fa-redo',
      'KYC Expired':   'fas fa-exclamation-triangle',
    };
    return map[status] ?? 'fas fa-circle';
  }

  getStatusLabel(status: KycStatus): string {
    const map: Record<KycStatus, string> = {
      'KYC Pending':   'KYC Pending',
      'KYC Form Sent': 'KYC Form Sent',
      'KYC Submitted': 'Submission',
      'Under Review':  'Under Review',
      'KYC Approved':  'KYC Approved',
      'KYC Rejected':  'KYC Rejected',
      'Re-submission': 'Re-submission',
      'KYC Expired':   'KYC Expired',
    };
    return map[status] ?? status;
  }

  getResubmissionCount(record: KycRecord): number {
    const history = record.fieldErrorsHistory;
    if (!history) {
      return record.status === 'Re-submission' ? 1 : 0;
    }

    const uniqueTimestamps = new Set<string>();
    Object.values(history).forEach(entries => {
      entries?.forEach(entry => uniqueTimestamps.add(entry.timestamp.toISOString()));
    });

    return Math.max(uniqueTimestamps.size, record.status === 'Re-submission' ? 1 : 0);
  }

  hasVatCertificate(record: KycRecord): boolean {
    return !!record.fileVatCertificate?.trim();
  }

  hasTradeLicenseCertificate(record: KycRecord): boolean {
    return !!record.fileTradeLicense?.trim();
  }

  shouldShowDocumentIndicators(record: KycRecord): boolean {
    return record.status !== 'KYC Pending' && record.status !== 'KYC Form Sent';
  }

  isReviewable(status: KycStatus): boolean {
    return ['KYC Submitted', 'Under Review', 'Re-submission'].includes(status);
  }

  isExpiringSoon(record: KycRecord): boolean {
    if (record.status !== 'KYC Approved' || !record.kycExpiryDate) return false;
    const now = Date.now();
    return record.kycExpiryDate.getTime() >= now &&
           record.kycExpiryDate.getTime() <= now + 30 * 86_400_000;
  }

  // ── Review dialog ──────────────────────────────────────────────────────────
  openReviewPanel(record: KycRecord): void {
    this.selectedRecord  = { ...record, documents: record.documents.map(d => ({ ...d })) };
    this.reviewerNotes   = '';
    this.rejectionReason = '';
    this.showRejectForm  = false;
    this.reviewPanelOpen = true;
    this.panelIndex = this.filteredRecords.findIndex(r => r.id === record.id);
    if (this.panelIndex < 0) this.panelIndex = 0;
    this.ks.register('kyc-panel', {
      'Escape':     () => this.closeReviewPanel(),
      'ArrowLeft':  () => this.navigatePanel(-1),
      'ArrowRight': () => this.navigatePanel(1),
    });
  }

  navigatePanel(dir: -1 | 1): void {
    const next = this.panelIndex + dir;
    if (next < 0 || next >= this.filteredRecords.length) return;
    this.panelIndex = next;
    this.openReviewPanel(this.filteredRecords[next]);
  }

  closeReviewPanel(): void {
    this.reviewPanelOpen = false;
    this.selectedRecord   = null;
    this.showRejectForm   = false;
    this.ks.deregister('kyc-panel');
    this.panelClosed.emit();
  }

  approveKyc(event: {notes: string}): void {
    if (this.selectedRecord) {
      this.selectedRecord.status = 'KYC Approved';
      this.selectedRecord.reviewNotes = event.notes;
      this.closeReviewPanel();
      this.applyFilter();
    }
  }

  rejectKyc(event: {notes: string, reason: string}): void {
    if (this.selectedRecord) {
      this.selectedRecord.status = 'KYC Rejected';
      this.selectedRecord.reviewNotes = event.notes;
      this.selectedRecord.rejectionReason = event.reason;
      this.closeReviewPanel();
      this.applyFilter();
    }
  }

  requestCorrection(event: {notes: string, fieldErrors?: any}): void {
    if (this.selectedRecord) {
      this.selectedRecord.status = 'Re-submission';
      this.selectedRecord.reviewNotes = event.notes;
      if (event.fieldErrors) {
        const errors: Record<string, string> = {};
        for (const [key, val] of Object.entries(event.fieldErrors)) {
          const v = val as { invalid: boolean; comment: string };
          if (v.invalid && v.comment.trim()) {
            errors[key] = v.comment;
          }
        }
        this.selectedRecord.fieldErrors = errors;
      }
      this.closeReviewPanel();
      this.applyFilter();
    }
  }

  markUnderReview(): void {
    this._patch(this.selectedRecord?.id, { status: 'Under Review' });
    this.closeReviewPanel();
  }

  // ── Bulk renewal ───────────────────────────────────────────────────────────
  bulkSendRenewal(): void {
    const targets = this.records.filter(r =>
      this.selectedKeys.includes(r.id) &&
      (r.status === 'KYC Expired' || this.isExpiringSoon(r))
    );
    if (!targets.length) { return; }

    targets.forEach(r => {
      this.outboxService.addItem({
        companyName: r.companyName,
        contactName: r.contactName,
        email: r.email,
        channel: 'Email',
        category: 'KYC',
        actionType: 'Resend',
        reference: r.tradeLicenseNumber || 'N/A',
        originalRecordId: r.id,
        details: 'Bulk resending of KYC upload link following trade license expiry or warning.',
      });
    });

    alert(`${targets.length} KYC renewal request(s) queued to Outbox for Final Approval.`);
    this.selectedKeys = [];
  }

  // ── Metric helpers ─────────────────────────────────────────────────────────
  get totalClinicsCount()  { return this.records.length; }
  get completedCount()     { return this.pageFilteredRecords.filter(r => r.status === 'KYC Approved').length; }
  get sentCount()          { return this.pageFilteredRecords.filter(r => r.status !== 'KYC Pending').length; }
  get submittedCount()     { return this.pageFilteredRecords.filter(r => ['KYC Submitted', 'Under Review', 'Re-submission', 'KYC Approved', 'KYC Rejected', 'KYC Expired'].includes(r.status)).length; }
  get underReviewCount()   { return this.pageFilteredRecords.filter(r => r.status === 'Under Review' || r.status === 'KYC Submitted').length; }
  get awaitingFirstSubmissionCount() {
    return this.pageFilteredRecords.filter(r =>
      (r.status === 'KYC Submitted' || r.status === 'Under Review') &&
      (!r.fieldErrorsHistory || Object.keys(r.fieldErrorsHistory).length === 0)
    ).length;
  }
  get awaitingResubmissionCount() {
    return this.pageFilteredRecords.filter(r =>
      (r.status === 'KYC Submitted' || r.status === 'Under Review') &&
      !!r.fieldErrorsHistory && Object.keys(r.fieldErrorsHistory).length > 0
    ).length;
  }

  // ── In-Progress KPI getters (respect the Go-Live dropdown filter) ───────────
  private get inProgressFilteredRecords() {
    if (this.inProgressGoLiveFilter === 'all') return this.pageFilteredRecords;
    return this.pageFilteredRecords.filter(r => r.goLiveReadiness === this.inProgressGoLiveFilter);
  }
  get kpiUnderReviewCount() {
    return this.inProgressFilteredRecords.filter(r => r.status === 'Under Review' || r.status === 'KYC Submitted').length;
  }
  get kpiPendingSubmissionCount() {
    return this.inProgressFilteredRecords.filter(r => r.status === 'KYC Form Sent').length;
  }
  get kpiPendingSubmissionGoLiveCount() {
    return this.inProgressFilteredRecords.filter(r => r.status === 'KYC Form Sent' && r.goLiveReadiness === 'go-live').length;
  }
  get kpiPendingSubmissionYetToGoLiveCount() {
    return this.inProgressFilteredRecords.filter(r => r.status === 'KYC Form Sent' && r.goLiveReadiness !== 'go-live').length;
  }
  get kpiAwaitingFirstSubmissionCount() {
    return this.inProgressFilteredRecords.filter(r =>
      (r.status === 'KYC Submitted' || r.status === 'Under Review') &&
      (!r.fieldErrorsHistory || Object.keys(r.fieldErrorsHistory).length === 0)
    ).length;
  }
  get kpiAwaitingResubmissionCount() {
    return this.inProgressFilteredRecords.filter(r =>
      (r.status === 'KYC Submitted' || r.status === 'Under Review') &&
      !!r.fieldErrorsHistory && Object.keys(r.fieldErrorsHistory).length > 0
    ).length;
  }
  get pendingCount()       { return this.pageFilteredRecords.filter(r => r.status === 'KYC Pending').length; }
  get pendingSubmissionCount() { return this.pageFilteredRecords.filter(r => r.status === 'KYC Form Sent').length; }
  get pendingSubmissionGoLiveCount() {
    return this.pageFilteredRecords.filter(r =>
      r.status === 'KYC Form Sent' && r.goLiveReadiness === 'go-live'
    ).length;
  }
  get pendingSubmissionYetToGoLiveCount() {
    return this.pageFilteredRecords.filter(r =>
      r.status === 'KYC Form Sent' && r.goLiveReadiness !== 'go-live'
    ).length;
  }
  get resubmissionCount()  { return this.pageFilteredRecords.filter(r => r.status === 'Re-submission').length; }
  
  get expiringSoonCount() {
    const now = Date.now();
    const in30 = now + 30 * 86_400_000;
    return this.pageFilteredRecords.filter(r =>
      r.status !== 'KYC Expired' &&
      r.kycExpiryDate != null &&
      r.kycExpiryDate.getTime() >= now &&
      r.kycExpiryDate.getTime() <= in30
    ).length;
  }
  
  get expiredCount()      { return this.pageFilteredRecords.filter(r => r.status === 'KYC Expired').length; }
  get rejectedCount()     { return this.pageFilteredRecords.filter(r => r.status === 'KYC Rejected').length; }
  
  get renewalsInProgressCount() {
    return this.pageFilteredRecords.filter(r => r.status === 'KYC Expired' || this.isExpiringSoon(r)).length;
  }

  get inProgressCount() {
    return this.pageFilteredRecords.filter(r =>
      ['KYC Form Sent', 'KYC Submitted', 'Under Review', 'Re-submission'].includes(r.status)
    ).length;
  }

  get renewalSentCount()        { return this.expiringSoonCount + this.expiredCount; }
  get renewalUnderReviewCount() { return this.expiredCount; }
  get renewalPendingCount()     { return this.expiringSoonCount; }
  get renewalAboutToExpireCount() {
    const now = Date.now();
    const in31 = now + 31 * 86_400_000;
    const in60 = now + 60 * 86_400_000;
    return this.pageFilteredRecords.filter(r =>
      r.status !== 'KYC Expired' &&
      r.kycExpiryDate != null &&
      r.kycExpiryDate.getTime() > in31 &&
      r.kycExpiryDate.getTime() <= in60
    ).length;
  }

  // ── Re-Submission History Methods ──────────────────────────────────────────
  toggleResubHistory(record: KycRecord, anchor: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.activeResubRecord?.id === record.id && this.showResubHistory) {
      this.showResubHistory = false;
      this.activeResubRecord = null;
      this.activeResubAnchor = null;
    } else {
      this.activeResubRecord = record;
      this.activeResubAnchor = anchor;
      this.showResubHistory = true;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showResubHistory) {
      return;
    }

    const target = event.target as HTMLElement;
    const clickedHistoryBtn = target.closest('.resub-history-btn');
    const clickedInsidePopup = target.closest('.resub-history-popup');

    if (!clickedHistoryBtn && !clickedInsidePopup) {
      this.showResubHistory = false;
      this.activeResubRecord = null;
      this.activeResubAnchor = null;
    }
  }

  private _patch(id: number | undefined, patch: Partial<KycRecord>): void {
    if (id == null) { return; }
    const rec = this.records.find(r => r.id === id);
    if (rec) { Object.assign(rec, patch); this.applyFilter(); }
  }
}
