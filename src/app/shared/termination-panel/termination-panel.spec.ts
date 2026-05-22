import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TerminationPanel } from './termination-panel';

describe('TerminationPanel', () => {
  let component: TerminationPanel;
  let fixture: ComponentFixture<TerminationPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminationPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TerminationPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
