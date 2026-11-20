import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { InicioDeSesion } from './inicio-de-sesion';

describe('InicioDeSesion', () => {
  let component: InicioDeSesion;
  let fixture: ComponentFixture<InicioDeSesion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InicioDeSesion],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(InicioDeSesion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
