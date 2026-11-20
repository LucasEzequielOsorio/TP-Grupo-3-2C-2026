import { Component, inject } from '@angular/core';
import { AvisoService } from '../../services/aviso.service';

@Component({
  selector: 'app-aviso',
  template: `
    @if (avisos.mensaje(); as mensaje) {
      <div class="aviso" role="status" aria-live="polite">
        <span class="marca" aria-hidden="true">✓</span>
        <span>{{ mensaje }}</span>
        <button type="button" aria-label="Cerrar aviso" (click)="avisos.cerrar()">×</button>
      </div>
    }
  `,
  styles: `
    .aviso {
      position: fixed;
      z-index: 1000;
      right: 24px;
      bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: min(390px, calc(100vw - 32px));
      padding: 14px 16px;
      border: 1px solid #dce5d5;
      border-left: 4px solid #6f8b5a;
      border-radius: 9px;
      background: #fff;
      color: #344536;
      box-shadow: 0 10px 32px #263b291f;
      font: 13px 'Segoe UI', Arial, sans-serif;
      animation: aparecer 180ms ease-out;
    }
    .marca {
      display: grid;
      flex: 0 0 23px;
      width: 23px;
      height: 23px;
      place-items: center;
      border-radius: 50%;
      background: #edf3e8;
      color: #49673e;
      font-weight: 700;
    }
    button {
      margin-left: auto;
      padding: 0 0 2px 8px;
      border: 0;
      background: transparent;
      color: #788273;
      cursor: pointer;
      font: 20px/1 'Segoe UI', Arial, sans-serif;
    }
    @keyframes aparecer {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @media (max-width: 500px) {
      .aviso {
        right: 16px;
        bottom: 16px;
        left: 16px;
        max-width: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .aviso {
        animation: none;
      }
    }
  `,
})
export class Aviso {
  avisos = inject(AvisoService);
}
