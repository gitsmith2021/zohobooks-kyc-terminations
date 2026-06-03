import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';

// ── Data Interfaces ────────────────────────────────────────────────────────────
export interface KycPoc {
  role: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  remarks?: string;
}

export interface UkfFormData {
  // Customer Information
  companyName: string;
  registeredAddress: string;
  vatTrnNumber: string;
  // Trade License
  tradeLicenseNumber: string;
  tradeLicenseAuthority: string;
  tradeLicenseSigningAuth: string;
  tradeLicenseIssueDate: string;
  tradeLicenseExpiry: string;
  // Contact Persons
  pocs: KycPoc[];
  // Documents
  fileDhaLicense: string;
  fileTradeLicense: string;
  fileVatCertificate: string;
}

export type UkfSubmissionStatus = 'Approved' | 'Under Review' | 'Re-submission' | 'Archived';

export interface UkfSubmission {
  id: string;
  version: string;
  formName: string;
  submittedOn: Date;
  reviewedOn?: Date;
  status: UkfSubmissionStatus;
  formData: UkfFormData;
}

export interface UkfCustomer {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  mobile: string;
  status: string;
  submissions: UkfSubmission[];
}

// ── Component ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-user-kyc-forms',
  standalone: true,
  imports: [DatePipe, FormsModule, ButtonModule],
  templateUrl: './user-kyc-forms.component.html',
  styleUrls: ['./user-kyc-forms.component.scss'],
})
export class UserKycFormsComponent implements OnInit {

  customerSearch = '';
  selectedCustomer: UkfCustomer | null = null;
  selectedSubmission: UkfSubmission | null = null;

  customers: UkfCustomer[] = [];

  ngOnInit(): void {
    this.customers = this.buildCustomers();
    // Pre-select first customer and latest submission for demo
    if (this.customers.length) {
      this.selectCustomer(this.customers[0]);
    }
  }

  // ── Selection ────────────────────────────────────────────────────────────────
  selectCustomer(cust: UkfCustomer): void {
    this.selectedCustomer = cust;
    this.selectedSubmission = null;
    if (cust.submissions.length) {
      this.selectSubmission(cust.submissions[0]);
    }
  }

  selectSubmission(sub: UkfSubmission): void {
    this.selectedSubmission = sub;
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  get filteredCustomers(): UkfCustomer[] {
    const q = this.customerSearch.trim().toLowerCase();
    if (!q) return this.customers;
    return this.customers.filter(c =>
      c.companyName.toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }

  // ── Badge helpers ─────────────────────────────────────────────────────────────
  getCustStatusClass(cust: UkfCustomer): string {
    const approved = cust.submissions.some(s => s.status === 'Approved');
    const review   = cust.submissions.some(s => s.status === 'Under Review');
    const resub    = cust.submissions.some(s => s.status === 'Re-submission');
    if (approved) return 'ukf-badge--approved';
    if (resub)    return 'ukf-badge--resub';
    if (review)   return 'ukf-badge--review';
    return 'ukf-badge--neutral';
  }

  getSubStatusClass(status: UkfSubmissionStatus): string {
    const map: Record<UkfSubmissionStatus, string> = {
      'Approved':      'ukf-badge--approved',
      'Under Review':  'ukf-badge--review',
      'Re-submission': 'ukf-badge--resub',
      'Archived':      'ukf-badge--archived',
    };
    return map[status];
  }

  getSubStatusIcon(status: UkfSubmissionStatus): string {
    const map: Record<UkfSubmissionStatus, string> = {
      'Approved':      'fas fa-check-circle',
      'Under Review':  'fas fa-search',
      'Re-submission': 'fas fa-redo',
      'Archived':      'fas fa-archive',
    };
    return map[status];
  }

  // ── Document Preview Panel ───────────────────────────────────────────────────
  docPreviewOpen      = false;
  docPreviewLabel     = '';
  docPreviewFilename  = '';

  openDocPreview(label: string, filename: string): void {
    this.docPreviewLabel    = label;
    this.docPreviewFilename = filename;
    this.docPreviewOpen     = true;
  }

  closeDocPreview(): void {
    this.docPreviewOpen = false;
  }

  // ── Download ─────────────────────────────────────────────────────────────────
  downloadPdf(): void {
    window.print();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  hasDoc(filename: string): boolean {
    return !!filename?.trim();
  }

  latestApprovedSubmission(cust: UkfCustomer): UkfSubmission | undefined {
    return cust.submissions.find(s => s.status === 'Approved');
  }

  // ── Mock Data ─────────────────────────────────────────────────────────────────
  private buildCustomers(): UkfCustomer[] {
    const pocSet = (
      sigName: string, sigDesig: string, sigEmail: string, sigPhone: string,
      domain: string
    ): KycPoc[] => [
      { role: 'Authorized Signatory', name: sigName, designation: sigDesig, email: sigEmail, phone: sigPhone,
        remarks: 'Contracts will be shared with this contact.' },
      { role: 'Implementation POC', name: 'John Smith', designation: 'IT Manager', email: `impl@${domain}`, phone: '+971 4 331 1111',
        remarks: 'Responsible for patient master and initial setup data.' },
      { role: 'Operations POC', name: 'Sarah Connor', designation: 'Clinic Manager', email: `ops@${domain}`, phone: '+971 4 331 2222',
        remarks: 'User access and menu enable/disable.' },
      { role: 'Accounts POC', name: 'Bruce Wayne', designation: 'Finance Manager', email: `finance@${domain}`, phone: '+971 4 331 3333',
        remarks: 'Invoice queries and subscription renewal.' },
      { role: 'Compliance POC', name: 'Diana Prince', designation: 'Compliance Officer', email: `compliance@${domain}`, phone: '+971 4 331 4444',
        remarks: 'Malaffi / Riayati / Nabidh coordination.' },
    ];

    return [
      {
        id: 1,
        companyName: 'Al Zahra Medical Centre',
        contactName: 'Dr. Fatima Al Mansouri',
        email: 'info@alzahra.ae',
        mobile: '+971 4 331 2345',
        status: 'Approved',
        submissions: [
          {
            id: 's1-v100',
            version: 'v1.0.0',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2026-01-10'),
            reviewedOn: new Date('2026-01-15'),
            status: 'Approved',
            formData: {
              companyName: 'Al Zahra Medical Centre',
              registeredAddress: 'Al Zahra Bldg, Al Barsha, Dubai, UAE',
              vatTrnNumber: '100100001200003',
              tradeLicenseNumber: 'TL-2025-100001',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Fatima Al Mansouri',
              tradeLicenseIssueDate: '01/09/2024',
              tradeLicenseExpiry: '31/08/2026',
              pocs: pocSet('Dr. Fatima Al Mansouri', 'Director', 'f.mansouri@alzahra.ae', '+971 4 331 2345', 'alzahra.ae'),
              fileDhaLicense: 'dha_license_alzahra.pdf',
              fileTradeLicense: 'trade_license_alzahra.pdf',
              fileVatCertificate: 'vat_certificate_alzahra.pdf',
            },
          },
          {
            id: 's1-v095',
            version: 'v0.9.5',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2025-11-05'),
            reviewedOn: new Date('2025-11-12'),
            status: 'Archived',
            formData: {
              companyName: 'Al Zahra Medical Centre',
              registeredAddress: 'Al Zahra Bldg, Al Barsha, Dubai, UAE',
              vatTrnNumber: '100100001200003',
              tradeLicenseNumber: 'TL-2024-100001',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Fatima Al Mansouri',
              tradeLicenseIssueDate: '01/09/2023',
              tradeLicenseExpiry: '31/08/2025',
              pocs: pocSet('Dr. Fatima Al Mansouri', 'Director', 'f.mansouri@alzahra.ae', '+971 4 331 2345', 'alzahra.ae'),
              fileDhaLicense: 'dha_license_alzahra_v095.pdf',
              fileTradeLicense: 'trade_license_alzahra_v095.pdf',
              fileVatCertificate: 'vat_certificate_alzahra_v095.pdf',
            },
          },
          {
            id: 's1-v090',
            version: 'v0.9.0',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2025-08-20'),
            status: 'Archived',
            formData: {
              companyName: 'Al Zahra Medical Centre',
              registeredAddress: 'Al Zahra Bldg, Al Barsha, Dubai, UAE',
              vatTrnNumber: '',
              tradeLicenseNumber: 'TL-2023-100001',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Fatima Al Mansouri',
              tradeLicenseIssueDate: '01/09/2022',
              tradeLicenseExpiry: '31/08/2024',
              pocs: pocSet('Dr. Fatima Al Mansouri', 'Director', 'f.mansouri@alzahra.ae', '+971 4 331 2345', 'alzahra.ae'),
              fileDhaLicense: 'dha_license_alzahra_v090.pdf',
              fileTradeLicense: 'trade_license_alzahra_v090.pdf',
              fileVatCertificate: '',
            },
          },
        ],
      },
      {
        id: 2,
        companyName: 'Gulf International Cancer Centre',
        contactName: 'Dr. Mahmoud Al Rashdi',
        email: 'info@gicc.ae',
        mobile: '+971 4 434 4488',
        status: 'Under Review',
        submissions: [
          {
            id: 's2-v100',
            version: 'v1.0.0',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2026-03-15'),
            status: 'Under Review',
            formData: {
              companyName: 'Gulf International Cancer Centre',
              registeredAddress: 'DHCC, Dubai, UAE',
              vatTrnNumber: '',
              tradeLicenseNumber: 'TL-2025-400001',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Mahmoud Al Rashdi',
              tradeLicenseIssueDate: '01/09/2024',
              tradeLicenseExpiry: '31/08/2026',
              pocs: pocSet('Dr. Mahmoud Al Rashdi', 'Director', 'm.rashdi@gicc.ae', '+971 4 434 4488', 'gicc.ae'),
              fileDhaLicense: 'dha_license_gicc.pdf',
              fileTradeLicense: 'trade_license_gicc.pdf',
              fileVatCertificate: '',
            },
          },
          {
            id: 's2-v095',
            version: 'v0.9.5',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2025-10-08'),
            status: 'Archived',
            formData: {
              companyName: 'Gulf International Cancer Centre',
              registeredAddress: 'DHCC, Dubai, UAE',
              vatTrnNumber: '',
              tradeLicenseNumber: 'TL-2024-400001',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Mahmoud Al Rashdi',
              tradeLicenseIssueDate: '01/09/2023',
              tradeLicenseExpiry: '31/08/2025',
              pocs: pocSet('Dr. Mahmoud Al Rashdi', 'Director', 'm.rashdi@gicc.ae', '+971 4 434 4488', 'gicc.ae'),
              fileDhaLicense: 'dha_license_gicc_old.pdf',
              fileTradeLicense: 'trade_license_gicc_old.pdf',
              fileVatCertificate: '',
            },
          },
        ],
      },
      {
        id: 3,
        companyName: 'Medeor 24x7 Hospital Dubai',
        contactName: 'Dr. Suresh Babu',
        email: 'info@medeor.ae',
        mobile: '+971 4 752 4700',
        status: 'Re-submission',
        submissions: [
          {
            id: 's3-v100',
            version: 'v1.0.0',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2026-03-20'),
            status: 'Re-submission',
            formData: {
              companyName: 'Medeor 24x7 Hospital Dubai',
              registeredAddress: 'Al Qusais, Dubai, UAE',
              vatTrnNumber: '10040000220000',
              tradeLicenseNumber: 'TL-2025-400003',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Suresh Babu',
              tradeLicenseIssueDate: '01/10/2024',
              tradeLicenseExpiry: '30/09/2026',
              pocs: pocSet('Dr. Suresh Babu', 'Director', 's.babu@medeor.ae', '+971 4 752 4700', 'medeor.ae'),
              fileDhaLicense: 'dha_license_medeor.pdf',
              fileTradeLicense: 'trade_license_medeor.pdf',
              fileVatCertificate: '',
            },
          },
          {
            id: 's3-v095',
            version: 'v0.9.5',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2026-01-10'),
            status: 'Archived',
            formData: {
              companyName: 'Medeor 24x7 Hospital Dubai',
              registeredAddress: 'Al Qusais, Dubai, UAE',
              vatTrnNumber: '',
              tradeLicenseNumber: 'TL-2024-400003',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Suresh Babu',
              tradeLicenseIssueDate: '01/10/2023',
              tradeLicenseExpiry: '30/09/2025',
              pocs: pocSet('Dr. Suresh Babu', 'Director', 's.babu@medeor.ae', '+971 4 752 4700', 'medeor.ae'),
              fileDhaLicense: 'dha_license_medeor_old.pdf',
              fileTradeLicense: 'trade_license_medeor_old.pdf',
              fileVatCertificate: '',
            },
          },
        ],
      },
      {
        id: 4,
        companyName: 'Emirates Hospital Jumeirah',
        contactName: 'Dr. Hana Al Shamsi',
        email: 'info@emirateshospital.ae',
        mobile: '+971 4 349 6666',
        status: 'Approved',
        submissions: [
          {
            id: 's4-v100',
            version: 'v1.0.0',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2025-12-01'),
            reviewedOn: new Date('2025-12-08'),
            status: 'Approved',
            formData: {
              companyName: 'Emirates Hospital Jumeirah',
              registeredAddress: 'Jumeirah Beach Rd, Jumeirah, Dubai, UAE',
              vatTrnNumber: '100100007200003',
              tradeLicenseNumber: 'TL-2025-100007',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Hana Al Shamsi',
              tradeLicenseIssueDate: '01/12/2024',
              tradeLicenseExpiry: '30/11/2026',
              pocs: pocSet('Dr. Hana Al Shamsi', 'Medical Director', 'h.shamsi@emirateshospital.ae', '+971 4 349 6666', 'emirateshospital.ae'),
              fileDhaLicense: 'dha_license_eh.pdf',
              fileTradeLicense: 'trade_license_eh.pdf',
              fileVatCertificate: 'vat_certificate_eh.pdf',
            },
          },
          {
            id: 's4-v095',
            version: 'v0.9.5',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2025-08-05'),
            status: 'Archived',
            formData: {
              companyName: 'Emirates Hospital Jumeirah',
              registeredAddress: 'Jumeirah Beach Rd, Jumeirah, Dubai, UAE',
              vatTrnNumber: '100100007200003',
              tradeLicenseNumber: 'TL-2024-100007',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Hana Al Shamsi',
              tradeLicenseIssueDate: '01/12/2023',
              tradeLicenseExpiry: '30/11/2025',
              pocs: pocSet('Dr. Hana Al Shamsi', 'Medical Director', 'h.shamsi@emirateshospital.ae', '+971 4 349 6666', 'emirateshospital.ae'),
              fileDhaLicense: 'dha_license_eh_old.pdf',
              fileTradeLicense: 'trade_license_eh_old.pdf',
              fileVatCertificate: 'vat_certificate_eh_old.pdf',
            },
          },
          {
            id: 's4-v090',
            version: 'v0.9.0',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2025-05-20'),
            status: 'Archived',
            formData: {
              companyName: 'Emirates Hospital Jumeirah',
              registeredAddress: 'Jumeirah Beach Rd, Jumeirah, Dubai, UAE',
              vatTrnNumber: '100100007200003',
              tradeLicenseNumber: 'TL-2023-100007',
              tradeLicenseAuthority: 'Dubai Economy (DED)',
              tradeLicenseSigningAuth: 'Dr. Hana Al Shamsi',
              tradeLicenseIssueDate: '01/12/2022',
              tradeLicenseExpiry: '30/11/2024',
              pocs: pocSet('Dr. Hana Al Shamsi', 'Medical Director', 'h.shamsi@emirateshospital.ae', '+971 4 349 6666', 'emirateshospital.ae'),
              fileDhaLicense: 'dha_license_eh_v090.pdf',
              fileTradeLicense: 'trade_license_eh_v090.pdf',
              fileVatCertificate: '',
            },
          },
        ],
      },
      {
        id: 5,
        companyName: 'Burjeel Hospital Abu Dhabi',
        contactName: 'Dr. Yousuf Al Dhaheri',
        email: 'info@burjeel.com',
        mobile: '+971 2 508 5555',
        status: 'Approved',
        submissions: [
          {
            id: 's5-v100',
            version: 'v1.0.0',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2025-12-15'),
            reviewedOn: new Date('2025-12-22'),
            status: 'Approved',
            formData: {
              companyName: 'Burjeel Hospital Abu Dhabi',
              registeredAddress: 'Muroor Road, Abu Dhabi, UAE',
              vatTrnNumber: '100100009200003',
              tradeLicenseNumber: 'TL-2025-100009',
              tradeLicenseAuthority: 'ADGM',
              tradeLicenseSigningAuth: 'Dr. Yousuf Al Dhaheri',
              tradeLicenseIssueDate: '01/01/2025',
              tradeLicenseExpiry: '31/12/2026',
              pocs: pocSet('Dr. Yousuf Al Dhaheri', 'Managing Director', 'y.dhaheri@burjeel.com', '+971 2 508 5555', 'burjeel.com'),
              fileDhaLicense: 'dha_license_burjeel.pdf',
              fileTradeLicense: 'trade_license_burjeel.pdf',
              fileVatCertificate: 'vat_certificate_burjeel.pdf',
            },
          },
          {
            id: 's5-v095',
            version: 'v0.9.5',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2025-09-01'),
            status: 'Archived',
            formData: {
              companyName: 'Burjeel Hospital Abu Dhabi',
              registeredAddress: 'Muroor Road, Abu Dhabi, UAE',
              vatTrnNumber: '100100009200003',
              tradeLicenseNumber: 'TL-2024-100009',
              tradeLicenseAuthority: 'ADGM',
              tradeLicenseSigningAuth: 'Dr. Yousuf Al Dhaheri',
              tradeLicenseIssueDate: '01/01/2024',
              tradeLicenseExpiry: '31/12/2025',
              pocs: pocSet('Dr. Yousuf Al Dhaheri', 'Managing Director', 'y.dhaheri@burjeel.com', '+971 2 508 5555', 'burjeel.com'),
              fileDhaLicense: 'dha_license_burjeel_old.pdf',
              fileTradeLicense: 'trade_license_burjeel_old.pdf',
              fileVatCertificate: 'vat_certificate_burjeel_old.pdf',
            },
          },
        ],
      },
      {
        id: 6,
        companyName: 'NMC Royal Hospital',
        contactName: 'Dr. Mohammed Al Kaabi',
        email: 'info@nmcroyal.ae',
        mobile: '+971 2 626 5555',
        status: 'Approved',
        submissions: [
          {
            id: 's6-v100',
            version: 'v1.0.0',
            formName: 'Standard Clinic KYC Form',
            submittedOn: new Date('2026-02-10'),
            reviewedOn: new Date('2026-02-18'),
            status: 'Approved',
            formData: {
              companyName: 'NMC Royal Hospital',
              registeredAddress: 'Airport Road, Khalidiyah, Abu Dhabi, UAE',
              vatTrnNumber: '100100006200003',
              tradeLicenseNumber: 'TL-2025-100006',
              tradeLicenseAuthority: 'ADGM',
              tradeLicenseSigningAuth: 'Dr. Mohammed Al Kaabi',
              tradeLicenseIssueDate: '01/07/2024',
              tradeLicenseExpiry: '30/06/2026',
              pocs: pocSet('Dr. Mohammed Al Kaabi', 'Chairman', 'm.kaabi@nmcroyal.ae', '+971 2 626 5555', 'nmcroyal.ae'),
              fileDhaLicense: 'dha_license_nmc.pdf',
              fileTradeLicense: 'trade_license_nmc.pdf',
              fileVatCertificate: 'vat_certificate_nmc.pdf',
            },
          },
        ],
      },
    ];
  }
}
