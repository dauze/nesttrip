import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TripDetailComponent } from './trip-detail.component';

describe('TripDetailComponent', () => {
  let component: TripDetailComponent;
  let fixture: ComponentFixture<TripDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripDetailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TripDetailComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
