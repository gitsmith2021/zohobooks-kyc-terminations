import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KycReviewPanel } from './kyc-review-panel';

describe('KycReviewPanel', () => {
  let component: KycReviewPanel;
  let fixture: ComponentFixture<KycReviewPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KycReviewPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KycReviewPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
