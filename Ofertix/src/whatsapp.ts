// Conexão com o WhatsApp. Em produção, pela Evolution API (instalada na VPS, conexão por QR Code).
// Em teste/demonstração, um WhatsApp simulado que só registra os envios.
// Endpoints da Evolution API v2; confirmar na versão instalada.

export interface GrupoWpp { jid: string; nome: string; participantes: number }
export type EstadoWpp = 'conectado' | 'conectando' | 'desconectado';

export interface WhatsApp {
  criarInstancia(chave: string, webhook: string): Promise<void>;
  qrCode(chave: string): Promise<string>;           // data:image/png;base64,... ou ''
  estado(chave: string): Promise<{ estado: EstadoWpp; numero: string }>;
  listarGrupos(chave: string): Promise<GrupoWpp[]>;
  enviar(chave: string, jid: string, texto: string, imagem?: string): Promise<void>;
  desconectar(chave: string): Promise<void>;
  convite(chave: string, jid: string): Promise<string>; // link chat.whatsapp.com do grupo (o número precisa ser admin)
  enquete(chave: string, jid: string, pergunta: string, opcoes: string[], multipla: boolean): Promise<void>;
  /** Imagem de uma mensagem recebida (para o espelhamento), em base64. */
  midia(chave: string, mensagem: any): Promise<{ base64: string; mimetype: string } | null>;
}

export class EvolutionApi implements WhatsApp {
  private url: string;
  private apiKey: string;
  private f: typeof fetch;
  constructor(url: string, apiKey: string, f: typeof fetch = fetch) {
    this.url = url;
    this.apiKey = apiKey;
    this.f = f;
  }

  private async req(metodo: string, caminho: string, corpo?: unknown): Promise<any> {
    const r = await this.f(`${this.url}${caminho}`, {
      method: metodo,
      headers: { apikey: this.apiKey, 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(20000),
    });
    const txt = await r.text();
    let j: any = null;
    try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
    if (!r.ok) throw new Error(`Evolution ${r.status}: ${typeof j === 'string' ? j.slice(0, 200) : JSON.stringify(j?.response ?? j).slice(0, 200)}`);
    return j;
  }

  async criarInstancia(chave: string, webhook: string) {
    await this.req('POST', '/instance/create', {
      instanceName: chave, qrcode: true, integration: 'WHATSAPP-BAILEYS',
      groupsIgnore: false, alwaysOnline: false, readMessages: false,
      webhook: { url: webhook, byEvents: false, base64: false, events: ['MESSAGES_UPSERT', 'GROUP_PARTICIPANTS_UPDATE', 'CONNECTION_UPDATE'] },
    });
  }

  async qrCode(chave: string) {
    const j = await this.req('GET', `/instance/connect/${encodeURIComponent(chave)}`);
    const b64 = j?.base64 ?? j?.qrcode?.base64 ?? '';
    return typeof b64 === 'string' ? b64 : '';
  }

  async estado(chave: string) {
    const j = await this.req('GET', `/instance/connectionState/${encodeURIComponent(chave)}`);
    const s = String(j?.instance?.state ?? j?.state ?? 'close');
    const estado: EstadoWpp = s === 'open' ? 'conectado' : s === 'connecting' ? 'conectando' : 'desconectado';
    let numero = '';
    if (estado === 'conectado') {
      const lista = await this.req('GET', `/instance/fetchInstances?instanceName=${encodeURIComponent(chave)}`).catch(() => null);
      const inst = Array.isArray(lista) ? lista[0] : null;
      numero = String(inst?.ownerJid ?? inst?.instance?.owner ?? '').split('@')[0];
    }
    return { estado, numero };
  }

  async listarGrupos(chave: string) {
    const j = await this.req('GET', `/group/fetchAllGroups/${encodeURIComponent(chave)}?getParticipants=false`);
    return (Array.isArray(j) ? j : []).map((g: any) => ({ jid: String(g.id), nome: String(g.subject ?? 'Grupo'), participantes: Number(g.size ?? g.participants?.length ?? 0) }));
  }

  async enviar(chave: string, jid: string, texto: string, imagem?: string) {
    if (imagem) {
      await this.req('POST', `/message/sendMedia/${encodeURIComponent(chave)}`, {
        number: jid, mediatype: 'image', mimetype: 'image/jpeg', media: imagem, caption: texto, fileName: 'oferta.jpg',
      });
    } else {
      await this.req('POST', `/message/sendText/${encodeURIComponent(chave)}`, { number: jid, text: texto, linkPreview: true });
    }
  }

  async enquete(chave: string, jid: string, pergunta: string, opcoes: string[], multipla: boolean) {
    await this.req('POST', `/message/sendPoll/${encodeURIComponent(chave)}`, { number: jid, name: pergunta, selectableCount: multipla ? opcoes.length : 1, values: opcoes });
  }

  async midia(chave: string, mensagem: any) {
    const j = await this.req('POST', `/chat/getBase64FromMediaMessage/${encodeURIComponent(chave)}`, {
      message: { key: mensagem?.key, message: mensagem?.message }, convertToMp4: false,
    });
    const base64 = String(j?.base64 ?? '');
    return base64 ? { base64, mimetype: String(j?.mimetype ?? mensagem?.message?.imageMessage?.mimetype ?? 'image/jpeg').split(';')[0] } : null;
  }

  async desconectar(chave: string) {
    await this.req('DELETE', `/instance/logout/${encodeURIComponent(chave)}`).catch(() => {});
  }

  async convite(chave: string, jid: string) {
    const j = await this.req('GET', `/group/inviteCode/${encodeURIComponent(chave)}?groupJid=${encodeURIComponent(jid)}`);
    const url = j?.inviteUrl ?? (j?.inviteCode ? `https://chat.whatsapp.com/${j.inviteCode}` : '');
    if (!/^https:\/\/chat\.whatsapp\.com\/\w+/.test(String(url))) throw new Error('O WhatsApp não devolveu o link de convite. O número precisa ser administrador do grupo.');
    return String(url);
  }
}

/** WhatsApp de mentira: conecta na hora, tem grupos fictícios e guarda o que foi "enviado". */
export class WhatsAppSimulado implements WhatsApp {
  enviados: { chave: string; jid: string; texto: string; imagem?: string; enquete?: string[] }[] = [];
  conectados = new Set<string>();
  grupos: GrupoWpp[] = [
    { jid: '120363001@g.us', nome: '#01 Achadinhos do Dia', participantes: 1024 },
    { jid: '120363002@g.us', nome: '#02 Casa & Cozinha VIP', participantes: 812 },
    { jid: '120363003@g.us', nome: '#03 Tech Barato', participantes: 655 },
    { jid: '120363099@g.us', nome: 'Promoções da Concorrência', participantes: 3120 },
  ];
  falharEm = new Set<string>(); // jids que devem dar erro (para testes)

  async criarInstancia(chave: string) { this.conectados.add(chave); }
  async qrCode() { return ''; }
  async estado(chave: string) {
    return this.conectados.has(chave) ? { estado: 'conectado' as const, numero: '5511999990000' } : { estado: 'desconectado' as const, numero: '' };
  }
  async listarGrupos() { return this.grupos.map((g) => ({ ...g })); }
  async enviar(chave: string, jid: string, texto: string, imagem?: string) {
    if (this.falharEm.has(jid)) throw new Error('falha simulada');
    this.enviados.push({ chave, jid, texto, imagem });
  }
  async enquete(chave: string, jid: string, pergunta: string, opcoes: string[]) {
    if (this.falharEm.has(jid)) throw new Error('falha simulada');
    this.enviados.push({ chave, jid, texto: pergunta, enquete: opcoes });
  }
  async desconectar(chave: string) { this.conectados.delete(chave); }
  // PNG de 1×1 ponto, no lugar da foto da mensagem original.
  async midia() { return { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', mimetype: 'image/png' }; }
  async convite(_chave: string, jid: string) { return `https://chat.whatsapp.com/DEMO${jid.replace(/\D/g, '').slice(-6)}`; }
}
