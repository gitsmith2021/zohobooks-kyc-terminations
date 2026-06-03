import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContractPanelComponent } from './contract-panel';

describe('ContractPanelComponent', () => {
  let component: ContractPanelComponent;
  let fixture: ComponentFixture<ContractPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContractPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContractPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
