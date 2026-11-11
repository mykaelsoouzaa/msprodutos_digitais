# Gera prototipo/index.html: o painel com a API simulada e uma foto dos dados de demonstração.
# Uso: python3 scripts/gerar-prototipo.py caminho/snapshot.json
import sys, json, time, re
dados = json.load(open(sys.argv[1]))
html = open('public/index.html').read()
mock = open('scripts/mock-prototipo.js').read()
foto = json.dumps({'tirada': int(time.time() * 1000), 'dados': dados}, ensure_ascii=False).replace('</', '<\\/')
inj = f"<script>window.OFERTIX_FOTO={foto};</script>\n<script>{mock}</script>\n<script>\n'use strict';"
out = html.replace("<script>\n'use strict';", inj, 1)
out = out.replace('Você está no painel de demonstração: os dados são fictícios e o WhatsApp é simulado. Fique à vontade para testar tudo.',
                  'Protótipo do Ofertix: dados fictícios e WhatsApp simulado. Cole um link, envie uma oferta, ligue grupos e cadastre cupons.')
# O publicador de artifacts coloca o próprio esqueleto (doctype/html/head/body).
out = re.sub(r'<!doctype html>\s*<html[^>]*>\s*<head>\s*', '', out, count=1)
out = out.replace('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n', '', 1)
out = out.replace('</head>\n<body>\n', '', 1).replace('</body>\n</html>', '')
open('prototipo/index.html', 'w').write(out)
print('prototipo/index.html', len(out))
