export type ThemeMode = 'auto' | 'light' | 'dark';
export const THEME_KEY = 'campia-tema';
export const THEME_COLORS = { light: '#f4f7f5', dark: '#0b1410' } as const;

/** Roda no <head>, antes de pintar a tela: aplica o tema salvo (evita piscar). */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',t==='light'?'${THEME_COLORS.light}':'${THEME_COLORS.dark}')})}}catch(e){}`;
