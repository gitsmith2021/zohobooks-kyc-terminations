import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContractPanel } from './contract-panel';

describe('ContractPanel', () => {
  let component: ContractPanel;
  let fixture: ComponentFixture<ContractPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContractPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContractPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
