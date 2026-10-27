import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = { title: 'Política de Privacidade', description: 'Como a Campia coleta, usa e protege os seus dados, conforme a LGPD.' };

export default function Privacidade() {
  return (
    <LegalPage title="Política de Privacidade">
      <p>Esta política explica quais dados pessoais a Campia coleta, para que usa, com quem compartilha e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).</p>

      <h2>1. Quem é o responsável</h2>
      <p>O controlador dos dados é a {COMPANY.name}{COMPANY.cnpj ? `, CNPJ ${COMPANY.cnpj}` : ''}. Contato do encarregado de dados: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
      <p>Em relação aos dados dos times e atletas de um campeonato, o organizador também decide como usá-los na organização do evento e é responsável por esse uso.</p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li><b>Organizadores e ajudantes:</b> e-mail de acesso; dados da página da arena (nome, logo, endereço, WhatsApp e Instagram, se informados); Wallet ID do Asaas, se o repasse automático for ligado.</li>
        <li><b>Capitães:</b> nome, WhatsApp e e-mail. O CPF ou CNPJ é enviado direto ao Asaas para gerar o PIX e <b>não é guardado pela Campia</b>.</li>
        <li><b>Perfil de atleta (opcional):</b> nome, cidade e texto que você mesmo preencher, e os campeonatos que você ligar ao perfil. Essa página é pública; você pode tirar campeonatos ou apagar o perfil quando quiser.</li>
        <li><b>Lista de espera:</b> nome do time, do capitão, e-mail e WhatsApp, para avisar quando abrir vaga.</li>
        <li><b>Atletas:</b> nome, número da camisa, gols, cartões e outras estatísticas do campeonato.</li>
        <li><b>Pagamentos:</b> valor, situação e identificadores da cobrança no Asaas. A Campia não recebe dados bancários de quem paga.</li>
        <li><b>Lembretes no celular:</b> se você ativar, guardamos o endereço técnico de notificação do seu aparelho e o time que você segue.</li>
        <li><b>Dados técnicos:</b> cookies de sessão para manter você logado e preferências salvas no navegador (por exemplo, se você fechou o aviso de instalar o app). Não usamos cookies de publicidade.</li>
        <li><b>Contagem de visitas:</b> quando alguém abre a página de um campeonato, somamos 1 visita no dia e anotamos só a origem geral (por exemplo, WhatsApp ou Google), para o organizador saber onde a divulgação funciona. Não guardamos IP, nome nem nada que identifique quem visitou.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Criar e operar os campeonatos: tabelas, jogos, inscrições, resultados e estatísticas (execução de contrato).</li>
        <li>Processar pagamentos e repasses (execução de contrato e obrigações legais).</li>
        <li>Enviar e-mails de acesso, lembretes de pagamento e de jogos (execução de contrato).</li>
        <li>Mostrar ao organizador os contatos dos capitães para a organização do evento.</li>
        <li>Segurança, prevenção a fraudes e melhoria da plataforma (legítimo interesse).</li>
      </ul>

      <h2>4. O que fica público</h2>
      <p>Na página do campeonato aparecem o nome dos times e dos atletas, os resultados, a classificação e as estatísticas. Ao se inscrever, o capitão declara que os atletas autorizam essa exibição. <b>WhatsApp, e-mail e CPF nunca aparecem</b> na página pública. Campeonatos marcados como "só com o link" não aparecem na busca da Campia.</p>

      <h2>5. Com quem compartilhamos</h2>
      <p>Só com os serviços necessários para a Campia funcionar, que tratam os dados conforme as nossas instruções:</p>
      <ul>
        <li><b>Asaas</b>: pagamentos por PIX e repasses.</li>
        <li><b>Supabase</b>: banco de dados e login (servidores em São Paulo).</li>
        <li><b>Vercel</b>: hospedagem do site (pode processar dados fora do Brasil, com garantias contratuais de proteção).</li>
        <li><b>Brevo</b>: envio de e-mails automáticos.</li>
        <li>Serviços de notificação do navegador (Google, Apple, Mozilla), para os lembretes que você ativar.</li>
      </ul>
      <p>Também compartilhamos com o organizador do campeonato os dados dos times inscritos nele, e com autoridades quando a lei exigir. Não vendemos dados pessoais.</p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>Enquanto a conta ou o campeonato existir. Quando o organizador exclui um campeonato, os times, atletas, jogos e contatos dele são apagados. Registros de pagamento podem ser mantidos pelo prazo exigido pela legislação fiscal.</p>

      <h2>7. Seus direitos</h2>
      <p>Você pode pedir a qualquer momento: confirmação de que tratamos seus dados, acesso, correção, anonimização ou exclusão, portabilidade, informação sobre com quem compartilhamos e revisão do consentimento. Basta escrever para <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Se o pedido for sobre um campeonato específico, também podemos encaminhá-lo ao organizador. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

      <h2>8. Segurança</h2>
      <p>Usamos conexão criptografada (HTTPS), acesso por link de uso único, controle de acesso por campeonato (cada organizador só vê os próprios dados) e contatos dos capitães separados da página pública.</p>

      <h2>9. Crianças e adolescentes</h2>
      <p>Campeonatos com atletas menores de idade devem ter a autorização dos pais ou responsáveis, obtida pelo organizador e pelo capitão do time.</p>

      <h2>10. Mudanças</h2>
      <p>Esta política pode ser atualizada. A data da última atualização aparece no topo. Veja também os <Link href="/termos">Termos de Uso</Link>.</p>
    </LegalPage>
  );
}
