import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KycReviewPanelComponent } from './kyc-review-panel';

describe('KycReviewPanelComponent', () => {
  let component: KycReviewPanelComponent;
  let fixture: ComponentFixture<KycReviewPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KycReviewPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KycReviewPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
