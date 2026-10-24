import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompraCard } from './compra-card';

describe('CompraCard', () => {
  let component: CompraCard;
  let fixture: ComponentFixture<CompraCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompraCard],
    }).compileComponents();

    fixture = TestBed.createComponent(CompraCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
