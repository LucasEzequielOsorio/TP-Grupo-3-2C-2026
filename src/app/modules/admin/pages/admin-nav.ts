import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { UsuarioService } from '../../../api/services/usuario.service';

@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `<nav aria-label="Administración">
    <a class="brand" routerLink="/admin/productos">TRAMA<span>.</span></a>
    <div class="links">
      <a routerLink="/admin/productos" routerLinkActive="selected">Productos</a
      ><a routerLink="/admin/alertas" routerLinkActive="selected">Stock bajo</a
      ><a routerLink="/admin/movimientos" routerLinkActive="selected">Movimientos</a
      ><a routerLink="/admin/catalogos" routerLinkActive="selected">Catálogos</a>
      <a routerLink="/admin/ubicaciones" routerLinkActive="selected">Depósitos</a>
      <a routerLink="/admin/transferencias" routerLinkActive="selected">Transferencias</a>
    </div>
    <button type="button" (click)="salir()">Cerrar sesión</button>
  </nav>`,
  styles: [
    `
      nav {
        font:
          13px 'Segoe UI',
          sans-serif;
        display: flex;
        align-items: center;
        gap: 25px;
        background: white;
        padding: 20px max(20px, calc((100vw - 1160px) / 2));
        border-bottom: 1px solid #e0e5dc;
        flex-wrap: wrap;
      }
      .brand {
        font-size: 25px;
        font-weight: 800;
        letter-spacing: 2px;
        color: #284d3e;
        text-decoration: none;
      }
      .brand span {
        color: #91a88a;
      }
      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        flex: 1;
      }
      .links a {
        padding: 9px 12px;
        border-radius: 6px;
        text-decoration: none;
        color: #718068;
      }
      .links a.selected {
        background: #eaf1e5;
        color: #345c38;
      }
      button {
        border: 0;
        background: none;
        color: #7a866e;
        cursor: pointer;
        font: inherit;
      }
      @media (max-width: 650px) {
        nav {
          gap: 12px;
        }
        .links {
          order: 3;
          flex-basis: 100%;
        }
      }
    `,
  ],
})
export class AdminNav {
  private auth = inject(UsuarioService);
  private router = inject(Router);
  salir() {
    // Si el guard cancela la salida por cambios pendientes, restaura la sesión.
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('user_role');
    this.auth.logout();
    this.router.navigate(['/bienvenido/login']).then((ok) => {
      if (!ok) {
        if (token) localStorage.setItem('auth_token', token);
        if (role) localStorage.setItem('user_role', role);
      }
    });
  }
}
