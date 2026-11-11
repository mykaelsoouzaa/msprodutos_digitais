# Tira a "foto" das respostas da API de demonstração para o protótipo.
# Uso: python3 scripts/foto-demo.py http://localhost:3200 > snapshot.json  (com o servidor rodando em modo demo)
import sys, json, urllib.request
base = sys.argv[1].rstrip('/')
class SemRedirecionar(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
try:
    urllib.request.build_opener(SemRedirecionar).open(base + '/demo')
except urllib.error.HTTPError as e:
    cookie = e.headers['set-cookie'].split(';')[0]  # o cookie pode ser Secure; aqui vai à mão
def get(p): return json.load(urllib.request.urlopen(urllib.request.Request(base + '/api/' + p, headers={'cookie': cookie})))
out = {}
paths = ['eu', 'grupos', 'numeros', 'cupons', 'config', 'avisos', 'agendamentos', 'ofertas', 'ofertas?origem=manual', 'ofertas?origem=captura', 'ofertas?origem=vitrine']
paths += ['agendamentos?status=' + st for st in ['pendente', 'enviado', 'erro', 'cancelado']]
for p in ['hoje', 'ontem', '7d', '30d', 'mes', 'mes-anterior']:
    paths += ['visao?periodo=' + p, 'membros?periodo=' + p, 'comissoes?periodo=' + p, 'entradas?periodo=' + p]
    paths += [f'comissoes?periodo={p}&status={st}' for st in ['concluido', 'pendente', 'cancelado']]
for p in paths: out[p] = get(p)
for g in [x['id'] for x in out['grupos']['lista'] if x['enviar'] or x['monitorar']]:
    for p in ['7d', '30d', 'mes', 'mes-anterior']: out[f'membros?periodo={p}&grupo={g}'] = get(f'membros?periodo={p}&grupo={g}')
print(json.dumps(out, ensure_ascii=False))
