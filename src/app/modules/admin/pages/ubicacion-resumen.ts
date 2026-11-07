import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { InventarioService, ResumenUbicacion } from '../../../api/services/inventario.service';
import { AdminNav } from './admin-nav';
@Component({
  selector: 'app-ubicacion-resumen',
  imports: [AdminNav, FormsModule, RouterLink],
  templateUrl: './ubicacion-resumen.html',
  styleUrl: './tools.css',
})
export class UbicacionResumen implements OnInit, OnDestroy {
  private api = inject(InventarioService);
  private route = inject(ActivatedRoute);
  private request?: Subscription;
  id = Number(this.route.snapshot.paramMap.get('id'));
  datos = signal<ResumenUbicacion | null>(null);
  cargando = signal(false);
  error = signal('');
  buscar = '';
  estado = 'todos';
  ngOnInit() {
    this.cargar();
  }
  cargar(pagina = 1) {
    this.request?.unsubscribe();
    this.cargando.set(true);
    this.error.set('');
    this.request = this.api
      .resumen(this.id, { pagina, buscar: this.buscar, estado: this.estado })
      .subscribe({
        next: (datos) => {
          this.datos.set(datos);
          this.cargando.set(false);
        },
        error: (e) => {
          this.cargando.set(false);
          this.error.set(e.error?.mensaje || 'No se pudo cargar el resumen de esta ubicación');
        },
      });
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
  }
}
