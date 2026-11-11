// Desenha alguns quadros para conferir antes do render completo.
const { chromium } = require('playwright');
const D = __dirname + '/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + D + 'cenas.html');
  await p.evaluate(() => document.fonts.ready);
  for (const [c, t] of [['c1', 6.5], ['c2', 8.2], ['c3', 4], ['c4', 4], ['c5', 2.4], ['c5', 5.5]]) {
    await p.evaluate(([c, t]) => window.render(c, t), [c, t]);
    await p.screenshot({ path: `${D}q-${c}-${t}.jpg`, type: 'jpeg', quality: 80 });
  }
  await b.close();
})();
