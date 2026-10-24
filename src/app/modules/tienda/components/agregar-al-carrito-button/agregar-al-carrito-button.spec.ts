import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgregarAlCarritoButton } from './agregar-al-carrito-button';

describe('AgregarAlCarritoButton', () => {
  let component: AgregarAlCarritoButton;
  let fixture: ComponentFixture<AgregarAlCarritoButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgregarAlCarritoButton],
    }).compileComponents();

    fixture = TestBed.createComponent(AgregarAlCarritoButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
