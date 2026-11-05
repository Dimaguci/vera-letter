import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const [template, styles, logic, app, sticker, favicon] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
  readFile(new URL('game-logic.js', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('assets/vera-sticker.png', root)),
  readFile(new URL('assets/favicon.svg', root), 'utf8'),
]);
const script = `(() => {\n${logic.replace(/^export /gm, '')}\n${app.replace(/^import[^\n]*\n/, '')}\n})();`.replace(/<\/script/gi, '<\\/script');
const output = template
  .replace('<link rel="stylesheet" href="./styles.css" />', `<style>\n${styles}\n</style>`)
  .replace('<script type="module" src="./app.js"></script>', '')
  .replace('./assets/favicon.svg', `data:image/svg+xml,${encodeURIComponent(favicon)}`)
  .replace('</body>', `<script>\n${script}\n</script>\n</body>`)
  .replaceAll('./assets/vera-sticker.png', `data:image/png;base64,${sticker.toString('base64')}`);
const target = new URL('../Для Веры.html', root);
await writeFile(target, output, 'utf8');
console.log(`Готово: ${fileURLToPath(target)}`);
