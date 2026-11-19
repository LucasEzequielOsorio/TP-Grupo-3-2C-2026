import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCard } from './product-card';

describe('Tarjeta de producto', () => {
  let component: ProductCard;
  let fixture: ComponentFixture<ProductCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCard],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('muestra el estado de favorito y emite el producto al alternarlo', () => {
    fixture.componentRef.setInput('producto', {
      id: 12,
      nombre: 'Remera',
      descripcion: '',
      precio: 100,
      stock: 1,
    });
    fixture.componentRef.setInput('favorito', true);
    fixture.detectChanges();

    const boton = fixture.nativeElement.querySelector('.boton-favorito') as HTMLButtonElement;
    expect(boton.getAttribute('aria-pressed')).toBe('true');

    const cambios: number[] = [];
    component.favoritoCambiado.subscribe((id) => cambios.push(id));
    boton.click();
    expect(cambios).toEqual([12]);
  });
});
