import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type CustomerFormValue = string | boolean;

interface PocTableConfig {
  rows: string[];
  columns: string[];
  rowRemarks?: string[];
}

interface CustomerFormField {
  id: string;
  label: string;
  type: string;
  enabled: boolean;
  required: boolean;
  sizeLimit: number;
  category: string;
  subGroup?: string;
  options?: string[];
  tableConfig?: PocTableConfig;
}

@Component({
  selector: 'app-kyc-customer-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './kyc-customer-form.component.html',
  styleUrls: ['./kyc-customer-form.component.scss'],
})
export class KycCustomerFormComponent {
  builderFormTitle = 'Standard Clinic KYC Form';
  builderFormVersion = 'v1.0.0';
  submitted = false;

  readonly tradeLicenseAuthorities = [
    'Dubai Economy (DED)',
    'Abu Dhabi Department of Economic Development',
    'Sharjah Economic Development Department',
    'Ajman Department of Economic Development',
    'Ras Al Khaimah Economic Zone',
    'Fujairah Municipality',
    'Umm Al Quwain Department of Economic Development',
    'Dubai Healthcare City Authority',
    'Other',
  ];

  formValues: Record<string, CustomerFormValue> = {};
  fileValues: Record<string, string> = {};
  pocValues: Record<string, Record<string, string>> = {};

  categories = [
    { id: 'Details', label: 'Customer Information' },
    { id: 'Contacts', label: 'Contact Persons (POCs)' },
    { id: 'Documents', label: 'Supporting Documents & Licenses' },
  ];

  builderFields: CustomerFormField[] = [
    { id: 'companyName', label: 'Legal Entity / Clinic Name', type: 'text', enabled: true, required: true, sizeLimit: 5, category: 'Details' },
    { id: 'registeredAddress', label: 'Registered Address (as per Trade License)', type: 'textarea', enabled: true, required: true, sizeLimit: 5, category: 'Details' },
    { id: 'vatTrnNumber', label: 'VAT Registration Number (TRN)', type: 'text', enabled: true, required: false, sizeLimit: 5, category: 'Details' },
    { id: 'tradeLicenseNumber', label: 'Trade License Number', type: 'text', enabled: true, required: true, sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense' },
    { id: 'tradeLicenseAuthority', label: 'Trade License Issuing Authority', type: 'select', enabled: true, required: true, sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense', options: this.tradeLicenseAuthorities },
    { id: 'tradeLicenseSigningAuth', label: 'Signing Authority', type: 'text', enabled: true, required: true, sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense' },
    { id: 'tradeLicenseIssueDate', label: 'Trade License Issue Date', type: 'date', enabled: true, required: true, sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense' },
    { id: 'tradeLicenseExpiry', label: 'Trade License Expiry Date', type: 'date', enabled: true, required: true, sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense' },
    {
      id: 'pocTable',
      label: 'Contact Persons Table',
      type: 'table',
      enabled: true,
      required: true,
      sizeLimit: 0,
      category: 'Contacts',
      tableConfig: {
        rows: [
          'Authorized Signatory',
          'Implementation POC',
          'Operations POC',
          'Accounts POC',
          'Compliance POC',
        ],
        columns: ['Name', 'Designation', 'Email ID', 'Phone Number', 'Remarks'],
        rowRemarks: [
          'Contracts and file handover links will be shared with this contact. We recommend using the same contact as the owner listed in your trade license.',
          'Kindly appoint a person who will be equipped to share the patient master, price list and all relevant data for initial setup.',
          'Someone such as a clinic manager or a clinic admin who will be responsible for confirming on the user addition / deletion, enable / disable menus.',
          'All invoice related queries, follow-ups, subscription renewal.',
          'Malaffi / Riayati / Nabidh co ordination.',
        ],
      },
    },
    { id: 'fileDhaLicense', label: 'DHA License Copy', type: 'file', enabled: true, required: true, sizeLimit: 10, category: 'Documents' },
    { id: 'fileTradeLicense', label: 'Trade License Copy', type: 'file', enabled: true, required: true, sizeLimit: 10, category: 'Documents' },
    { id: 'fileVatCertificate', label: 'VAT Certificate Copy', type: 'file', enabled: true, required: false, sizeLimit: 10, category: 'Documents' },
  ];

  getPreviewGroups(categoryId: string): Array<{ type: 'field' | 'subgroup'; field?: CustomerFormField; fields?: CustomerFormField[] }> {
    const enabled = this.builderFields.filter(f => f.enabled && f.category === categoryId);
    const result: Array<{ type: 'field' | 'subgroup'; field?: CustomerFormField; fields?: CustomerFormField[] }> = [];
    const seen = new Set<string>();
    for (const field of enabled) {
      if (field.subGroup) {
        if (!seen.has(field.subGroup)) {
          seen.add(field.subGroup);
          result.push({ type: 'subgroup', fields: enabled.filter(item => item.subGroup === field.subGroup) });
        }
      } else {
        result.push({ type: 'field', field });
      }
    }
    return result;
  }

  getPocValue(row: string, col: string): string {
    return this.pocValues[row]?.[col] ?? '';
  }

  setPocValue(row: string, col: string, value: string): void {
    this.pocValues[row] = { ...(this.pocValues[row] ?? {}), [col]: value };
  }

  onFileSelected(event: Event, fieldId: string): void {
    const input = event.target as HTMLInputElement;
    this.fileValues[fieldId] = input.files?.[0]?.name ?? '';
  }

  submitForm(): void {
    this.submitted = true;
  }
}
