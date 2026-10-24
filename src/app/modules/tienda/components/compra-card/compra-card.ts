import { Component, input } from '@angular/core';
import { DatosCompra } from '../../interfaces/datos-compra';
import { CurrencyPipe } from '@angular/common';

@Component({
  imports: [CurrencyPipe],
  selector: 'app-compra-card',
  styleUrl: './compra-card.css',
  templateUrl: './compra-card.html',
})
export class CompraCard {
  compra = input<DatosCompra>();
}
