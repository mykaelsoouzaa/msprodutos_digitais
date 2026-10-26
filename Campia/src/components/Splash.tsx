// Tela de abertura: o símbolo se desenha, a bola entra, o nome "campia" se completa e a versão aparece.
// Só aparece no primeiro carregamento da sessão (e sempre ao abrir o app instalado); navegações internas não repetem.
// É só HTML + CSS, então aparece antes do JavaScript carregar e some sozinha.
import { APP_VERSION } from '@/lib/version';

const SKIP = `try{if(sessionStorage.getItem('campia-splash')){document.documentElement.classList.add('no-splash')}else{sessionStorage.setItem('campia-splash','1')}}catch(e){}`;

export default function Splash() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SKIP }} />
      <div className="splash" aria-hidden="true">
        <div className="splash-logo">
          <svg className="splash-sym" viewBox="0 0 512 512" width="84" height="84">
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#16a34a" /><stop offset="1" stopColor="#84cc16" /></linearGradient>
            </defs>
            <rect className="splash-bg" width="512" height="512" rx="116" fill="url(#sg)" />
            <path className="splash-arc" d="M 360 160 A 142 142 0 1 0 360 352" fill="none" stroke="#fff" strokeWidth="70" strokeLinecap="round" pathLength={100} />
            <circle className="splash-ball" cx="372" cy="256" r="40" fill="#06210f" />
          </svg>
          <span className="splash-name"><img src="/brand/campia-nome-claro.svg" alt="" height={52} /></span>
        </div>
        <div className="splash-ver">versão {APP_VERSION}</div>
      </div>
    </>
  );
}
