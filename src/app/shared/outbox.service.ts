import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface OutboxItem {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  category: 'KYC' | 'Contract' | 'Termination';
  actionType: 'Send' | 'Resend' | 'Send Again';
  channel: 'Email' | 'WhatsApp';
  reference: string;
  dateAdded: Date;
  status: 'Pending Review' | 'Approved' | 'Sent' | 'Rejected';
  originalRecordId: number;
  originalPatch?: any;
  details?: string;
  rejectionRemarks?: string;
  poc?: string;
  renewalDue?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class OutboxService {
  private itemsSubject = new BehaviorSubject<OutboxItem[]>([]);
  public items$: Observable<OutboxItem[]> = this.itemsSubject.asObservable();

  constructor() {
    this.seedOutbox();
  }

  private seedOutbox(): void {
    const DAY = 86_400_000;
    const now = Date.now();

    const seeded: OutboxItem[] = [
      {
        id: 1,
        companyName: 'Wellness Dental Center',
        contactName: 'Dr. Sarah Al Rashid',
        email: 's.rashid@wellnessdental.ae',
        phone: '+971 50 234 5678',
        category: 'KYC',
        actionType: 'Resend',
        channel: 'Email',
        reference: 'DHA-DN-20240875',
        dateAdded: new Date(now - 1.5 * DAY),
        status: 'Pending Review',
        originalRecordId: 2,
        poc: 'John Smith',
        renewalDue: new Date(now + 14 * DAY),
        details: 'Resending KYC upload link following trade license expiry notification.',
      },
      {
        id: 2,
        companyName: 'Oasis Pediatric Clinic',
        contactName: 'Dr. Fatima Al Zaabi',
        email: 'f.zaabi@oasispediatric.ae',
        phone: '+971 55 987 6543',
        category: 'Contract',
        actionType: 'Send',
        channel: 'WhatsApp',
        reference: 'CTR-2025-0103',
        dateAdded: new Date(now - 2 * DAY),
        status: 'Pending Review',
        originalRecordId: 4,
        poc: 'Layla Ibrahim',
        renewalDue: new Date(now + 30 * DAY),
        details: 'Initial contract dispatch for annual subscription package.',
      },
      {
        id: 3,
        companyName: 'Medcare Polyclinic',
        contactName: 'Dr. Hana Al Zarouni',
        email: 'h.zarouni@medcare.ae',
        phone: '+971 52 111 2233',
        category: 'Termination',
        actionType: 'Send Again',
        channel: 'Email',
        reference: 'CTR-2025-0134',
        dateAdded: new Date(now - 0.2 * DAY),
        status: 'Pending Review',
        originalRecordId: 5,
        poc: 'Ali Hassan',
        details: 'Notice period handover package and accounts checklist transmission.',
      },
      {
        id: 4,
        companyName: 'Al Noor Specialist Clinic',
        contactName: 'Dr. Khalid Al Mansoori',
        email: 'k.mansoori@alnoor.ae',
        phone: '+971 50 341 9988',
        category: 'Contract',
        actionType: 'Resend',
        channel: 'Email',
        reference: 'CTR-2024-0088',
        dateAdded: new Date(now - 3 * DAY),
        status: 'Pending Review',
        originalRecordId: 7,
        poc: 'John Smith',
        renewalDue: new Date(now + 7 * DAY),
        details: 'Resending master service agreement following client request for amendment review.',
      },
      {
        id: 5,
        companyName: 'Emirates Family Medical Centre',
        contactName: 'Dr. Layla Al Ibrahim',
        email: 'l.ibrahim@emiratesfmc.ae',
        phone: '+971 55 812 4400',
        category: 'KYC',
        actionType: 'Send',
        channel: 'WhatsApp',
        reference: 'DHA-DN-20241102',
        dateAdded: new Date(now - 4 * DAY),
        status: 'Sent',
        originalRecordId: 9,
        poc: 'Layla Ibrahim',
        renewalDue: new Date(now + 21 * DAY),
        details: 'Initial KYC document collection link dispatched for new facility onboarding.',
      },
      {
        id: 6,
        companyName: 'Prime Health Diagnostics',
        contactName: 'Dr. Omar Al Shamsi',
        email: 'o.shamsi@primehealth.ae',
        phone: '+971 56 234 7712',
        category: 'Termination',
        actionType: 'Send',
        channel: 'Email',
        reference: 'CTR-2025-0149',
        dateAdded: new Date(now - 5 * DAY),
        status: 'Rejected',
        originalRecordId: 11,
        poc: 'John Smith',
        details: 'Formal termination notice and offboarding package for clinic closure — voluntary liquidation.',
        rejectionRemarks: 'Missing authorised signatory details. Please update the contact record and re-submit.',
      },
      {
        id: 7,
        companyName: 'Sunrise Orthopedic Centre',
        contactName: 'Dr. Aisha Al Marzouqi',
        email: 'a.marzouqi@sunriseortho.ae',
        phone: '+971 50 999 3344',
        category: 'Contract',
        actionType: 'Send',
        channel: 'WhatsApp',
        reference: 'CTR-2025-0162',
        dateAdded: new Date(now - 0.5 * DAY),
        status: 'Pending Review',
        originalRecordId: 13,
        poc: 'Ali Hassan',
        renewalDue: new Date(now + 45 * DAY),
        details: 'New annual subscription contract dispatch for expanded multi-branch agreement.',
      },
    ];

    this.itemsSubject.next(seeded);
  }

  public getItems(): OutboxItem[] {
    return this.itemsSubject.value;
  }

  public getPendingCount(): number {
    return this.getItems().filter(item => item.status === 'Pending Review').length;
  }

  public addItem(item: Omit<OutboxItem, 'id' | 'dateAdded' | 'status'>): void {
    const current = this.getItems();
    const nextId = current.length > 0 ? Math.max(...current.map(i => i.id)) + 1 : 1;
    const newItem: OutboxItem = {
      ...item,
      id: nextId,
      dateAdded: new Date(),
      status: 'Pending Review',
    };
    this.itemsSubject.next([newItem, ...current]);
  }

  public approveItem(id: number): void {
    const updated = this.getItems().map(item => {
      if (item.id === id) {
        return { ...item, status: 'Sent' as const };
      }
      return item;
    });
    this.itemsSubject.next(updated);
  }

  public rejectItem(id: number, remarks: string = ''): void {
    const updated = this.getItems().map(item => {
      if (item.id === id) {
        return { ...item, status: 'Rejected' as const, rejectionRemarks: remarks };
      }
      return item;
    });
    this.itemsSubject.next(updated);
  }

  public bulkApprove(ids: number[]): void {
    const updated = this.getItems().map(item => {
      if (ids.includes(item.id)) {
        return { ...item, status: 'Sent' as const };
      }
      return item;
    });
    this.itemsSubject.next(updated);
  }

  public bulkReject(ids: number[]): void {
    const updated = this.getItems().map(item => {
      if (ids.includes(item.id)) {
        return { ...item, status: 'Rejected' as const };
      }
      return item;
    });
    this.itemsSubject.next(updated);
  }
}
