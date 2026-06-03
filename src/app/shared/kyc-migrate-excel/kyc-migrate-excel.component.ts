import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GridModule } from '@progress/kendo-angular-grid';
import { ButtonModule } from '@progress/kendo-angular-buttons';

export interface MigrateRow {
  rowId: number;
  // Basic Info
  clinicName: string;
  contactName: string;
  email: string;
  mobile: string;
  // Registered Details
  registeredAddress: string;
  vatTrnNumber: string;
  // Trade License
  tradeLicenseNumber: string;
  tradeLicenseAuthority: string;
  tradeLicenseSigningAuth: string;
  tradeLicenseIssueDate: string;
  tradeLicenseExpiry: string;
  // Authorized Signatory
  signatoryDesignation: string;
  signatoryEmail: string;
  signatoryPhone: string;
  // Implementation POC
  implementationName: string;
  implementationEmail: string;
  implementationPhone: string;
  // Operations POC
  operationsName: string;
  operationsEmail: string;
  operationsPhone: string;
  // Accounts POC
  accountsName: string;
  accountsEmail: string;
  accountsPhone: string;
  // Compliance POC
  complianceName: string;
  complianceEmail: string;
  compliancePhone: string;
}

@Component({
  selector: 'app-kyc-migrate-excel',
  standalone: true,
  imports: [FormsModule, GridModule, ButtonModule],
  templateUrl: './kyc-migrate-excel.component.html',
  styleUrls: ['./kyc-migrate-excel.component.scss'],
})
export class KycMigrateExcelComponent {

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<MigrateRow[]>();

  selectedFile: File | null = null;
  isProcessing = false;
  processedRows: MigrateRow[] = [];
  hasProcessed = false;
  isDragOver = false;

  get gridData() {
    return { data: this.processedRows, total: this.processedRows.length };
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) this.setFile(file);
    input.value = '';
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file && this.isExcelFile(file)) this.setFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  private setFile(file: File): void {
    this.selectedFile = file;
    this.hasProcessed = false;
    this.processedRows = [];
  }

  private isExcelFile(file: File): boolean {
    return /\.(xlsx|xls|csv)$/i.test(file.name);
  }

  processData(): void {
    if (!this.selectedFile) return;
    this.isProcessing = true;
    this.hasProcessed = false;
    setTimeout(() => {
      this.processedRows = this.generateMockRows();
      this.hasProcessed = true;
      this.isProcessing = false;
    }, 120);
  }

  addRow(): void {
    const nextId = this.processedRows.length > 0
      ? Math.max(...this.processedRows.map(r => r.rowId)) + 1
      : 1;
    this.processedRows = [...this.processedRows, this.emptyRow(nextId)];
  }

  removeRow(rowId: number): void {
    this.processedRows = this.processedRows.filter(r => r.rowId !== rowId);
  }

  importData(): void {
    this.imported.emit([...this.processedRows]);
    this.onClose();
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  private readonly requiredFields = new Set<string>([
    'clinicName', 'contactName', 'email', 'mobile',
    'registeredAddress',
    'tradeLicenseNumber', 'tradeLicenseAuthority', 'tradeLicenseSigningAuth',
    'tradeLicenseIssueDate', 'tradeLicenseExpiry',
    'signatoryDesignation', 'signatoryEmail', 'signatoryPhone',
    'implementationName', 'implementationEmail', 'implementationPhone',
    'operationsName', 'operationsEmail', 'operationsPhone',
    'accountsName', 'accountsEmail', 'accountsPhone',
    'complianceName', 'complianceEmail', 'compliancePhone',
  ]);

  private readonly emailFields = new Set<string>([
    'email', 'signatoryEmail', 'implementationEmail',
    'operationsEmail', 'accountsEmail', 'complianceEmail',
  ]);

  private readonly dateFields = new Set<string>([
    'tradeLicenseIssueDate', 'tradeLicenseExpiry',
  ]);

  isFieldInvalid(value: string, fieldId: string): boolean {
    const v = (value ?? '').trim();
    if (this.requiredFields.has(fieldId) && !v) return true;
    if (!v) return false;
    if (this.emailFields.has(fieldId)) return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (this.dateFields.has(fieldId)) return !/^\d{2}\/\d{2}\/\d{4}$/.test(v);
    if (fieldId === 'vatTrnNumber') return !/^\d{15}$/.test(v);
    return false;
  }

  onClose(): void {
    this.closed.emit();
    this.selectedFile = null;
    this.processedRows = [];
    this.hasProcessed = false;
    this.isProcessing = false;
    this.isDragOver = false;
  }

  private emptyRow(rowId: number): MigrateRow {
    return {
      rowId,
      clinicName: '', contactName: '', email: '', mobile: '',
      registeredAddress: '', vatTrnNumber: '',
      tradeLicenseNumber: '', tradeLicenseAuthority: '',
      tradeLicenseSigningAuth: '', tradeLicenseIssueDate: '', tradeLicenseExpiry: '',
      signatoryDesignation: '', signatoryEmail: '', signatoryPhone: '',
      implementationName: '', implementationEmail: '', implementationPhone: '',
      operationsName: '', operationsEmail: '', operationsPhone: '',
      accountsName: '', accountsEmail: '', accountsPhone: '',
      complianceName: '', complianceEmail: '', compliancePhone: '',
    };
  }

  private generateMockRows(): MigrateRow[] {
    const seed = [
      { clinic: 'Sunrise Medical Centre',   contact: 'Dr. Aisha Rahman',    email: 'info@sunrise.ae',    mobile: '+971 4 123 4567', addr: 'Al Quoz, Dubai, UAE',           vat: '100700001200003', tlNum: 'TL-2025-700001', tlAuth: 'Dubai Economy (DED)', tlSign: 'Dr. Aisha Rahman',   tlIssue: '15/01/2024', tlExp: '14/01/2027', desig: 'Managing Director' },
      { clinic: 'Green Valley Clinic',      contact: 'Dr. Hamza Al Farsi',  email: 'contact@gvc.ae',     mobile: '+971 4 234 5678', addr: 'JLT, Dubai, UAE',               vat: '',               tlNum: 'TL-2025-700002', tlAuth: 'DED',                tlSign: 'Hamza Al Farsi',     tlIssue: '20/03/2024', tlExp: '19/03/2027', desig: 'Director' },
      { clinic: 'Crescent Health Hub',      contact: 'Dr. Priya Nair',      email: 'admin@crescent.ae',  mobile: '+971 2 345 6789', addr: 'Khalifa City A, Abu Dhabi, UAE',vat: '100700003200003', tlNum: 'TL-2025-700003', tlAuth: 'ADGM',               tlSign: 'Dr. Priya Nair',     tlIssue: '10/06/2024', tlExp: '09/06/2027', desig: 'Medical Director' },
      { clinic: 'Nova Specialist Clinic',   contact: 'Dr. Khaled Al Zaabi', email: 'info@novaclinic.ae', mobile: '+971 4 456 7890', addr: 'Al Barsha, Dubai, UAE',         vat: '100700004200003', tlNum: 'TL-2025-700004', tlAuth: 'Dubai Economy (DED)', tlSign: 'Dr. Khaled Al Zaabi', tlIssue: '01/02/2024', tlExp: '31/01/2027', desig: 'Chairman' },
      { clinic: 'MedFirst Polyclinic',      contact: 'Dr. Elena Vasquez',   email: 'info@medfirst.ae',   mobile: '+971 6 567 8901', addr: 'Al Qasimia, Sharjah, UAE',      vat: '100700005200003', tlNum: 'TL-2025-700005', tlAuth: 'SIRA',               tlSign: 'Elena Vasquez',      tlIssue: '05/04/2024', tlExp: '04/04/2027', desig: 'Director' },
    ];

    return seed.map((d, i) => {
      const domain = d.email.split('@')[1] ?? 'clinic.ae';
      return {
        rowId: i + 1,
        clinicName: d.clinic,
        contactName: d.contact,
        email: d.email,
        mobile: d.mobile,
        registeredAddress: d.addr,
        vatTrnNumber: d.vat,
        tradeLicenseNumber: d.tlNum,
        tradeLicenseAuthority: d.tlAuth,
        tradeLicenseSigningAuth: d.tlSign,
        tradeLicenseIssueDate: d.tlIssue,
        tradeLicenseExpiry: d.tlExp,
        signatoryDesignation: d.desig,
        signatoryEmail: d.email,
        signatoryPhone: d.mobile,
        implementationName: 'Implementation POC',
        implementationEmail: `impl@${domain}`,
        implementationPhone: d.mobile,
        operationsName: 'Operations POC',
        operationsEmail: `ops@${domain}`,
        operationsPhone: d.mobile,
        accountsName: 'Accounts POC',
        accountsEmail: `accounts@${domain}`,
        accountsPhone: d.mobile,
        complianceName: 'Compliance Officer',
        complianceEmail: `compliance@${domain}`,
        compliancePhone: d.mobile,
      };
    });
  }
}
