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
import { LayoutModule } from '@progress/kendo-angular-layout';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { IntlModule } from '@progress/kendo-angular-intl';
import { process, State } from '@progress/kendo-data-query';
import { MultiSelectModule } from '@progress/kendo-angular-dropdowns';
import { DateInputsModule } from '@progress/kendo-angular-dateinputs';
import { ComingSoonComponent } from '../coming-soon/coming-soon.component';
import { KycVerificationComponent } from '../kyc-verification/kyc-verification.component';
import { ContractsComponent } from '../contracts/contracts.component';
import { TerminationsComponent } from '../terminations/terminations.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TerminationPanel } from '../shared/termination-panel/termination-panel';

export interface CustomerRecord {
  id: number;
  companyName: string;
  customerName: string;
  status: string;
  nextAction: string;
  kycExpiryDate: Date | null;
  terminationDate: Date | null;
  salesPerson: string;
  kycExpired: boolean;
  terminationReason?: string;
  contractHistory?: ContractVersion[];
  // KYC form fields
  tradeLicenseNumber: string;
  tradeLicenseExpiry: Date | null;
  dhaLicenseNumber: string;
  vatTrnNumber: string;
  emirate: string;
  clinicPhone: string;
  clinicEmail: string;
  website: string;
  registeredAddress: string;
  signatoryDesignation: string;
  signatoryEmail: string;
  signatoryMobile: string;
  fileEmiratiesId: string;
  filePassport: string;
  fileSignatureProof: string;
  fieldErrors?: Partial<Record<string, string>>;
}

export interface KycDocument {
  name: string;
  fileType: string;
  uploadedOn: Date;
  icon: string;
}

export interface ContractVersion {
  ref: string;
  version: number;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expired' | 'pending';
  annualValue: string;
}

@Component({
  selector: 'app-contract-dashboard',
  standalone: true,
  imports: [
    NgClass,
    DatePipe,
    FormsModule,
    GridModule,
    DialogModule,
    ButtonModule,
    ButtonsModule,
    LayoutModule,
    InputsModule,
    LabelModule,
    IntlModule,
    MultiSelectModule,
    DateInputsModule,
    ComingSoonComponent,
    KycVerificationComponent,
    ContractsComponent,
    TerminationsComponent,
    SidebarComponent,
    TerminationPanel,
  ],
  templateUrl: './contract-dashboard.component.html',
  styleUrls: ['./contract-dashboard.component.scss'],
})
export class ContractDashboardComponent implements OnInit {
  today = new Date();

  // ── Notifications ──────────────────────────────────────────────────────────
  showNotifications = false;
  kycRecordToOpen: number | null = null;
  contractRecordToOpen: number | null = null;
  terminationRecordToOpen: number | null = null;

  notifications = [
    {
      id: 1,
      title: 'KYC Verification Submitted',
      message: 'CityCare Medical Clinic uploaded compliance files.',
      time: '10m ago',
      type: 'kyc',
      recordId: 1,
      unread: true,
      icon: 'fas fa-id-card',
      colorClass: 'notif-kyc'
    },
    {
      id: 2,
      title: 'Termination Requested',
      message: 'Sunrise Family Clinic requested termination.',
      time: '1h ago',
      type: 'termination',
      recordId: 7,
      unread: true,
      icon: 'fas fa-ban',
      colorClass: 'notif-termination'
    },
    {
      id: 3,
      title: 'Contract Signed',
      message: 'Prime Physio Specialists completed signature.',
      time: '2h ago',
      type: 'contract',
      recordId: 5,
      unread: false,
      icon: 'fas fa-file-signature',
      colorClass: 'notif-contract'
    },
    {
      id: 4,
      title: 'KYC Expired',
      message: 'Luminous Eye Care Center Trade License expired.',
      time: '1d ago',
      type: 'kyc-expired',
      recordId: 6,
      unread: false,
      icon: 'fas fa-exclamation-triangle',
      colorClass: 'notif-expired'
    }
  ];

  get unreadNotificationsCount(): number {
    return this.notifications.filter(n => n.unread).length;
  }

  navigateToNotification(notif: any): void {
    notif.unread = false;
    this.showNotifications = false;
    this.kycRecordToOpen = null;
    this.contractRecordToOpen = null;
    this.terminationRecordToOpen = null;

    if (notif.type === 'kyc' || notif.type === 'kyc-expired') {
      this.activeNav = 'kyc';
      setTimeout(() => {
        this.kycRecordToOpen = notif.recordId;
      }, 50);
    } else if (notif.type === 'contract') {
      this.activeNav = 'contracts';
      setTimeout(() => {
        this.contractRecordToOpen = notif.recordId;
      }, 50);
    } else if (notif.type === 'termination') {
      this.activeNav = 'terminations';
      setTimeout(() => {
        this.terminationRecordToOpen = notif.recordId;
      }, 50);
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  activeNav = 'dashboard';
  sidebarCollapsed = false;

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  navItems = [
    { id: 'dashboard',    label: 'Dashboard',       icon: 'fas fa-tachometer-alt' },
    { id: 'kyc',          label: 'KYC Submissions', icon: 'fas fa-id-card'        },
    { id: 'contracts',    label: 'Contracts',        icon: 'fas fa-file-contract'  },
    { id: 'terminations', label: 'Terminations',     icon: 'fas fa-times-circle'   },
    { id: 'audit',        label: 'Audit Logs',       icon: 'fas fa-clipboard-list' },
  ];

  setNav(id: string): void { this.activeNav = id; }

  getActiveNavLabel(): string {
    return this.navItems.find(item => item.id === this.activeNav)?.label || 'Dashboard';
  }

  // ── Nav metadata for Coming Soon pages ────────────────────────────────────
  readonly navMeta: Record<string, { label: string; icon: string }> = {
    kyc:          { label: 'KYC Submissions', icon: 'fas fa-id-card' },
    contracts:    { label: 'Contracts',        icon: 'fas fa-file-contract' },
    terminations: { label: 'Terminations',     icon: 'fas fa-times-circle' },
    audit:        { label: 'Audit Logs',       icon: 'fas fa-clipboard-list' },
  };

  // ── Customer Data ───────────────────────────────────────────────────────────
  customers: CustomerRecord[] = [];
  gridData: { data: CustomerRecord[]; total: number } = { data: [], total: 0 };

  gridState: State = {
    skip:   0,
    take:   10,
    sort:   [],
    filter: { logic: 'and', filters: [] },
  };

  selectableSettings: SelectableSettings = {
    checkboxOnly: true,
    mode:         'multiple',
  };

  selectedKeys: number[] = [];

  // ── Search & Filter State ──────────────────────────────────────────────────
  searchQuery: string = '';
  selectedStatuses: string[] = [];
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

  readonly availableStatuses: string[] = [
    'KYC Submitted',
    'KYC Under Review',
    'KYC Approved',
    'Contract Sent',
    'Contract Signed',
    'KYC Expired',
    'Termination Requested',
    'Termination Approved'
  ];

  ngOnInit(): void {
    this.seedCustomers();
    this.refreshGrid();
  }

  seedCustomers(): void {
    const nextActionMap: Record<string, string> = {
      'KYC Submitted':         'Review Documents',
      'KYC Under Review':      'Pending Team Decision',
      'KYC Approved':          'Send Contract',
      'Contract Sent':         'Await Client Signature',
      'Contract Signed':       'Active — Monitor',
      'KYC Expired':           'Send Renewal Email',
      'Termination Requested': 'Review & Approve',
      'Termination Approved':  'Complete Handover',
    };

    const seed = [
      { company: 'CityCare Medical Clinic',   contact: 'Dr. Mohammed Al Futtaim', status: 'KYC Submitted',         manager: 'Ali Hassan',    tlNum: 'TL-2025-881234', tlExp: new Date('2026-03-31'), dhaNum: 'DHA-CL-20251102', vat: '100348521200003', emirate: 'Dubai',     phone: '+971 4 355 7890', cemail: 'info@citycare.ae',       web: 'www.citycare.ae',           addr: 'Unit 204, Health Tower, Al Barsha South, Dubai, UAE',        desig: 'CEO',               sigEmail: 'mo.futtaim@citycare.ae',           sigMobile: '+971 50 111 2233', eid: 'emirates_id_mo.pdf',       passport: 'passport_mo.pdf',       sigProof: 'board_resolution.pdf'   },
      { company: 'Wellness Dental Center',    contact: 'Dr. Sarah Al Rashid',     status: 'KYC Under Review',      manager: 'Sara Mohammed', tlNum: 'TL-2024-774522', tlExp: new Date('2025-12-15'), dhaNum: 'DHA-DN-20240875', vat: '100291456700003', emirate: 'Dubai',     phone: '+971 4 422 8800', cemail: 'info@wellnessdental.ae', web: 'www.wellnessdental.ae',     addr: 'Shop 12, Wellness Plaza, Jumeirah, Dubai, UAE',              desig: 'Medical Director',  sigEmail: 's.rashid@wellnessdental.ae',       sigMobile: '+971 55 222 3344', eid: 'emirates_id_sarah.pdf',    passport: 'passport_sarah.pdf',    sigProof: 'authority_letter.pdf'   },
      { company: 'Apex Healthcare Group',     contact: 'Dr. Ahmed Hassan',        status: 'KYC Approved',          manager: 'John Smith',    tlNum: 'TL-2025-900110', tlExp: new Date('2026-07-20'), dhaNum: 'DHA-GH-20250321', vat: '100419835200003', emirate: 'Abu Dhabi', phone: '+971 2 666 3300', cemail: 'admin@apexhealthcare.ae', web: 'www.apexhealthcare.ae',    addr: 'Floor 3, Apex Tower, Khalidiyah, Abu Dhabi, UAE',            desig: 'Managing Director', sigEmail: 'a.hassan@apexhealthcare.ae',        sigMobile: '+971 54 333 4455', eid: 'emirates_id_ahmed.pdf',    passport: 'passport_ahmed.pdf',    sigProof: 'moa_extract.pdf'        },
      { company: 'Oasis Pediatric Clinic',    contact: 'Dr. Fatima Al Zaabi',     status: 'Contract Sent',         manager: 'Layla Ibrahim', tlNum: 'TL-2025-551890', tlExp: new Date('2026-01-10'), dhaNum: 'DHA-PC-20251445', vat: '100382741200003', emirate: 'Sharjah',   phone: '+971 6 533 2200', cemail: 'oasis@pediatric.ae',     web: 'www.oasispediatric.ae',     addr: 'Ground Floor, Oasis Mall, Al Wahda, Sharjah, UAE',           desig: 'Chief Medical Officer', sigEmail: 'f.zaabi@oasispediatric.ae',      sigMobile: '+971 56 444 5566', eid: 'emirates_id_fatima.pdf',   passport: 'passport_fatima.pdf',   sigProof: 'authority_fatima.pdf'   },
      { company: 'Prime Physio Specialists',  contact: 'Dr. James Crawford',      status: 'Contract Signed',       manager: 'Ali Hassan',    tlNum: 'TL-2024-668401', tlExp: new Date('2025-11-30'), dhaNum: 'DHA-PH-20241008', vat: '100344219300003', emirate: 'Dubai',     phone: '+971 4 288 7700', cemail: 'prime@physio.ae',        web: 'www.primephysio.ae',        addr: 'Unit 501, Sports City Centre, Dubai Sports City, UAE',       desig: 'Director',          sigEmail: 'j.crawford@primephysio.ae',        sigMobile: '+971 50 555 6677', eid: 'emirates_id_james.pdf',    passport: 'passport_james.pdf',    sigProof: 'director_cert.pdf'      },
      { company: 'Luminous Eye Care Center',  contact: 'Dr. Nour Al Hamdan',      status: 'KYC Expired',           manager: 'Sara Mohammed', tlNum: 'TL-2023-441067', tlExp: new Date('2024-08-15'), dhaNum: 'DHA-EC-20230654', vat: '100267183400003', emirate: 'Dubai',     phone: '+971 4 311 9900', cemail: 'info@luminouseye.ae',    web: 'www.luminouseye.ae',        addr: 'Suite 302, Vision Building, Deira, Dubai, UAE',              desig: 'Chairman',          sigEmail: 'n.hamdan@luminouseye.ae',          sigMobile: '+971 55 666 7788', eid: 'emirates_id_nour.pdf',     passport: 'passport_nour.pdf',     sigProof: 'authority_nour.pdf',    fieldErrors: { tradeLicenseExpiry: 'Trade License expired on 15 Aug 2024 — renewal required before KYC approval.' } },
      { company: 'Sunrise Family Clinic',     contact: 'Dr. Khalid Al Mansoori',  status: 'Termination Requested', manager: 'John Smith',    tlNum: 'TL-2025-720033', tlExp: new Date('2026-05-22'), dhaNum: 'DHA-FC-20251263', vat: '100358924100003', emirate: 'Dubai',     phone: '+971 4 299 4400', cemail: 'sunrise@familyclinic.ae', web: 'www.sunrise.ae',           addr: 'Villa 14, Sunrise Complex, Al Qusais, Dubai, UAE',           desig: 'Medical Director',  sigEmail: 'k.mansoori@sunrise.ae',            sigMobile: '+971 54 777 8899', eid: 'emirates_id_khalid.pdf',   passport: 'passport_khalid.pdf',   sigProof: 'sig_auth_khalid.pdf',   terminationReason: 'Clinic closure — voluntary liquidation' },
      { company: 'Emirates Dermatology Hub',  contact: 'Dr. Priya Sharma',        status: 'KYC Submitted',         manager: 'Layla Ibrahim', tlNum: 'TL-2025-835700', tlExp: new Date('2026-09-30'), dhaNum: 'DHA-DH-20251587', vat: '100411237500003', emirate: 'Dubai',     phone: '+971 4 388 2200', cemail: 'info@emiratesderm.ae',   web: 'www.emiratesderm.ae',       addr: 'Unit 108, Dermis Tower, Bur Dubai, UAE',                     desig: 'CEO',               sigEmail: 'p.sharma@emiratesderm.ae',         sigMobile: '+971 56 888 9900', eid: 'emirates_id_priya.pdf',    passport: 'passport_priya.pdf',    sigProof: '',                      fieldErrors: { fileSignatureProof: 'Signature authority proof not uploaded — required for non-owner signatories.' } },
      { company: 'Horizon Orthopedics',       contact: 'Dr. Omar Al Suwaidi',     status: 'KYC Under Review',      manager: 'Ali Hassan',    tlNum: 'TL-2025-912345', tlExp: new Date('2026-06-15'), dhaNum: 'DHA-OH-20250923', vat: '100399874600003', emirate: 'Abu Dhabi', phone: '+971 2 444 5500', cemail: 'info@horizonortho.ae',   web: 'www.horizonortho.ae',       addr: 'Level 4, Ortho Centre, Corniche Road, Abu Dhabi, UAE',       desig: 'Director',          sigEmail: 'o.suwaidi@horizonortho.ae',        sigMobile: '+971 50 999 0011', eid: 'emirates_id_omar.pdf',     passport: 'passport_omar.pdf',     sigProof: 'authority_omar.pdf'     },
      { company: 'Vitality Women Clinic',     contact: 'Dr. Chen Wei',            status: 'Contract Sent',         manager: 'Sara Mohammed', tlNum: 'TL-2025-678923', tlExp: new Date('2026-02-28'), dhaNum: 'DHA-WC-20251334', vat: '100374612800003', emirate: 'Dubai',     phone: '+971 4 455 3300', cemail: 'vitality@women.ae',      web: 'www.vitalitywomen.ae',      addr: 'Suite 210, Ladies Wing, Healthcare City, Dubai, UAE',        desig: 'Managing Partner',  sigEmail: 'c.wei@vitalitywomen.ae',           sigMobile: '+971 55 100 2222', eid: 'emirates_id_chen.pdf',     passport: 'passport_chen.pdf',     sigProof: 'partnership_deed.pdf'   },
      { company: 'Harmony Psychiatry Center', contact: 'Dr. Isabella Ferrari',    status: 'KYC Expired',           manager: 'John Smith',    tlNum: 'TL-2023-554321', tlExp: new Date('2024-11-01'), dhaNum: 'DHA-MH-20230789', vat: '100280134500003', emirate: 'Sharjah',   phone: '+971 6 566 7700', cemail: 'harmony@psychiatry.ae',  web: 'www.harmony.ae',            addr: 'Block C, Health Hub, University City, Sharjah, UAE',         desig: 'Medical Director',  sigEmail: 'i.ferrari@harmony.ae',             sigMobile: '+971 54 200 3333', eid: 'emirates_id_isabella.pdf', passport: 'passport_isabella.pdf', sigProof: 'director_proof.pdf',    fieldErrors: { tradeLicenseExpiry: 'Trade License expired on 01 Nov 2024 — please renew before re-submission.' } },
      { company: 'Nightingale Medical Group', contact: 'Dr. Rashid Al Nuaimi',    status: 'Termination Requested', manager: 'Layla Ibrahim', tlNum: 'TL-2025-791456', tlExp: new Date('2026-04-30'), dhaNum: 'DHA-MG-20251778', vat: '100422983100003', emirate: 'Dubai',     phone: '+971 4 277 6600', cemail: 'info@nightingale.ae',    web: 'www.nightingale.ae',        addr: 'Tower 3, Medical Park, Al Garhoud, Dubai, UAE',              desig: 'CEO',               sigEmail: 'r.nuaimi@nightingale.ae',          sigMobile: '+971 56 300 4444', eid: 'emirates_id_rashid.pdf',   passport: 'passport_rashid.pdf',   sigProof: 'authority_rashid.pdf',  terminationReason: 'Merger with larger hospital network — account consolidation' },
      { company: 'Global Smiles Dental',      contact: 'Dr. Ananya Patel',        status: 'Contract Signed',       manager: 'Ali Hassan',    tlNum: 'TL-2025-867234', tlExp: new Date('2026-08-31'), dhaNum: 'DHA-DN-20251456', vat: '100407316200003', emirate: 'Dubai',     phone: '+971 4 366 8900', cemail: 'smiles@global.ae',       web: 'www.globalsmiles.ae',       addr: 'Unit 301, Smile Centre, Mirdif, Dubai, UAE',                 desig: 'Managing Director', sigEmail: 'a.patel@globalsmiles.ae',          sigMobile: '+971 55 400 5555', eid: 'emirates_id_ananya.pdf',   passport: 'passport_ananya.pdf',   sigProof: 'director_resolution.pdf' },
      { company: 'Aura Aesthetics & Laser',   contact: 'Dr. Carlos Mendez',       status: 'KYC Approved',          manager: 'Sara Mohammed', tlNum: 'TL-2025-743678', tlExp: new Date('2026-10-15'), dhaNum: 'DHA-AS-20251234', vat: '100388527300003', emirate: 'Dubai',     phone: '+971 4 344 7700', cemail: 'aura@aesthetics.ae',     web: 'www.auraaesthetics.ae',     addr: 'Floor 5, Aura Building, DIFC, Dubai, UAE',                   desig: 'Director',          sigEmail: 'c.mendez@auraaesthetics.ae',       sigMobile: '+971 56 500 6666', eid: 'emirates_id_carlos.pdf',   passport: 'passport_carlos.pdf',   sigProof: 'power_of_attorney.pdf'  },
      { company: 'Crescent Urgent Care',      contact: 'Dr. Aisha Al Marzouqi',   status: 'Termination Approved',  manager: 'John Smith',    tlNum: 'TL-2024-634890', tlExp: new Date('2025-06-30'), dhaNum: 'DHA-UC-20241567', vat: '100362748900003', emirate: 'Ajman',     phone: '+971 6 744 3300', cemail: 'crescent@urgentcare.ae', web: 'www.crescenturgentcare.ae', addr: 'Block 2, Crescent Tower, Ajman Uptown, Ajman, UAE',          desig: 'Medical Director',  sigEmail: 'a.marzouqi@crescenturgentcare.ae', sigMobile: '+971 56 700 7777', eid: 'emirates_id_aisha.pdf',    passport: 'passport_aisha.pdf',    sigProof: 'director_cert_aisha.pdf', terminationReason: 'Loss of Healthcare Authority License' },
    ];

    const DAY = 86_400_000;

    this.customers = seed.map((row, i) => {
      const isExpired     = row.status === 'KYC Expired';
      const isTermination = row.status === 'Termination Requested' || row.status === 'Termination Approved';
      return {
        id:                   i + 1,
        companyName:          row.company,
        customerName:         row.contact,
        status:               row.status,
        nextAction:           nextActionMap[row.status],
        kycExpiryDate:        isExpired
                                ? new Date(Date.now() - (i + 1) * 4 * DAY)
                                : new Date(Date.now() + (180 - i * 8) * DAY),
        terminationDate:      isTermination ? new Date(Date.now() - (i % 5 + 1) * 6 * DAY) : null,
        salesPerson:          row.manager,
        kycExpired:           isExpired,
        terminationReason:    row.terminationReason,
        contractHistory:      this.buildContractHistory(row.status, i),
        tradeLicenseNumber:   row.tlNum,
        tradeLicenseExpiry:   row.tlExp,
        dhaLicenseNumber:     row.dhaNum,
        vatTrnNumber:         row.vat,
        emirate:              row.emirate,
        clinicPhone:          row.phone,
        clinicEmail:          row.cemail,
        website:              row.web,
        registeredAddress:    row.addr,
        signatoryDesignation: row.desig,
        signatoryEmail:       row.sigEmail,
        signatoryMobile:      row.sigMobile,
        fileEmiratiesId:      row.eid,
        filePassport:         row.passport,
        fileSignatureProof:   row.sigProof,
        fieldErrors:          row.fieldErrors,
      };
    });
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
    let filtered = this.customers;

    // 1. Text Search Filter
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c =>
        (c.companyName && c.companyName.toLowerCase().includes(query)) ||
        (c.customerName && c.customerName.toLowerCase().includes(query)) ||
        (c.clinicEmail && c.clinicEmail.toLowerCase().includes(query)) ||
        (c.salesPerson && c.salesPerson.toLowerCase().includes(query)) ||
        (c.nextAction && c.nextAction.toLowerCase().includes(query))
      );
    }

    // 2. Status MultiSelect Filter
    if (this.selectedStatuses && this.selectedStatuses.length > 0) {
      filtered = filtered.filter(c => this.selectedStatuses.includes(c.status));
    }

    // 3. Date / Month Dropdown Filter
    if (this.selectedDateFilters && this.selectedDateFilters.length > 0) {
      filtered = filtered.filter(c => {
        const date = c.terminationDate || c.kycExpiryDate || c.tradeLicenseExpiry;
        return this.matchDateFilters(date, this.selectedDateFilters);
      });
    }

    this.gridData = process(filtered, this.gridState) as { data: CustomerRecord[]; total: number };
  }

  refreshGrid(): void {
    this.applyFilter();
  }

  onStateChange(state: DataStateChangeEvent): void {
    this.gridState = state;
    this.refreshGrid();
  }

  // ── Computed Metrics ───────────────────────────────────────────────────────

  // KYC
  get kycUnderReviewCount()  { return this.customers.filter(c => ['KYC Submitted', 'KYC Under Review'].includes(c.status)).length; }
  get kycApprovedCount()     { return this.customers.filter(c => c.status === 'KYC Approved').length; }
  get expiredKycCount()      { return this.customers.filter(c => c.kycExpired).length; }
  /** All customers currently in the KYC pipeline (not yet on a contract or terminated) */
  get kycPipelineTotal()     { return this.customers.filter(c => ['KYC Pending','KYC Form Sent','KYC Submitted','KYC Under Review','KYC Approved','KYC Expired'].includes(c.status)).length; }

  // Contracts
  get contractsActiveSigned()  { return this.customers.filter(c => c.status === 'Contract Signed').length; }
  get pendingSigCount()        { return this.customers.filter(c => c.status === 'Contract Sent').length; }
  get contractsReadyDispatch() { return this.customers.filter(c => c.status === 'KYC Approved').length; }
  /** Active contracts: signed + awaiting signature */
  get contractsTotal()         { return this.contractsActiveSigned + this.pendingSigCount; }

  // Terminations
  get terminationCount()          { return this.customers.filter(c => c.status === 'Termination Requested').length; }
  get terminationApprovedCount()  { return this.customers.filter(c => c.status === 'Termination Approved').length; }
  get terminationTotalActive()    { return this.customers.filter(c => ['Termination Requested','Termination Approved'].includes(c.status)).length; }

  // ── Status Helpers ─────────────────────────────────────────────────────────
  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'KYC Submitted':         'badge-info',
      'KYC Under Review':      'badge-warning',
      'KYC Approved':          'badge-success',
      'Contract Sent':         'badge-primary',
      'Contract Signed':       'badge-success',
      'KYC Expired':           'badge-danger',
      'Termination Requested': 'badge-danger',
      'Termination Approved':  'badge-secondary',
    };
    return map[status] ?? 'badge-secondary';
  }

  isKycReviewable     = (s: string) => ['KYC Submitted', 'KYC Under Review'].includes(s);
  isTerminationStatus = (s: string) => ['Termination Requested', 'Termination Approved'].includes(s);
  isContractSent      = (s: string) => s === 'Contract Sent';
  isContractSigned    = (s: string) => s === 'Contract Signed';

  // ── Bulk KYC Renewal ───────────────────────────────────────────────────────
  get selectedExpiredCount(): number {
    return this.customers.filter(c => this.selectedKeys.includes(c.id) && c.kycExpired).length;
  }

  bulkSendKycRenewal(): void {
    const targets = this.customers.filter(c => this.selectedKeys.includes(c.id) && c.kycExpired);
    if (!targets.length) { return; }
    alert(`KYC Renewal emails dispatched to ${targets.length} customer(s):\n\n${targets.map(c => `• ${c.companyName}`).join('\n')}`);
    this.selectedKeys = [];
  }

  sendIndividualKycRenewal(cust: CustomerRecord | null): void {
    if (!cust) { return; }
    alert(`KYC Renewal email dispatched to:\n\n• ${cust.companyName}`);
  }

  // ── KYC Approval Dialog ────────────────────────────────────────────────────
  kycDialogOpen    = false;
  kycReviewerNotes = '';
  selectedCustomer: CustomerRecord | null = null;

  kycDocuments: KycDocument[] = [
    { name: 'Medical Practice License',      fileType: 'PDF', uploadedOn: new Date('2025-03-15'), icon: 'fas fa-file-medical' },
    { name: 'Health Authority Registration', fileType: 'PDF', uploadedOn: new Date('2025-03-14'), icon: 'fas fa-hospital' },
    { name: 'Doctor ID / Passport',          fileType: 'PDF', uploadedOn: new Date('2025-03-13'), icon: 'fas fa-user-md' },
    { name: 'Facility Operating License',    fileType: 'JPG', uploadedOn: new Date('2025-03-12'), icon: 'fas fa-certificate' },
  ];

  openKycDialog(customer: CustomerRecord): void {
    this.selectedCustomer = { ...customer };
    this.kycDialogOpen    = true;
  }

  closeKycDialog(): void {
    this.kycDialogOpen      = false;
    this.selectedCustomer   = null;
    this.kycReviewerNotes   = '';
  }

  approveKyc(): void {
    this._patch(this.selectedCustomer?.id, { status: 'KYC Approved', nextAction: 'Send Contract', kycExpired: false });
    this.closeKycDialog();
  }

  rejectKyc(): void {
    this._patch(this.selectedCustomer?.id, { status: 'KYC Submitted', nextAction: 'Review Documents' });
    this.closeKycDialog();
  }

  requestCorrection(): void {
    this._patch(this.selectedCustomer?.id, { nextAction: 'Correction Requested' });
    this.closeKycDialog();
  }

  resendKyc(): void {
    this._patch(this.selectedCustomer?.id, { status: 'KYC Submitted', nextAction: 'Review Documents' });
    this.closeKycDialog();
  }

  // ── Termination Slide Panel ────────────────────────────────────────────────
  terminationPanelOpen = false;

  openTerminationPanel(customer: CustomerRecord): void {
    this.selectedCustomer    = { ...customer };
    this.terminationPanelOpen = true;
  }

  closeTerminationPanel(): void {
    this.terminationPanelOpen = false;
    this.selectedCustomer     = null;
  }

  onTerminationApproved(): void {
    this._patch(this.selectedCustomer?.id, { status: 'Termination Approved', nextAction: 'Complete Handover' });
    this.closeTerminationPanel();
  }

  onTerminationCallOff(_event: { remark: string }): void {
    // remark is available in _event.remark — write to audit log when backend is wired
    this._patch(this.selectedCustomer?.id, {
      status:            'Contract Signed',
      nextAction:        'Active — Monitor',
      terminationDate:   null,
      terminationReason: undefined,
    });
    this.closeTerminationPanel();
  }

  // ── Action Panel (Slide from Right) ────────────────────────────────────────
  actionPanelOpen = false;
  actionPanelType: 'kyc-expired' | 'termination' | null = null;
  actionPanelCustomer: CustomerRecord | null = null;

  openActionPanel(cust: CustomerRecord, type: 'kyc-expired' | 'termination'): void {
    this.actionPanelCustomer = cust;
    this.selectedCustomer = cust;
    this.actionPanelType = type;
    this.actionPanelOpen = true;
  }

  closeActionPanel(): void {
    this.actionPanelOpen = false;
    setTimeout(() => {
      this.actionPanelCustomer = null;
      this.actionPanelType = null;
    }, 300);
  }

  // ── Contract Preview Panel ────────────────────────────────────────────────
  contractPanelOpen = false;
  contractPanelCustomer: CustomerRecord | null = null;
  selectedContractIdx = 0;

  get selectedContract(): ContractVersion | null {
    if (!this.contractPanelCustomer?.contractHistory?.length) return null;
    return this.contractPanelCustomer.contractHistory[this.selectedContractIdx] ?? null;
  }

  openContractPanel(customer: CustomerRecord): void {
    this.contractPanelCustomer = { ...customer };
    const history = customer.contractHistory ?? [];
    this.selectedContractIdx = Math.max(0, history.length - 1);
    this.contractPanelOpen = true;
  }

  closeContractPanel(): void {
    this.contractPanelOpen = false;
    this.contractPanelCustomer = null;
  }

  private buildContractHistory(status: string, idx: number): ContractVersion[] | undefined {
    if (status !== 'Contract Sent' && status !== 'Contract Signed') return undefined;
    const DAY = 86_400_000;
    const now = Date.now();
    const prevCount = idx % 2 === 0 ? 2 : 1;
    const versions: ContractVersion[] = [];

    for (let v = 1; v <= prevCount; v++) {
      const start = new Date(now - (prevCount - v + 1) * 400 * DAY);
      const end   = new Date(start.getTime() + 365 * DAY);
      versions.push({
        ref:         `ZC-${start.getFullYear()}-${String(idx * 3 + v).padStart(3, '0')}`,
        version:     v,
        startDate:   start,
        endDate:     end,
        status:      'expired',
        annualValue: `AED ${42 + idx + v},000`,
      });
    }

    const currentStart = new Date(now - 90 * DAY);
    const currentEnd   = new Date(currentStart.getTime() + 365 * DAY);
    versions.push({
      ref:         `ZC-${currentStart.getFullYear()}-${String(idx * 3 + prevCount + 1).padStart(3, '0')}`,
      version:     prevCount + 1,
      startDate:   currentStart,
      endDate:     currentEnd,
      status:      status === 'Contract Signed' ? 'active' : 'pending',
      annualValue: `AED ${48 + idx * 2},000`,
    });

    return versions;
  }

  private _patch(id: number | undefined, patch: Partial<CustomerRecord>): void {
    if (id == null) { return; }
    const rec = this.customers.find(c => c.id === id);
    if (rec) { Object.assign(rec, patch); this.refreshGrid(); }
  }

  // ── New KYC Request Panel ──────────────────────────────────────────────────
  newKycPanelOpen = false;

  newKycForm = {
    legalClinicName: '',
    tradeLicenseNumber: '',
    tradeLicenseExpiry: '',
    dhaLicenseNumber: '',
    vatTrnNumber: '',
    registeredAddress: '',
    emirate: '',
    clinicEmail: '',
    clinicPhone: '',
    website: '',
    signatoryName: '',
    signatoryDesignation: '',
    signatoryEmail: '',
    signatoryMobile: '',
    fileEmiratiesId: '',
    filePassport: '',
    fileSignatureProof: '',
    fileTradeLicense: '',
    fileDhaLicense: '',
    fileEmiratiesIdCopies: '',
    filePassportCopies: '',
    fileVatCert: '',
    fileAddressProof: '',
    fileCompanyStamp: '',
  };

  openNewKycPanel(): void {
    Object.keys(this.newKycForm).forEach(k => ((this.newKycForm as Record<string, string>)[k] = ''));
    this.newKycPanelOpen = true;
  }

  closeNewKycPanel(): void {
    this.newKycPanelOpen = false;
  }

  submitNewKyc(): void {
    this.closeNewKycPanel();
  }

  onFileSelect(field: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      (this.newKycForm as Record<string, string>)[field] = input.files[0].name;
    }
  }
}
