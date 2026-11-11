// Renderiza cada cena direto para um .mp4 (quadros JPEG pelo pipe, sem salvar imagens).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const D = __dirname + '/';
const CENAS = (process.argv[2] ? [['c1', 8.2]] : [['c1', 8.2], ['c2', 9], ['c3', 6], ['c4', 6], ['c5', 6.5]]);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + D + 'cenas.html');
  await p.evaluate(() => document.fonts.ready);
  for (const [c, dur] of CENAS) {
    const tmp = `${D}${c}.tmp.mp4`;
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', '-',
      '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', tmp]);
    const fim = new Promise((r, j) => ff.on('exit', (code) => (code === 0 ? r() : j(new Error(c + ' ffmpeg ' + code)))));
    const n = Math.round(dur * 30);
    for (let i = 0; i < n; i++) {
      await p.evaluate(([c, t]) => window.render(c, t), [c, i / 30]);
      const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await fim;
    fs.renameSync(tmp, `${D}${c}.mp4`);
    console.log(c, 'ok', n);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
