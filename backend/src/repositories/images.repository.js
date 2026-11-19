import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const imagesDirectory = fileURLToPath(new URL('../../uploads/', import.meta.url));

export async function saveImageFile(contents) {
  const filename = `${randomUUID()}.webp`;
  await mkdir(imagesDirectory, { recursive: true });
  await writeFile(join(imagesDirectory, filename), contents, { flag: 'wx' });
  return filename;
}
