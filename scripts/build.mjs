import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');

// Only files used by the public site are deployed. Source originals stay in Git,
// while every published file is copied byte-for-byte without minification or
// image re-encoding. This keeps rendering identical and makes deploys smaller.
const publicFiles = [
  'index.html',
  'produkty.html',
  'premium.css',
  'premium.js',
  'logo-sm.jpg',
  'logo_full.jpg',
  'tvoy.webp',
  'tvoy-1600.webp',
  'tvoy-fallback.jpg',
  'tvoy-1600.jpg',
  'assort.webp',
  'assort-1600.webp',
  'assort-fallback.jpg',
  'sitemap.xml',
  'robots.txt',
  'googledc66c2f321edd635.html',
  'yandex_f96562d44c2a008d.html',
];

const publicSet = new Set(publicFiles);
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const css = await readFile(resolve(root, 'premium.css'), 'utf8');
const js = await readFile(resolve(root, 'premium.js'), 'utf8');
const problems = [];

function normalizeLocalReference(reference) {
  const value = reference.trim().split(/[?#]/, 1)[0];
  if (!value || /^(?:[a-z]+:|#|\/\/)/i.test(value)) return null;
  return decodeURIComponent(value.replace(/^\//, ''));
}

function collectLocalReferences() {
  const references = new Set();

  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    const value = normalizeLocalReference(match[1]);
    if (value) references.add(value);
  }

  for (const match of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const candidate of match[1].split(',')) {
      const value = normalizeLocalReference(candidate.trim().split(/\s+/, 1)[0]);
      if (value) references.add(value);
    }
  }

  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const value = normalizeLocalReference(match[1]);
    if (value) references.add(value);
  }

  return [...references].sort();
}

function stripCssStringsAndComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
}

for (const tag of [
  'html', 'head', 'body', 'main', 'section', 'div', 'nav',
  'footer', 'article', 'a', 'button', 'picture', 'script', 'style',
]) {
  const opened = (html.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
  const closed = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
  if (opened !== closed) problems.push(`Нарушен баланс <${tag}>: ${opened}/${closed}`);
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) problems.push(`Повторяющиеся id: ${duplicateIds.join(', ')}`);

const idSet = new Set(ids);
for (const match of html.matchAll(/\b(?:href|aria-controls)=["']#([^"']+)["']/gi)) {
  if (!idSet.has(match[1])) problems.push(`Не найден якорь #${match[1]}`);
}

for (const [, attributes, source] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc=/i.test(attributes)) continue;
  try {
    if (/application\/ld\+json/i.test(attributes)) JSON.parse(source);
    else new Function(source);
  } catch (error) {
    problems.push(`Некорректный inline script: ${error.message}`);
  }
}

try {
  new Function(js);
} catch (error) {
  problems.push(`Некорректный premium.js: ${error.message}`);
}

const cleanCss = stripCssStringsAndComments(css);
const cssOpened = (cleanCss.match(/{/g) || []).length;
const cssClosed = (cleanCss.match(/}/g) || []).length;
if (cssOpened !== cssClosed) problems.push(`Нарушен баланс CSS: ${cssOpened}/${cssClosed}`);

const localReferences = collectLocalReferences();
for (const reference of localReferences) {
  if (!publicSet.has(reference)) {
    problems.push(`Локальный ресурс не включён в deploy: ${reference}`);
  }
}

for (const file of publicFiles) {
  try {
    const fileStat = await stat(resolve(root, file));
    if (!fileStat.isFile()) problems.push(`Не файл: ${file}`);
  } catch {
    problems.push(`Отсутствует production-файл: ${file}`);
  }
}

if (problems.length) {
  console.error('Сборка остановлена:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let totalBytes = 0;
for (const file of publicFiles) {
  const source = resolve(root, file);
  const destination = resolve(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);

  const [sourceBuffer, destinationBuffer] = await Promise.all([
    readFile(source),
    readFile(destination),
  ]);
  const sourceHash = createHash('sha256').update(sourceBuffer).digest('hex');
  const destinationHash = createHash('sha256').update(destinationBuffer).digest('hex');

  if (sourceHash !== destinationHash) {
    throw new Error(`Побайтная проверка не пройдена: ${file}`);
  }

  totalBytes += destinationBuffer.byteLength;
}

console.log(`✓ Проверено локальных ссылок: ${localReferences.length}`);
console.log(`✓ Production-файлов: ${publicFiles.length}`);
console.log(`✓ Размер deploy: ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);
console.log('✓ Все опубликованные файлы побайтно идентичны исходникам');
