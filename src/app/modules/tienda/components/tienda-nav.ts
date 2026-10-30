import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { UsuarioService } from '../../../api/services/usuario.service';
@Component({
  selector: 'app-tienda-nav',
  imports: [RouterLink],
  template: `<div class="announcement">TRAMA · Prendas para acompañarte todos los días</div>
    <nav aria-label="Tienda">
      <a class="brand" routerLink="/tienda/productos">TRAMA<span>.</span></a
      ><a class="catalog-link" routerLink="/tienda/productos">Colección</a>
      <div class="right">
        @if (!auth.isLogged()) {
          <a routerLink="/bienvenido/login">Iniciar sesión</a
          ><a class="register" routerLink="/bienvenido/signup">Crear cuenta</a>
        } @else {
          @if (auth.isAdmin()) {
            <a routerLink="/admin/productos">Administración</a>
          } @else {
            <span>Cuenta de cliente</span>
          }
          <button type="button" (click)="salir()">Cerrar sesión</button>
        }
      </div>
    </nav>`,
  styles: [
    `
      .announcement {
        background: #284d3e;
        color: #e6eddf;
        text-align: center;
        padding: 10px 16px;
        font:
          10px 'Segoe UI',
          sans-serif;
        letter-spacing: 1px;
      }
      nav {
        font:
          12px 'Segoe UI',
          sans-serif;
        display: flex;
        align-items: center;
        gap: 48px;
        padding: 25px max(22px, calc((100vw - 1160px) / 2));
        background: #fff;
        border-bottom: 1px solid #e8e9e1;
      }
      a {
        text-decoration: none;
        color: #57634c;
      }
      button {
        border: 0;
        background: none;
        color: #57634c;
        cursor: pointer;
        font: inherit;
        padding: 5px 0;
      }
      .brand {
        font-size: 29px;
        letter-spacing: 2px;
        font-weight: 800;
        color: #284d3e;
      }
      .brand span {
        color: #9bab82;
      }
      .catalog-link {
        border-bottom: 1px solid #708964;
        padding-bottom: 5px;
      }
      .right {
        display: flex;
        align-items: center;
        gap: 18px;
        margin-left: auto;
        font-size: 11px;
        color: #8b947d;
      }
      .register {
        border: 1px solid #d9e2cd;
        border-radius: 5px;
        padding: 9px 12px;
      }
      @media (max-width: 650px) {
        nav {
          padding: 20px;
          gap: 25px;
        }
        .right {
          max-width: 180px;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
          text-align: right;
          font-size: 10px;
        }
      }
    `,
  ],
})
export class TiendaNav {
  auth = inject(UsuarioService);
  private router = inject(Router);
  salir() {
    this.auth.logout();
    this.router.navigate(['/tienda/productos']);
  }
}
