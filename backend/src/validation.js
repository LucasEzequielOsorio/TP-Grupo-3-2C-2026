import { z } from 'zod';

const id = z.number().int().positive().max(4294967295);
const text = (max) => z.string().trim().min(1).max(max);
export const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Contraseña demasiado larga');
export const loginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
});
export const registerSchema = loginSchema.extend({
  password: passwordSchema,
  nombre: text(100),
  apellido: text(100),
  direccion: text(255),
});
const stockSchema = z.object({ ubicacion_id: id, cantidad: z.number().int().min(0).max(1000000) });
const varianteSchema = z.object({
  stock_minimo: z.number().int().min(0).max(1000000).default(3),
  id: id.optional(),
  talle_id: id,
  color_id: id,
  sku: text(64).regex(/^[A-Za-z0-9_-]+$/, 'SKU: usar letras, números, guiones o guiones bajos'),
  activo: z.boolean(),
  existencias: z.array(stockSchema).max(100),
});
export const productSchema = z
  .object({
    nombre: text(150),
    descripcion: text(5000),
    categoria_id: id,
    precio: z
      .number()
      .positive()
      .max(99999999.99)
      .refine(
        (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
        'Precio con hasta dos decimales',
      ),
    imagen_url: z
      .union([
        z.literal(''),
        z.string().regex(/^\/api\/imagenes\/[a-f0-9-]{36}\.webp$/),
        z
          .url()
          .max(2048)
          .refine(
            (v) => ['http:', 'https:'].includes(new URL(v).protocol),
            'Imagen debe ser HTTP o HTTPS',
          ),
      ])
      .default(''),
    activo: z.boolean(),
    version: id.optional(),
    variantes: z.array(varianteSchema).min(1).max(100),
  })
  .superRefine((data, ctx) => {
    const unique = (values, message) => {
      if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message });
    };
    unique(
      data.variantes.map((v) => `${v.talle_id}:${v.color_id}`),
      'Hay combinaciones de talle y color repetidas',
    );
    unique(
      data.variantes.map((v) => v.sku.toLowerCase()),
      'Hay SKU repetidos',
    );
    unique(
      data.variantes.filter((v) => v.id).map((v) => v.id),
      'Hay variantes repetidas',
    );
    for (const v of data.variantes)
      unique(
        v.existencias.map((e) => e.ubicacion_id),
        'Hay ubicaciones repetidas',
      );
  });
// Comparte las reglas de la imagen principal; una foto de galería no puede estar vacía.
export const gallerySchema = z
  .array(productSchema.shape.imagen_url.refine((v) => v !== '', 'Imagen vacía'))
  .max(8)
  .refine((values) => new Set(values).size === values.length, 'No repitas imágenes');
export function parseId(value) {
  if (!/^[1-9]\d*$/.test(String(value))) throw httpError(400, 'Identificador inválido');
  return id.parse(Number(value));
}
export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
