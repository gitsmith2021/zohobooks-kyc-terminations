import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { DateInputsModule } from '@progress/kendo-angular-dateinputs';

export type ActionType =
  | 'navigation'
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'upload'
  | 'send'
  | 'view'
  | 'error';

export interface AuditLog {
  id: number;
  timestamp: Date;
  user: string;
  userInitials: string;
  clinic: string;
  module: string;
  path: string;
  action: string;
  actionType: ActionType;
  details: string;
  ipAddress: string;
  browser: string;
  device: string;
  os: string;
}

export interface AuditDateGroup {
  label: string;
  date: string;
  count: number;
  logs: AuditLog[];
}

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [NgClass, DatePipe, FormsModule, ButtonModule, DateInputsModule],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.scss'],
})
export class AuditLogsComponent implements OnInit, OnDestroy {

  allLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  dateGroups: AuditDateGroup[] = [];

  searchQuery = '';
  selectedUser = '';
  selectedModule = '';
  selectedDateFilter = '';
  dateRangeFilter: { start: Date | null; end: Date | null } = { start: null, end: null };
  activeKpiFilter = 'all';

  detailPanelOpen = false;
  selectedLog: AuditLog | null = null;

  private cdr = inject(ChangeDetectorRef);

  toastVisible = false;
  toastHiding  = false;
  private toastTimer: any = null;

  readonly users = ['Ali Hassan', 'Sara Mohammed', 'John Smith', 'Layla Ibrahim', 'Smith', 'System'];
  readonly modules = ['Dashboard', 'KYC Verification', 'Contracts', 'Terminations', 'User KYC Forms', 'Authentication', 'Settings'];

  ngOnInit(): void {
    this.seedLogs();
    this.applyFilter();
    this.toastVisible = true;
    this.toastTimer = setTimeout(() => this.dismissToast(), 15_000);
  }

  ngOnDestroy(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toastHiding = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.toastVisible = false;
      this.toastHiding = false;
      this.cdr.detectChanges();
    }, 350);
  }

  private ts(daysAgo: number, hour: number, minute: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  seedLogs(): void {
    this.allLogs = [
      // ── Today ──────────────────────────────────────────────────────────────
      { id: 1,  timestamp: this.ts(0, 18, 40), user: 'Smith',        userInitials: 'SM', clinic: 'CLINIC 1', module: 'Audit Logs',       path: 'My Tasks > User Activity Logs',                    action: 'Menu Navigation',       actionType: 'navigation', details: 'User navigated to the Audit Logs / User Activity section.',                                                   ipAddress: '122.165.249.239', browser: 'Chrome 124',  device: 'Desktop', os: 'Windows' },
      { id: 2,  timestamp: this.ts(0, 18, 38), user: 'Ali Hassan',   userInitials: 'AH', clinic: 'CLINIC 1', module: 'KYC Verification', path: 'Contracts > KYC Verification > CityCare Medical',  action: 'KYC Approved',          actionType: 'create',     details: 'KYC for CityCare Medical Clinic was approved. Status changed to "KYC Approved". Notes: all documents verified.',  ipAddress: '122.165.249.239', browser: 'Chrome 124',  device: 'Desktop', os: 'Windows' },
      { id: 3,  timestamp: this.ts(0, 18, 35), user: 'Sara Mohammed',userInitials: 'SR', clinic: 'CLINIC 1', module: 'KYC Verification', path: 'Contracts > KYC Verification > Wellness Dental',   action: 'File Uploaded',         actionType: 'upload',     details: 'Trade License document uploaded for Wellness Dental Center. File: "Trade_License_2025.pdf" (1.2 MB).',          ipAddress: '49.206.114.80',   browser: 'Chrome 123',  device: 'Desktop', os: 'Windows' },
      { id: 4,  timestamp: this.ts(0, 18, 30), user: 'John Smith',   userInitials: 'JS', clinic: 'CLINIC 1', module: 'Contracts',        path: 'Contracts > Contracts > Apex Healthcare Group',    action: 'Contract Sent',         actionType: 'send',       details: 'Contract ZC-2026-003 dispatched via email to Apex Healthcare Group (Dr. Ahmed Hassan, admin@apexhealthcare.ae).',ipAddress: '122.165.249.239', browser: 'Edge 124',    device: 'Desktop', os: 'Windows' },
      { id: 5,  timestamp: this.ts(0, 18, 25), user: 'Layla Ibrahim',userInitials: 'LI', clinic: 'CLINIC 1', module: 'Terminations',     path: 'Contracts > Terminations > Sunrise Family Clinic', action: 'Termination Requested', actionType: 'create',     details: 'Termination request created for Sunrise Family Clinic. Reason: Voluntary Clinic Closure. Escalated for review.',ipAddress: '106.51.152.5',    browser: 'Safari 17',   device: 'MacBook', os: 'macOS' },
      { id: 6,  timestamp: this.ts(0, 18, 18), user: 'Ali Hassan',   userInitials: 'AH', clinic: 'CLINIC 1', module: 'Contracts',        path: 'Contracts > Contracts > Prime Physio Specialists', action: 'Contract Viewed',       actionType: 'view',       details: 'Viewed contract history for Prime Physio Specialists. 3 contract versions loaded.',                              ipAddress: '122.165.249.239', browser: 'Chrome 124',  device: 'Desktop', os: 'Windows' },
      { id: 7,  timestamp: this.ts(0, 18, 10), user: 'System',       userInitials: 'SY', clinic: 'SYSTEM',   module: 'KYC Verification', path: 'System > Automated Alerts > KYC Expiry',           action: 'KYC Expiry Alert',      actionType: 'error',      details: 'Automated alert triggered: Trade License for Harmony Psychiatry Center expired on 01 Nov 2024. Renewal required.',ipAddress: '10.0.0.1',        browser: 'System',      device: 'Server',  os: 'Linux'   },
      { id: 8,  timestamp: this.ts(0, 17, 55), user: 'Sara Mohammed',userInitials: 'SR', clinic: 'CLINIC 1', module: 'Dashboard',        path: 'Contracts > Dashboard',                            action: 'Login',                 actionType: 'login',      details: 'User logged in successfully. Session started from Chrome 123 on Desktop (Windows).',                             ipAddress: '49.206.114.80',   browser: 'Chrome 123',  device: 'Desktop', os: 'Windows' },
      { id: 9,  timestamp: this.ts(0, 17, 43), user: 'John Smith',   userInitials: 'JS', clinic: 'CLINIC 1', module: 'KYC Verification', path: 'Contracts > KYC Verification > Nightingale Medical',action: 'KYC Rejected',         actionType: 'delete',     details: 'KYC rejected for Nightingale Medical Group. Reason: Incomplete signatory documents. Correction request sent.',   ipAddress: '122.165.249.239', browser: 'Edge 124',    device: 'Desktop', os: 'Windows' },
      { id: 10, timestamp: this.ts(0, 17, 30), user: 'Layla Ibrahim',userInitials: 'LI', clinic: 'CLINIC 1', module: 'Contracts',        path: 'Contracts > Contracts > Bulk Export',              action: 'Bulk Export',           actionType: 'upload',     details: '5 contracts exported as PDF bundle. Triggered by Layla Ibrahim. Download link generated.',                       ipAddress: '106.51.152.5',    browser: 'Safari 17',   device: 'MacBook', os: 'macOS'   },
      { id: 11, timestamp: this.ts(0, 17, 20), user: 'Ali Hassan',   userInitials: 'AH', clinic: 'CLINIC 1', module: 'Terminations',     path: 'Contracts > Terminations > Crescent Urgent Care',  action: 'Termination Approved',  actionType: 'update',     details: 'Termination for Crescent Urgent Care approved. Basis: DHA license lapsed. Notice period clock started.',         ipAddress: '122.165.249.239', browser: 'Chrome 124',  device: 'Desktop', os: 'Windows' },
      { id: 12, timestamp: this.ts(0, 17, 15), user: 'Unknown',      userInitials: '??', clinic: 'UNKNOWN',  module: 'Authentication',   path: 'System > Authentication > Login',                  action: 'Login Failed',          actionType: 'error',      details: 'Failed login attempt. Invalid credentials entered 3 times. IP flagged for security review.',                    ipAddress: '85.245.10.103',   browser: 'Chrome 120',  device: 'Mobile',  os: 'Android' },
      // ── Yesterday ──────────────────────────────────────────────────────────
      { id: 13, timestamp: this.ts(1, 23, 48), user: 'Sara Mohammed',userInitials: 'SR', clinic: 'CLINIC 1', module: 'Dashboard',        path: 'Contracts > Dashboard',                            action: 'Logout',                actionType: 'logout',     details: 'User logged out. Session duration: 5h 53m.',                                                                     ipAddress: '49.206.114.80',   browser: 'Chrome 123',  device: 'Desktop', os: 'Windows' },
      { id: 14, timestamp: this.ts(1, 18, 22), user: 'John Smith',   userInitials: 'JS', clinic: 'CLINIC 1', module: 'Contracts',        path: 'Contracts > Contracts > Global Smiles Dental',     action: 'Contract Created',      actionType: 'create',     details: 'New contract ZC-2026-013 created for Global Smiles Dental. Annual value: AED 68,000. Pending signature.',        ipAddress: '122.165.249.239', browser: 'Edge 124',    device: 'Desktop', os: 'Windows' },
      { id: 15, timestamp: this.ts(1, 16, 15), user: 'Ali Hassan',   userInitials: 'AH', clinic: 'CLINIC 1', module: 'Contracts',        path: 'Contracts > Contracts > Oasis Pediatric Clinic',   action: 'Contract Updated',      actionType: 'update',     details: 'Contract terms updated for Oasis Pediatric Clinic. Renewal date extended by 60 days (field: contractEndDate).',  ipAddress: '122.165.249.239', browser: 'Chrome 124',  device: 'Desktop', os: 'Windows' },
      { id: 16, timestamp: this.ts(1, 15, 40), user: 'Layla Ibrahim',userInitials: 'LI', clinic: 'CLINIC 1', module: 'KYC Verification', path: 'Contracts > KYC Verification > Emirates Derm',     action: 'KYC Viewed',            actionType: 'view',       details: 'KYC documents reviewed for Emirates Dermatology Hub. 4 documents opened.',                                       ipAddress: '106.51.152.5',    browser: 'Safari 17',   device: 'MacBook', os: 'macOS'   },
      { id: 17, timestamp: this.ts(1, 14, 55), user: 'Sara Mohammed',userInitials: 'SR', clinic: 'CLINIC 1', module: 'Contracts',        path: 'Contracts > Contracts > Renewal Emails',           action: 'Renewal Email Sent',    actionType: 'send',       details: 'KYC renewal reminder dispatched to Luminous Eye Care Center (info@luminouseye.ae).',                              ipAddress: '49.206.114.80',   browser: 'Chrome 123',  device: 'Desktop', os: 'Windows' },
      { id: 18, timestamp: this.ts(1, 14, 30), user: 'System',       userInitials: 'SY', clinic: 'SYSTEM',   module: 'Contracts',        path: 'System > Email Gateway > Contract Dispatch',       action: 'Email Delivery Failed', actionType: 'error',      details: 'Contract email to Horizon Orthopedics bounced. Delivery error: 550 User unknown. Manual follow-up required.',    ipAddress: '10.0.0.1',        browser: 'System',      device: 'Server',  os: 'Linux'   },
      { id: 19, timestamp: this.ts(1, 13, 15), user: 'John Smith',   userInitials: 'JS', clinic: 'CLINIC 1', module: 'Contracts',        path: 'Contracts > Contracts',                            action: 'Menu Navigation',       actionType: 'navigation', details: 'User navigated to the Contracts overview page. 15 records loaded.',                                               ipAddress: '122.165.249.239', browser: 'Edge 124',    device: 'Desktop', os: 'Windows' },
      { id: 20, timestamp: this.ts(1, 10, 30), user: 'Ali Hassan',   userInitials: 'AH', clinic: 'CLINIC 1', module: 'Dashboard',        path: 'Contracts > Dashboard',                            action: 'Login',                 actionType: 'login',      details: 'User logged in successfully. Session started from Chrome 124 on Desktop (Windows).',                             ipAddress: '122.165.249.239', browser: 'Chrome 124',  device: 'Desktop', os: 'Windows' },
      // ── 3 days ago ─────────────────────────────────────────────────────────
      { id: 21, timestamp: this.ts(3, 17, 45), user: 'Sara Mohammed',userInitials: 'SR', clinic: 'CLINIC 1', module: 'KYC Verification', path: 'Contracts > KYC Verification > Aura Aesthetics',   action: 'KYC Form Updated',      actionType: 'update',     details: 'KYC form updated for Aura Aesthetics & Laser. 3 fields modified: vatTrnNumber, registeredAddress, signatoryEmail.', ipAddress: '49.206.114.80', browser: 'Chrome 123', device: 'Desktop', os: 'Windows' },
      { id: 22, timestamp: this.ts(3, 16, 30), user: 'Layla Ibrahim',userInitials: 'LI', clinic: 'CLINIC 1', module: 'Terminations',     path: 'Contracts > Terminations',                         action: 'Menu Navigation',       actionType: 'navigation', details: 'User navigated to the Terminations review screen. 3 active cases loaded.',                                        ipAddress: '106.51.152.5',    browser: 'Safari 17',   device: 'MacBook', os: 'macOS'   },
      { id: 23, timestamp: this.ts(3, 15, 15), user: 'John Smith',   userInitials: 'JS', clinic: 'CLINIC 1', module: 'Contracts',        path: 'Contracts > Contracts > Contract Templates',       action: 'File Uploaded',         actionType: 'upload',     details: 'New contract template "Master Service Agreement v3.docx" uploaded. Size: 247 KB.',                               ipAddress: '122.165.249.239', browser: 'Edge 124',    device: 'Desktop', os: 'Windows' },
      { id: 24, timestamp: this.ts(3, 14, 0),  user: 'Ali Hassan',   userInitials: 'AH', clinic: 'CLINIC 1', module: 'KYC Verification', path: 'Contracts > KYC Verification > Vitality Women',    action: 'KYC Under Review',      actionType: 'update',     details: 'KYC status for Vitality Women Clinic changed to "Under Review". Assigned to Ali Hassan for verification.',       ipAddress: '122.165.249.239', browser: 'Chrome 124',  device: 'Desktop', os: 'Windows' },
      { id: 25, timestamp: this.ts(3, 11, 30), user: 'Ali Hassan',   userInitials: 'AH', clinic: 'CLINIC 1', module: 'Dashboard',        path: 'Contracts > Dashboard',                            action: 'Login',                 actionType: 'login',      details: 'User logged in successfully. Session started from Chrome 124 on Desktop (Windows).',                             ipAddress: '122.165.249.239', browser: 'Chrome 124',  device: 'Desktop', os: 'Windows' },
    ];
  }

  get isFilterApplied(): boolean {
    return !!(
      this.searchQuery ||
      this.selectedUser ||
      this.selectedModule ||
      this.selectedDateFilter ||
      this.dateRangeFilter.start ||
      this.dateRangeFilter.end ||
      this.activeKpiFilter !== 'all'
    );
  }

  // ── KPI Counts ────────────────────────────────────────────────────────────────
  get totalCount():      number { return this.allLogs.length; }
  get navigationCount(): number { return this.allLogs.filter(l => l.actionType === 'navigation').length; }
  get dataChangesCount():number { return this.allLogs.filter(l => ['create', 'update', 'delete'].includes(l.actionType)).length; }
  get fileUploadsCount():number { return this.allLogs.filter(l => l.actionType === 'upload' || l.actionType === 'send').length; }
  get errorsCount():     number { return this.allLogs.filter(l => l.actionType === 'error').length; }

  setKpiFilter(filter: string): void {
    this.activeKpiFilter = filter;
    this.applyFilter();
  }

  toggleDateFilter(filter: string): void {
    this.selectedDateFilter = this.selectedDateFilter === filter ? '' : filter;
    this.applyFilter();
  }

  applyFilter(): void {
    let filtered = [...this.allLogs];

    // KPI filter
    if (this.activeKpiFilter === 'navigation') filtered = filtered.filter(l => l.actionType === 'navigation');
    else if (this.activeKpiFilter === 'changes')    filtered = filtered.filter(l => ['create', 'update', 'delete'].includes(l.actionType));
    else if (this.activeKpiFilter === 'uploads')    filtered = filtered.filter(l => l.actionType === 'upload' || l.actionType === 'send');
    else if (this.activeKpiFilter === 'errors')     filtered = filtered.filter(l => l.actionType === 'error');

    // Text search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.user.toLowerCase().includes(q) ||
        l.path.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.module.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      );
    }

    // User filter
    if (this.selectedUser) filtered = filtered.filter(l => l.user === this.selectedUser);

    // Module filter
    if (this.selectedModule) filtered = filtered.filter(l => l.module === this.selectedModule);

    // Date quick filter
    if (this.selectedDateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 86_400_000);
      const last7    = new Date(today.getTime() - 7  * 86_400_000);
      const last30   = new Date(today.getTime() - 30 * 86_400_000);

      if      (this.selectedDateFilter === 'today')     filtered = filtered.filter(l => l.timestamp >= today);
      else if (this.selectedDateFilter === 'yesterday') filtered = filtered.filter(l => l.timestamp >= yesterday && l.timestamp < today);
      else if (this.selectedDateFilter === 'last7')     filtered = filtered.filter(l => l.timestamp >= last7);
      else if (this.selectedDateFilter === 'last30')    filtered = filtered.filter(l => l.timestamp >= last30);
    }

    // Date range filter
    if (this.dateRangeFilter.start) filtered = filtered.filter(l => l.timestamp >= this.dateRangeFilter.start!);
    if (this.dateRangeFilter.end) {
      const endOfDay = new Date(this.dateRangeFilter.end!);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(l => l.timestamp <= endOfDay);
    }

    this.filteredLogs = filtered;
    this.buildDateGroups();
  }

  clearAllFilters(): void {
    this.searchQuery      = '';
    this.selectedUser     = '';
    this.selectedModule   = '';
    this.selectedDateFilter = '';
    this.dateRangeFilter  = { start: null, end: null };
    this.activeKpiFilter  = 'all';
    this.applyFilter();
  }

  buildDateGroups(): void {
    const map = new Map<string, AuditLog[]>();
    for (const log of this.filteredLogs) {
      const key = log.timestamp.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }

    const todayStr     = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

    this.dateGroups = Array.from(map.entries())
      .map(([key, logs]) => {
        const d = new Date(key);
        const prefix = key === todayStr ? 'Today, ' : key === yesterdayStr ? 'Yesterday, ' : '';
        return { label: prefix + fmt(d), date: key, count: logs.length, logs };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  openDetail(log: AuditLog): void {
    this.selectedLog    = log;
    this.detailPanelOpen = true;
  }

  closeDetail(): void {
    this.detailPanelOpen = false;
    setTimeout(() => { this.selectedLog = null; }, 310);
  }

  getActionConfig(type: ActionType): { icon: string; cls: string } {
    const map: Record<ActionType, { icon: string; cls: string }> = {
      navigation: { icon: 'fas fa-compass',             cls: 'al-type--nav'      },
      create:     { icon: 'fas fa-plus-circle',         cls: 'al-type--create'   },
      update:     { icon: 'fas fa-pen',                 cls: 'al-type--update'   },
      delete:     { icon: 'fas fa-times-circle',        cls: 'al-type--delete'   },
      login:      { icon: 'fas fa-sign-in-alt',         cls: 'al-type--login'    },
      logout:     { icon: 'fas fa-sign-out-alt',        cls: 'al-type--logout'   },
      upload:     { icon: 'fas fa-cloud-upload-alt',    cls: 'al-type--upload'   },
      send:       { icon: 'fas fa-paper-plane',         cls: 'al-type--send'     },
      view:       { icon: 'fas fa-eye',                 cls: 'al-type--view'     },
      error:      { icon: 'fas fa-exclamation-circle',  cls: 'al-type--error'    },
    };
    return map[type];
  }

  formatTime(d: Date): string {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  getBrowserIcon(browser: string): string {
    if (browser.includes('Chrome'))  return 'fab fa-chrome';
    if (browser.includes('Edge'))    return 'fab fa-edge';
    if (browser.includes('Safari'))  return 'fab fa-safari';
    if (browser.includes('Firefox')) return 'fab fa-firefox';
    return 'fas fa-globe';
  }

  getDeviceIcon(device: string): string {
    if (device === 'Mobile')  return 'fas fa-mobile-alt';
    if (device === 'MacBook') return 'fas fa-laptop';
    if (device === 'Server')  return 'fas fa-server';
    return 'fas fa-desktop';
  }
}
