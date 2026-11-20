import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tienda-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="shop-footer">
      <div class="footer-top">
        <div class="footer-brand-col">
          <a class="footer-brand" routerLink="/tienda/productos">TRAMA<span>.</span></a>
          <p class="footer-tagline">Prendas para todos los días. Estilo para el tuyo.</p>
          <div class="footer-badge">
            <span>UNLaM · Taller Web II (2C 2026)</span>
            <strong>Grupo 9</strong>
          </div>
        </div>

        <div class="footer-nav-col">
          <span class="col-title">Navegación</span>
          <a routerLink="/tienda/productos">Colección</a>
          <a routerLink="/tienda/favoritos">Mis favoritos</a>
          <a routerLink="/tienda/carrito">Mi carrito</a>
          <a routerLink="/tienda/pedidos">Mis pedidos</a>
        </div>

        <div class="footer-team-col">
          <span class="col-title">Integrantes (Grupo 9)</span>
          <ul class="team-list">
            <li>Sebastián Ángel Díaz</li>
            <li>Martín Videla</li>
            <li>Lucas Osorio</li>
            <li>Gonzalo Amarilla</li>
            <li>Alejo Gonzalez</li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>© 2026 TRAMA — Trabajo Práctico Grupo 9 · UNLaM</p>
        <a href="#top" (click)="subir($event)">Volver arriba ↑</a>
      </div>
    </footer>
  `,
  styles: [
    `
      .shop-footer {
        margin-top: 70px;
        border-top: 1px solid #e2e7dc;
        padding: 45px 0 30px;
        color: #7d8b76;
        font:
          12px 'Segoe UI',
          Arial,
          sans-serif;
      }
      .footer-top {
        display: grid;
        grid-template-columns: 1.4fr 1fr 1.2fr;
        gap: 36px;
        padding-bottom: 30px;
        border-bottom: 1px solid #edf0e7;
      }
      .footer-brand {
        display: inline-block;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: 2px;
        color: #284d3e;
        text-decoration: none;
      }
      .footer-brand span {
        color: #9bab82;
      }
      .footer-tagline {
        margin: 8px 0 14px;
        font-size: 13px;
        color: #63735c;
        line-height: 1.5;
      }
      .footer-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #edf3e8;
        color: #385b42;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 11px;
      }
      .footer-badge strong {
        background: #284d3e;
        color: white;
        padding: 2px 7px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 10px;
        letter-spacing: 0.5px;
      }
      .col-title {
        display: block;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: #4b624a;
        margin-bottom: 14px;
      }
      .footer-nav-col a {
        display: block;
        color: #687a61;
        text-decoration: none;
        margin-bottom: 8px;
        font-size: 12px;
      }
      .footer-nav-col a:hover {
        color: #284d3e;
        text-decoration: underline;
      }
      .team-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .team-list li {
        margin-bottom: 6px;
        color: #5c6e55;
        font-size: 12px;
      }
      .footer-bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        padding-top: 22px;
        font-size: 11px;
        color: #8c9a85;
      }
      .footer-bottom a {
        color: #486842;
        text-decoration: none;
        font-weight: 500;
      }
      .footer-bottom a:hover {
        text-decoration: underline;
      }
      @media (max-width: 768px) {
        .footer-top {
          grid-template-columns: 1fr 1fr;
          gap: 28px;
        }
        .footer-brand-col {
          grid-column: 1 / -1;
        }
      }
      @media (max-width: 480px) {
        .footer-top {
          grid-template-columns: 1fr;
          gap: 22px;
        }
        .footer-bottom {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
      }
    `,
  ],
})
export class TiendaFooter {
  subir(event: Event) {
    event.preventDefault();
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }
}
