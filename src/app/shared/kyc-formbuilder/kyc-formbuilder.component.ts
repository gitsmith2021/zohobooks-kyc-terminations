import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule, ButtonsModule } from '@progress/kendo-angular-buttons';
import { PopupModule } from '@progress/kendo-angular-popup';

export interface PocTableConfig {
  rows: string[];
  columns: string[];
  rowRemarks?: string[];
}

export interface BuilderField {
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

export interface FormColumn {
  id: string;
  fieldIds: string[];
}

export interface FormRow {
  id: string;
  columns: FormColumn[];
}

export interface FormVersion {
  version: string;
  name: string;
  date: Date;
  status: 'Active' | 'Archived' | 'Draft' | 'PendingApproval' | 'Approved';
  fieldsCount: number;
}

@Component({
  selector: 'app-kyc-formbuilder',
  standalone: true,
  imports: [FormsModule, ButtonModule, ButtonsModule, PopupModule],
  templateUrl: './kyc-formbuilder.component.html',
  styleUrls: ['./kyc-formbuilder.component.scss'],
})
export class KycFormbuilderComponent {

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  // ── State ───────────────────────────────────────────────────────────────────
  selectedVersionIdx = 0;
  builderFormTitle = 'Standard Clinic KYC Form';
  builderFormVersion = 'v1.0.0';
  formLinkCopied = false;
  private formLinkCopiedTimer?: ReturnType<typeof setTimeout>;

  activeCategory = 'Details';
  builderApprovalStatus: 'none' | 'pending' | 'approved' = 'none';
  editingFormTitle = false;
  formTitleDraft = '';
  isEditing = false;

  // ── Save As modal ──────────────────────────────────────────────────────────
  showSaveAsModal = false;
  saveAsName = '';
  saveAsNewVersion = '';

  // ── New Form Modal State ───────────────────────────────────────────────────
  showNewFormModal = false;
  newFormTitle = '';

  // ── Version Isolated Fields State ──────────────────────────────────────────
  enabledFieldsByVersion: Record<string, string[]> = {};

  // ── Mutable section categories ─────────────────────────────────────────────
  categories = [
    { id: 'Details',   label: 'Customer Information' },
    { id: 'Contacts',  label: 'Contact Persons (POCs)' },
    { id: 'Documents', label: 'Supporting Documents & Licenses' },
  ];
  editingCategoryId?: string;
  editingCategoryLabel = '';
  draggedCategoryIdx?: number;
  dragOverCategoryIdx?: number;

  readonly builderComponentTypes = [
    { type: 'text',     label: 'Text',     icon: 'fas fa-font' },
    { type: 'textarea', label: 'Textarea',  icon: 'fas fa-align-left' },
    { type: 'select',   label: 'Dropdown',  icon: 'fas fa-chevron-circle-down' },
    { type: 'checkbox', label: 'Checkbox',  icon: 'fas fa-check-square' },
    { type: 'table',    label: 'Table',     icon: 'fas fa-table' },
  ];

  newBuilderField = this.createNewBuilderField('Details');

  builderFields: BuilderField[] = [
    { id: 'companyName',           label: 'Legal Entity / Clinic Name',                type: 'text',     enabled: true,  required: true,  sizeLimit: 5,  category: 'Details' },
    { id: 'registeredAddress',     label: 'Registered Address (as per Trade License)',  type: 'textarea', enabled: true,  required: true,  sizeLimit: 5,  category: 'Details' },
    { id: 'vatTrnNumber',          label: 'VAT Registration Number (TRN)',              type: 'text',     enabled: true,  required: false, sizeLimit: 5,  category: 'Details' },
    { id: 'whoIsFillingForm',      label: 'Who is filling this KYC form',              type: 'text',     enabled: true,  required: true,  sizeLimit: 5,  category: 'Details' },
    { id: 'tradeLicenseNumber',    label: 'Trade License Number',           type: 'text', enabled: true, required: true,  sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense' },
    { id: 'tradeLicenseAuthority', label: 'Trade License Issuing Authority', type: 'text', enabled: true, required: true,  sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense' },
    { id: 'tradeLicenseSigningAuth', label: 'Signing Authority',             type: 'text', enabled: true, required: true,  sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense' },
    { id: 'tradeLicenseIssueDate', label: 'Trade License Issue Date',        type: 'date', enabled: true, required: true,  sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense' },
    { id: 'tradeLicenseExpiry',    label: 'Trade License Expiry Date',       type: 'date', enabled: true, required: true,  sizeLimit: 5, category: 'Details', subGroup: 'tradeLicense' },
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
    { id: 'fileDhaLicense',     label: 'DHA License Copy',     type: 'file', enabled: true,  required: true,  sizeLimit: 10, category: 'Documents' },
    { id: 'fileTradeLicense',   label: 'Trade License Copy',   type: 'file', enabled: true,  required: true,  sizeLimit: 10, category: 'Documents' },
    { id: 'fileVatCertificate', label: 'VAT Certificate Copy', type: 'file', enabled: true,  required: false, sizeLimit: 10, category: 'Documents' },
  ];

  selectedBuilderFieldIdx = 0;
  builderSettingsAnchor?: HTMLElement;
  builderCreateAnchor?: HTMLElement;
  editingBuilderField?: BuilderField;
  draggedBuilderFieldId?: string;

  get selectedBuilderField(): BuilderField {
    return this.builderFields[this.selectedBuilderFieldIdx];
  }

  formVersions: FormVersion[] = [
    { version: 'v1.0.0', name: 'Standard Clinic KYC Form', date: new Date('2026-01-10'), status: 'Active',   fieldsCount: 16 },
    { version: 'v0.9.5', name: 'Standard Clinic KYC Form', date: new Date('2025-11-05'), status: 'Archived', fieldsCount: 15 },
    { version: 'v0.9.0', name: 'Standard Clinic KYC Form', date: new Date('2025-08-20'), status: 'Archived', fieldsCount: 14 },
  ];

  // ── Public API ──────────────────────────────────────────────────────────────
  onClose(): void {
    this.closeBuilderFieldSettings();
    this.closeBuilderCreateField();
    this.closed.emit();
  }

  // ── Form title editing ──────────────────────────────────────────────────────
  startEditFormTitle(): void {
    this.formTitleDraft = this.builderFormTitle;
    this.editingFormTitle = true;
  }

  saveFormTitle(): void {
    if (this.formTitleDraft.trim()) {
      this.builderFormTitle = this.formTitleDraft.trim();
      const current = this.formVersions[this.selectedVersionIdx];
      if (current) current.name = this.builderFormTitle;
    }
    this.editingFormTitle = false;
  }

  cancelEditFormTitle(): void {
    this.editingFormTitle = false;
  }

  // ── Editing mode gate ───────────────────────────────────────────────────────
  toggleEditing(): void {
    if (this.isEditing) {
      this.isEditing = false;
      this.closeBuilderFieldSettings();
      this.closeBuilderCreateField();
    } else {
      this.isEditing = true;
    }
  }

  // ── Category accordion ──────────────────────────────────────────────────────
  toggleCategory(categoryId: string): void {
    this.activeCategory = this.activeCategory === categoryId ? '' : categoryId;
  }

  getCategoryLabel(catId: string): string {
    return this.categories.find(c => c.id === catId)?.label ?? catId;
  }

  // ── Section drag & drop ────────────────────────────────────────────────────
  startCategoryDrag(idx: number, event: DragEvent): void {
    event.stopPropagation();
    this.draggedCategoryIdx = idx;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', String(idx));
      event.dataTransfer.effectAllowed = 'move';
    }
    this.closeBuilderFieldSettings();
    this.closeBuilderCreateField();
  }

  onCategoryDragOver(idx: number, event: DragEvent): void {
    if (this.draggedCategoryIdx !== undefined && this.draggedCategoryIdx !== idx) {
      event.preventDefault();
      event.stopPropagation();
      this.dragOverCategoryIdx = idx;
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }
  }

  onCategoryDragLeave(): void {
    this.dragOverCategoryIdx = undefined;
  }

  dropCategoryOn(targetIdx: number, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const from = this.draggedCategoryIdx;
    if (from === undefined || from === targetIdx) {
      this.draggedCategoryIdx = undefined;
      this.dragOverCategoryIdx = undefined;
      return;
    }
    const [moved] = this.categories.splice(from, 1);
    this.categories.splice(targetIdx, 0, moved);
    this.draggedCategoryIdx = undefined;
    this.dragOverCategoryIdx = undefined;
  }

  endCategoryDrag(): void {
    this.draggedCategoryIdx = undefined;
    this.dragOverCategoryIdx = undefined;
  }

  // ── Section label editing ──────────────────────────────────────────────────
  startEditCategoryLabel(cat: { id: string; label: string }, event: MouseEvent): void {
    event.stopPropagation();
    this.editingCategoryId = cat.id;
    this.editingCategoryLabel = cat.label;
  }

  saveEditCategoryLabel(): void {
    const cat = this.categories.find(c => c.id === this.editingCategoryId);
    if (cat && this.editingCategoryLabel.trim()) {
      cat.label = this.editingCategoryLabel.trim();
    }
    this.editingCategoryId = undefined;
    this.editingCategoryLabel = '';
  }

  // ── Save As modal ──────────────────────────────────────────────────────────
  openSaveAsModal(): void {
    this.saveAsName = this.builderFormTitle;
    this.saveAsNewVersion = this.nextVersion();
    this.showSaveAsModal = true;
  }

  closeSaveAsModal(): void {
    this.showSaveAsModal = false;
  }

  confirmSaveAs(): void {
    const name = this.saveAsName.trim() || this.builderFormTitle;
    this.saveEnabledFieldsState();
    const prevKey = this.getVersionKey(this.formVersions[this.selectedVersionIdx]);
    
    const newDraft: FormVersion = {
      version: '',
      name,
      date: new Date(),
      status: 'Draft',
      fieldsCount: this.builderFields.filter(f => f.enabled).length,
    };
    this.formVersions.unshift(newDraft);
    
    const newKey = this.getVersionKey(newDraft);
    this.enabledFieldsByVersion[newKey] = this.enabledFieldsByVersion[prevKey] ? [...this.enabledFieldsByVersion[prevKey]] : this.builderFields.filter(f => f.enabled).map(f => f.id);
    
    const prevRowsDetails = this.getRows('Details');
    const prevRowsContacts = this.getRows('Contacts');
    const prevRowsDocs = this.getRows('Documents');
    this.layoutsByVersion[newKey] = {
      'Details': JSON.parse(JSON.stringify(prevRowsDetails)),
      'Contacts': JSON.parse(JSON.stringify(prevRowsContacts)),
      'Documents': JSON.parse(JSON.stringify(prevRowsDocs))
    };

    this.builderFormTitle = name;
    this.builderFormVersion = '';
    this.selectedVersionIdx = 0;
    this.builderApprovalStatus = 'none';
    this.isEditing = false;
    this.showSaveAsModal = false;
  }

  // ── Version selector ────────────────────────────────────────────────────────
  selectVersion(idx: number | string): void {
    const parsedIdx = typeof idx === 'string' ? parseInt(idx, 10) : idx;
    this.selectedVersionIdx = parsedIdx;
    const selected = this.formVersions[parsedIdx];
    if (!selected) return;

    this.builderFormVersion = selected.version;
    this.builderFormTitle = selected.name;
    this.isEditing = false;
    this.builderApprovalStatus =
      selected.status === 'Approved' ? 'approved' :
      selected.status === 'PendingApproval' ? 'pending' : 'none';

    const key = this.getVersionKey(selected);
    if (this.enabledFieldsByVersion[key]) {
      const enabledList = this.enabledFieldsByVersion[key];
      this.builderFields.forEach(f => {
        f.enabled = enabledList.includes(f.id);
      });
    } else {
      if (selected.version === 'v0.9.0') {
        this.builderFields.forEach(f => {
          f.enabled = !['fileVatCertificate', 'vatTrnNumber', 'complianceName', 'complianceEmail', 'compliancePhone'].includes(f.id);
        });
      } else if (selected.version === 'v0.9.5') {
        this.builderFields.forEach(f => { f.enabled = f.id !== 'fileVatCertificate'; });
      } else {
        this.builderFields.forEach(f => { f.enabled = true; });
      }
      this.saveEnabledFieldsState();
    }
  }

  saveBuilderDraft(): void {
    this.saveEnabledFieldsState();
    const prevKey = this.getVersionKey(this.formVersions[this.selectedVersionIdx]);

    const newDraft: FormVersion = {
      version: '',
      name: this.builderFormTitle,
      date: new Date(),
      status: 'Draft',
      fieldsCount: this.builderFields.filter(f => f.enabled).length,
    };
    this.formVersions.unshift(newDraft);

    const newKey = this.getVersionKey(newDraft);
    this.enabledFieldsByVersion[newKey] = this.enabledFieldsByVersion[prevKey] ? [...this.enabledFieldsByVersion[prevKey]] : this.builderFields.filter(f => f.enabled).map(f => f.id);
    
    const prevRowsDetails = this.getRows('Details');
    const prevRowsContacts = this.getRows('Contacts');
    const prevRowsDocs = this.getRows('Documents');
    this.layoutsByVersion[newKey] = {
      'Details': JSON.parse(JSON.stringify(prevRowsDetails)),
      'Contacts': JSON.parse(JSON.stringify(prevRowsContacts)),
      'Documents': JSON.parse(JSON.stringify(prevRowsDocs))
    };

    this.builderFormVersion = '';
    this.selectedVersionIdx = 0;
    this.builderApprovalStatus = 'none';
    this.isEditing = false;
  }

  sendForApproval(): void {
    if (this.builderApprovalStatus !== 'none') return;
    this.builderApprovalStatus = 'pending';
    const current = this.formVersions[this.selectedVersionIdx];
    if (current) current.status = 'PendingApproval';
  }

  approveCurrentVersion(): void {
    this.builderApprovalStatus = 'approved';
    const current = this.formVersions[this.selectedVersionIdx];
    if (current) current.status = 'Approved';
  }

  publishBuilderVersion(): void {
    if (this.builderApprovalStatus !== 'approved') return;
    const ver = this.nextVersion();
    const approvedIdx = this.selectedVersionIdx;
    
    this.formVersions.forEach(v => { if (v.status === 'Active') v.status = 'Archived'; });
    
    const publishedVersion: FormVersion = {
      version: ver,
      name: this.builderFormTitle,
      date: new Date(),
      status: 'Active',
      fieldsCount: this.builderFields.filter(f => f.enabled).length,
    };

    // Save the enabled fields list under the new published version's key
    const approvedKey = this.getVersionKey(this.formVersions[approvedIdx]);
    const publishedKey = ver; // the new version signature
    this.enabledFieldsByVersion[publishedKey] = this.enabledFieldsByVersion[approvedKey] ? [...this.enabledFieldsByVersion[approvedKey]] : this.builderFields.filter(f => f.enabled).map(f => f.id);

    // Save layouts under published version key
    const prevRowsDetails = this.getRows('Details');
    const prevRowsContacts = this.getRows('Contacts');
    const prevRowsDocs = this.getRows('Documents');
    this.layoutsByVersion[publishedKey] = {
      'Details': JSON.parse(JSON.stringify(prevRowsDetails)),
      'Contacts': JSON.parse(JSON.stringify(prevRowsContacts)),
      'Documents': JSON.parse(JSON.stringify(prevRowsDocs))
    };

    if (approvedIdx >= 0 && approvedIdx < this.formVersions.length) {
      this.formVersions.splice(approvedIdx, 1);
    }
    this.formVersions.unshift(publishedVersion);

    this.builderFormVersion = ver;
    this.selectedVersionIdx = 0;
    this.builderApprovalStatus = 'none';
    this.isEditing = false;
  }

  // ── Create-field popover ────────────────────────────────────────────────────
  openBuilderCreateField(category: string, anchor: HTMLElement): void {
    this.closeBuilderFieldSettings();
    this.newBuilderField = this.createNewBuilderField(category);
    this.builderCreateAnchor = anchor;
  }

  closeBuilderCreateField(): void {
    this.builderCreateAnchor = undefined;
  }

  saveBuilderField(): void {
    const type  = this.newBuilderField.type;
    const label = this.newBuilderField.label.trim() || `New ${this.getBuilderControlLabel(type)}`;
    const index = this.builderFields.filter(f => f.id.startsWith(`custom${type}`)).length + 1;
    this.builderFields.push({
      id: `custom${type}${index}`,
      label,
      type,
      enabled:  true,
      required: this.newBuilderField.required,
      sizeLimit: 5,
      category: this.newBuilderField.category,
      options:  this.parseBuilderOptions(this.newBuilderField.options || ''),
    });
    this.closeBuilderCreateField();
    this.saveEnabledFieldsState();
  }

  // ── Field toggle ────────────────────────────────────────────────────────────
  toggleBuilderField(field: BuilderField): void {
    field.enabled = !field.enabled;
    if (!field.enabled) {
      this.removeFieldFromLayout(field.id);
    }
    this.saveEnabledFieldsState();
  }

  // ── Drag & drop (fields) ─────────────────────────────────────────────────────
  startBuilderFieldDrag(field: BuilderField, event: DragEvent): void {
    event.stopPropagation();
    this.draggedBuilderFieldId = field.id;
    event.dataTransfer?.setData('text/plain', field.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.closeBuilderFieldSettings();
    this.closeBuilderCreateField();
  }

  allowBuilderFieldDrop(event: DragEvent): void {
    if (this.draggedBuilderFieldId) {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }
  }

  dropBuilderFieldOnField(target: BuilderField, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const dragged = this.findBuilderField(this.draggedBuilderFieldId);
    if (!dragged || dragged.id === target.id) return;
    dragged.category = target.category;
    this.moveBuilderField(dragged, this.builderFields.indexOf(target));
  }

  dropBuilderFieldInCategory(category: string, event: DragEvent): void {
    event.preventDefault();
    const dragged = this.findBuilderField(this.draggedBuilderFieldId);
    if (!dragged) return;
    dragged.category = category;
    const last = [...this.builderFields].reverse().find(f => f.category === category && f.id !== dragged.id);
    this.moveBuilderField(dragged, last ? this.builderFields.indexOf(last) + 1 : this.builderFields.length);
  }

  endBuilderFieldDrag(): void {
    this.draggedBuilderFieldId = undefined;
  }

  // ── Canvas Drag & Drop and Column drop targets ──────────────────────────────
  draggedCanvasFieldId?: string;

  startCanvasFieldDrag(fieldId: string, event: DragEvent): void {
    event.stopPropagation();
    this.draggedCanvasFieldId = fieldId;
    this.draggedBuilderFieldId = fieldId;
    event.dataTransfer?.setData('text/plain', fieldId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  endCanvasFieldDrag(): void {
    this.draggedCanvasFieldId = undefined;
    this.draggedBuilderFieldId = undefined;
  }

  // ── Row Drag & Drop ─────────────────────────────────────────────────────────
  draggedRowId?: string;
  dragOverRowId?: string;

  startRowDrag(categoryId: string, row: FormRow, event: DragEvent): void {
    event.stopPropagation();
    this.draggedRowId = row.id;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', row.id);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onRowDragOver(categoryId: string, row: FormRow, event: DragEvent): void {
    if (this.draggedRowId && this.draggedRowId !== row.id) {
      event.preventDefault();
      event.stopPropagation();
      this.dragOverRowId = row.id;
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }
  }

  onRowDragLeave(): void {
    this.dragOverRowId = undefined;
  }

  dropRowOnRow(categoryId: string, targetRow: FormRow, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = this.draggedRowId;
    if (!draggedId || draggedId === targetRow.id) {
      this.draggedRowId = undefined;
      this.dragOverRowId = undefined;
      return;
    }

    const rows = this.getRows(categoryId);
    const fromIdx = rows.findIndex(r => r.id === draggedId);
    const toIdx = rows.findIndex(r => r.id === targetRow.id);

    if (fromIdx >= 0 && toIdx >= 0) {
      const [moved] = rows.splice(fromIdx, 1);
      rows.splice(toIdx, 0, moved);
      this.saveEnabledFieldsState();
    }

    this.draggedRowId = undefined;
    this.dragOverRowId = undefined;
  }

  endRowDrag(): void {
    this.draggedRowId = undefined;
    this.dragOverRowId = undefined;
  }

  allowFieldDropOnColumn(event: DragEvent): void {
    if (this.draggedBuilderFieldId) {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }
  }

  dropFieldOnColumn(row: FormRow, col: FormColumn, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const fieldId = this.draggedBuilderFieldId;
    if (!fieldId) return;

    const field = this.findBuilderField(fieldId);
    if (!field) return;

    // 1. Remove from previous layout position (if any)
    this.removeFieldFromLayout(fieldId);

    // 2. Add to target column
    if (!col.fieldIds.includes(fieldId)) {
      col.fieldIds.push(fieldId);
    }

    // 3. Mark field as enabled in category
    field.enabled = true;
    field.category = this.activeCategory;
    this.saveEnabledFieldsState();
  }

  removeFieldFromLayout(fieldId: string): void {
    const ver = this.getVersionKey(this.formVersions[this.selectedVersionIdx]);
    const layout = this.layoutsByVersion[ver];
    if (layout) {
      Object.keys(layout).forEach(catId => {
        layout[catId].forEach(row => {
          row.columns.forEach(col => {
            const idx = col.fieldIds.indexOf(fieldId);
            if (idx >= 0) {
              col.fieldIds.splice(idx, 1);
            }
          });
        });
      });
    }
  }

  // ── Field settings popover ──────────────────────────────────────────────────
  openBuilderFieldSettings(index: number, anchor: HTMLElement): void {
    this.closeBuilderCreateField();
    this.selectedBuilderFieldIdx = index;
    this.editingBuilderField = this.cloneBuilderField(this.builderFields[index]);
    this.builderSettingsAnchor = anchor;
  }

  closeBuilderFieldSettings(): void {
    this.builderSettingsAnchor = undefined;
    this.editingBuilderField = undefined;
  }

  saveBuilderFieldSettings(): void {
    if (!this.selectedBuilderField || !this.editingBuilderField) return;
    Object.assign(this.selectedBuilderField, this.cloneBuilderField(this.editingBuilderField));
    this.closeBuilderFieldSettings();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      this.builderSettingsAnchor?.contains(target) ||
      this.builderCreateAnchor?.contains(target) ||
      target.closest('.fb-field-settings-card') ||
      target.closest('.fb-modal-card')
    ) return;
    this.closeBuilderFieldSettings();
    this.closeBuilderCreateField();
  }

  // ── Copy link ───────────────────────────────────────────────────────────────
  async copySelectedFormLink(): Promise<void> {
    const ver      = this.formVersions[this.selectedVersionIdx]?.version ?? this.builderFormVersion;
    const formLink = `${window.location.origin}/customer/kyc/${encodeURIComponent(ver)}`;
    try {
      await navigator.clipboard.writeText(formLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = formLink;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    this.formLinkCopied = true;
    clearTimeout(this.formLinkCopiedTimer);
    this.formLinkCopiedTimer = setTimeout(() => { this.formLinkCopied = false; }, 1800);
  }

  // ── Preview grouping ────────────────────────────────────────────────────────
  getPreviewGroups(categoryId: string): Array<{ type: 'field' | 'subgroup'; field?: BuilderField; fields?: BuilderField[] }> {
    const enabled = this.builderFields.filter(f => f.enabled && f.category === categoryId);
    const result: Array<{ type: 'field' | 'subgroup'; field?: BuilderField; fields?: BuilderField[] }> = [];
    const seen = new Set<string>();
    for (const f of enabled) {
      if (f.subGroup) {
        if (!seen.has(f.subGroup)) {
          seen.add(f.subGroup);
          result.push({ type: 'subgroup', fields: enabled.filter(g => g.subGroup === f.subGroup) });
        }
      } else {
        result.push({ type: 'field', field: f });
      }
    }
    return result;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  isPublished(version?: FormVersion): boolean {
    return version?.status === 'Active' || version?.status === 'Archived';
  }

  getStatusLabel(status?: string): string {
    if (!status) return '';
    const map: Record<string, string> = {
      'Draft': 'Draft',
      'PendingApproval': 'Pending Approval',
      'Approved': 'Approved',
      'Active': 'Active',
      'Archived': 'Archived'
    };
    return map[status] ?? status;
  }

  private nextVersion(): string {
    const latest = this.formVersions.find(v => v.status === 'Active' || v.status === 'Archived')?.version ?? 'v1.0.0';
    const m = latest.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return 'v1.0.1';
    return `v${m[1]}.${m[2]}.${+m[3] + 1}`;
  }

  private createNewBuilderField(category: string) {
    return { category, label: '', type: 'text', required: false, options: '' };
  }

  private getBuilderControlLabel(type: string): string {
    return this.builderComponentTypes.find(c => c.type === type)?.label ?? 'Field';
  }

  private parseBuilderOptions(options: string): string[] {
    return options.split('\n').map(o => o.trim()).filter(Boolean);
  }

  private findBuilderField(id: string | undefined): BuilderField | undefined {
    return this.builderFields.find(f => f.id === id);
  }

  private moveBuilderField(field: BuilderField, targetIndex: number): void {
    const fromIndex = this.builderFields.indexOf(field);
    if (fromIndex < 0) return;
    this.builderFields.splice(fromIndex, 1);
    this.builderFields.splice(fromIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, field);
    this.draggedBuilderFieldId = undefined;
  }

  private cloneBuilderField(field: BuilderField): BuilderField {
    return { ...field, options: field.options ? [...field.options] : undefined };
  }

  // ─── Layout Grid Editor Engine ──────────────────────────────────────────────
  layoutsByVersion: Record<string, Record<string, FormRow[]>> = {};
  private rowIdCounter = 0;
  private colIdCounter = 0;

  getRows(categoryId: string): FormRow[] {
    const current = this.formVersions[this.selectedVersionIdx];
    const ver = this.getVersionKey(current);
    if (!this.layoutsByVersion[ver]) {
      this.layoutsByVersion[ver] = {};
    }
    if (!this.layoutsByVersion[ver][categoryId]) {
      this.layoutsByVersion[ver][categoryId] = this.buildDefaultLayout(categoryId);
    }
    const rows = this.layoutsByVersion[ver][categoryId];
    
    // Safeguard: Ensure all enabled fields in this category are in the layout
    const enabledFields = this.builderFields.filter(f => f.enabled && f.category === categoryId);
    enabledFields.forEach(f => {
      const isPresent = rows.some(r => r.columns.some(c => c.fieldIds.includes(f.id)));
      if (!isPresent) {
        this.rowIdCounter++;
        this.colIdCounter++;
        rows.push({
          id: `row-${Date.now()}-${this.rowIdCounter}`,
          columns: [
            {
              id: `col-${Date.now()}-${this.colIdCounter}`,
              fieldIds: [f.id]
            }
          ]
        });
      }
    });

    return rows;
  }

  buildDefaultLayout(categoryId: string): FormRow[] {
    const rows: FormRow[] = [];
    const fields = this.builderFields.filter(f => f.category === categoryId && f.enabled);

    if (categoryId === 'Details') {
      const f1 = fields.find(f => f.id === 'companyName');
      if (f1) rows.push(this.createRow([f1.id]));

      const f2 = fields.find(f => f.id === 'registeredAddress');
      if (f2) rows.push(this.createRow([f2.id]));

      const f3 = fields.find(f => f.id === 'vatTrnNumber');
      if (f3) rows.push(this.createRow([f3.id]));

      const tlRow1: string[] = [];
      const f4 = fields.find(f => f.id === 'tradeLicenseNumber');
      if (f4) tlRow1.push(f4.id);
      const f5 = fields.find(f => f.id === 'tradeLicenseAuthority');
      if (f5) tlRow1.push(f5.id);
      const f6 = fields.find(f => f.id === 'tradeLicenseSigningAuth');
      if (f6) tlRow1.push(f6.id);
      if (tlRow1.length > 0) rows.push(this.createRow(tlRow1));

      const tlRow2: string[] = [];
      const f7 = fields.find(f => f.id === 'tradeLicenseIssueDate');
      if (f7) tlRow2.push(f7.id);
      const f8 = fields.find(f => f.id === 'tradeLicenseExpiry');
      if (f8) tlRow2.push(f8.id);
      if (tlRow2.length > 0) rows.push(this.createRow(tlRow2));

      const standardIds = ['companyName', 'registeredAddress', 'vatTrnNumber', 'tradeLicenseNumber', 'tradeLicenseAuthority', 'tradeLicenseSigningAuth', 'tradeLicenseIssueDate', 'tradeLicenseExpiry'];
      const customFields = fields.filter(f => !standardIds.includes(f.id));
      customFields.forEach(f => {
        rows.push(this.createRow([f.id]));
      });

    } else if (categoryId === 'Contacts') {
      fields.forEach(f => {
        rows.push(this.createRow([f.id]));
      });
    } else if (categoryId === 'Documents') {
      const docIds = fields.map(f => f.id);
      if (docIds.length > 0) {
        rows.push(this.createRow(docIds.slice(0, 3)));
        if (docIds.length > 3) {
          rows.push(this.createRow(docIds.slice(3)));
        }
      }
    } else {
      fields.forEach(f => {
        rows.push(this.createRow([f.id]));
      });
    }

    return rows;
  }

  private createRow(fieldIds: string[]): FormRow {
    this.rowIdCounter++;
    return {
      id: `row-${Date.now()}-${this.rowIdCounter}`,
      columns: fieldIds.map(fid => {
        this.colIdCounter++;
        return {
          id: `col-${Date.now()}-${this.colIdCounter}`,
          fieldIds: [fid]
        };
      })
    };
  }

  addRowLayout(categoryId: string): void {
    const rows = this.getRows(categoryId);
    this.rowIdCounter++;
    this.colIdCounter++;
    rows.push({
      id: `row-${Date.now()}-${this.rowIdCounter}`,
      columns: [
        {
          id: `col-${Date.now()}-${this.colIdCounter}`,
          fieldIds: []
        }
      ]
    });
  }

  removeRowLayout(categoryId: string, rowId: string): void {
    const rows = this.getRows(categoryId);
    const idx = rows.findIndex(r => r.id === rowId);
    if (idx >= 0) {
      const row = rows[idx];
      row.columns.forEach(col => {
        col.fieldIds.forEach(fid => {
          const f = this.findBuilderField(fid);
          if (f) {
            f.enabled = false;
            this.removeFieldFromLayout(fid);
          }
        });
      });
      rows.splice(idx, 1);
      this.saveEnabledFieldsState();
    }
  }

  addColumnLayout(row: FormRow): void {
    if (row.columns.length >= 3) return;
    this.colIdCounter++;
    row.columns.push({
      id: `col-${Date.now()}-${this.colIdCounter}`,
      fieldIds: []
    });
  }

  removeColumnLayout(row: FormRow, colIdx: number): void {
    const col = row.columns[colIdx];
    if (col) {
      col.fieldIds.forEach(fid => {
        const f = this.findBuilderField(fid);
        if (f) {
          f.enabled = false;
          this.removeFieldFromLayout(fid);
        }
      });
    }
    row.columns.splice(colIdx, 1);
    this.saveEnabledFieldsState();
  }

  getFieldById(fieldId: string): BuilderField | undefined {
    return this.builderFields.find(f => f.id === fieldId);
  }

  // ─── Version Key Generator ──────────────────────────────────────────────────
  getVersionKey(selected?: FormVersion): string {
    if (!selected) return 'default';
    return selected.version ? selected.version : 'draft-' + selected.name;
  }

  saveEnabledFieldsState(): void {
    const current = this.formVersions[this.selectedVersionIdx];
    if (!current) return;
    const key = this.getVersionKey(current);
    this.enabledFieldsByVersion[key] = this.builderFields
      .filter(f => f.enabled)
      .map(f => f.id);
  }

  // ─── New Form Creation Workflow ─────────────────────────────────────────────
  openCreateNewFormModal(): void {
    this.newFormTitle = '';
    this.showNewFormModal = true;
  }

  closeNewFormModal(): void {
    this.showNewFormModal = false;
  }

  createNewBlankForm(): void {
    const title = this.newFormTitle.trim() || 'New Blank KYC Form';
    
    // Save state of current version first
    this.saveEnabledFieldsState();

    const newDraft: FormVersion = {
      version: '',
      name: title,
      date: new Date(),
      status: 'Draft',
      fieldsCount: 0
    };
    
    this.formVersions.unshift(newDraft);
    
    this.selectedVersionIdx = 0;
    this.builderFormTitle = title;
    this.builderFormVersion = '';
    this.builderApprovalStatus = 'none';
    
    const key = this.getVersionKey(newDraft);
    this.enabledFieldsByVersion[key] = [];
    this.builderFields.forEach(f => f.enabled = false);
    
    this.layoutsByVersion[key] = {
      'Details': [],
      'Contacts': [],
      'Documents': []
    };
    
    this.isEditing = true;
    this.closeNewFormModal();
  }
}
