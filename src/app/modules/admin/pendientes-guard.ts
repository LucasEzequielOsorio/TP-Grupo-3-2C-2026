import { CanDeactivateFn } from '@angular/router';

export interface EditorConCambios {
  tieneCambios(): boolean;
  enProceso(): boolean;
}
export const pendientesGuard: CanDeactivateFn<EditorConCambios> = (component) => {
  if (component.enProceso()) return false;
  return (
    !component.tieneCambios() ||
    window.confirm('Tenés cambios sin guardar. ¿Querés salir y descartarlos?')
  );
};
