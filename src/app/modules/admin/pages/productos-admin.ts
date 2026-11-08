import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  AdminProductosService,
  ProductoAdmin,
} from '../../../api/services/admin-productos.service';
import { UsuarioService } from '../../../api/services/usuario.service';

@Component({
  selector: 'app-productos-admin',
  imports: [FormsModule, CurrencyPipe, RouterLink],
  templateUrl: './productos-admin.html',
  styleUrl: './admin.css',
})
export class ProductosAdmin implements OnInit {
  private api = inject(AdminProductosService);
  private auth = inject(UsuarioService);
  private router = inject(Router);
  productos = signal<ProductoAdmin[]>([]);
  buscando = signal('');
  filtro = signal('todos');
  cargando = signal(true);
  error = signal('');
  visibles = computed(() =>
    this.productos().filter((p) => {
      const q = this.buscando().trim().toLocaleLowerCase();
      return (
        `${p.nombre} ${p.clasificacion}`.toLocaleLowerCase().includes(q) &&
        (this.filtro() === 'todos' || (this.filtro() === 'activos' ? p.activo : !p.activo))
      );
    }),
  );
  activos = computed(() => this.productos().filter((p) => p.activo).length);
  unidades = computed(() => this.productos().reduce((sum, p) => sum + (p.stock || 0), 0));
  agotados = computed(() => this.productos().filter((p) => p.activo && !p.stock).length);
  ngOnInit() {
    this.cargar();
  }
  cargar() {
    this.error.set('');
    this.cargando.set(true);
    this.api.listar().subscribe({
      next: (rows) => {
        this.productos.set(rows);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        if (e.status === 401) {
          this.salir();
          return;
        }
        this.error.set(
          e.error?.mensaje ||
            'No se pudieron cargar los productos. Comprobá que la API esté iniciada.',
        );
      },
    });
  }
  salir() {
    this.auth.logout();
    this.router.navigate(['/bienvenido/login']);
  }
}
