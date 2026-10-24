import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisCompras } from './mis-compras';

describe('MisCompras', () => {
  let component: MisCompras;
  let fixture: ComponentFixture<MisCompras>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisCompras],
    }).compileComponents();

    fixture = TestBed.createComponent(MisCompras);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
