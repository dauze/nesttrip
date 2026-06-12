import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccueilTripComponent } from './accueil-trip.component';

describe('AccueilTripComponent', () => {
  let component: AccueilTripComponent;
  let fixture: ComponentFixture<AccueilTripComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccueilTripComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AccueilTripComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
