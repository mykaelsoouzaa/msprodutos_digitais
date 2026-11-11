# Trilha original simples e animada (124 bpm): bumbo, chimbal, baixo e acordes, com "pops" nas entradas.
import numpy as np, wave, sys
SR = 44100; DUR = 35.7; BPM = 124; B = 60 / BPM
t = np.arange(int(SR * DUR)) / SR
out = np.zeros_like(t)
rng = np.random.default_rng(7)
def env(x, k): return np.exp(-k * x) * (x >= 0)
# bumbo em todo tempo
for n in range(int(DUR / B) + 1):
    x = t - n * B
    m = (x >= 0) & (x < 0.4)
    f = 50 + 90 * np.exp(-30 * x[m])
    out[m] += 0.55 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(x[m], 9)
# chimbal no contratempo
ruido = rng.standard_normal(len(t))
hp = ruido - np.convolve(ruido, np.ones(6) / 6, 'same')
for n in range(int(DUR / B) + 1):
    x = t - (n + 0.5) * B
    m = (x >= 0) & (x < 0.08)
    out[m] += 0.12 * hp[m] * env(x[m], 60)
# acordes (I–V–vi–IV em Ré): baixo + pad
acordes = [(146.83, [293.66, 369.99, 440.0]), (220.0, [277.18, 329.63, 440.0]), (246.94, [293.66, 369.99, 493.88]), (196.0, [293.66, 392.0, 493.88])]
compasso = 4 * B
for k in range(int(DUR / compasso) + 1):
    baixo, notas = acordes[k % 4]
    for n in range(8):  # baixo em colcheias
        x = t - (k * compasso + n * B / 2)
        m = (x >= 0) & (x < B / 2)
        out[m] += 0.16 * np.sign(np.sin(2 * np.pi * baixo / 2 * x[m])) * env(x[m], 6) * 0.6
    x = t - k * compasso
    m = (x >= 0) & (x < compasso)
    for f in notas:
        out[m] += 0.045 * (np.sin(2 * np.pi * f * x[m]) + 0.3 * np.sin(2 * np.pi * 2 * f * x[m])) * (1 - np.exp(-8 * x[m])) * np.exp(-0.5 * x[m])
# pops nas entradas de cada cena e no contador
for s in [0.6, 8.2, 17.2, 23.2, 29.2, 32.5]:
    x = t - s; m = (x >= 0) & (x < 0.15)
    out[m] += 0.25 * np.sin(2 * np.pi * (900 + 2500 * x[m]) * x[m]) * env(x[m], 30)
# entrada e saída suaves
fade = np.minimum(1, t / 0.4) * np.minimum(1, (DUR - t) / 1.2)
out = np.tanh(out * 1.4) * fade * 0.8
pcm = (np.stack([out, out], 1) * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
