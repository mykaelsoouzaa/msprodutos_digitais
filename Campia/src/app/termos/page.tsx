import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = { title: 'Termos de Uso', description: 'Regras de uso da Campia, plataforma de campeonatos amadores.' };

export default function Termos() {
  return (
    <LegalPage title="Termos de Uso">
      <h2>1. O que é a Campia</h2>
      <p>A Campia ({COMPANY.site}) é uma plataforma online da {COMPANY.name} para organizar campeonatos esportivos amadores. Ela gera tabelas e agendas, publica a página do campeonato, recebe inscrições de times com pagamento por PIX e mostra resultados, classificação e estatísticas.</p>
      <p>Ao usar a Campia, como organizador, capitão de time, ajudante ou visitante, você concorda com estes Termos e com a <Link href="/privacidade">Política de Privacidade</Link>.</p>

      <h2>2. Quem é quem</h2>
      <ul>
        <li><b>Organizador:</b> pessoa, arena ou empresa que cria o campeonato. É o responsável pelo evento: regulamento, local, datas, arbitragem, premiação, segurança e pela relação com os times.</li>
        <li><b>Capitão:</b> quem inscreve o time e paga a inscrição. Garante que os atletas cadastrados concordam em participar e em ter nome e estatísticas exibidos.</li>
        <li><b>Ajudante:</b> pessoa convidada pelo organizador para lançar resultados.</li>
        <li><b>Campia:</b> fornece a plataforma. A Campia não organiza, não arbitra e não é responsável pela realização dos campeonatos.</li>
      </ul>

      <h2>3. Conta e acesso</h2>
      <p>O acesso ao painel é feito por um link enviado ao seu e-mail, sem senha. Você é responsável por manter o acesso ao seu e-mail seguro e por tudo o que for feito com a sua conta.</p>

      <h2>4. Inscrições e pagamentos</h2>
      <ul>
        <li>Os pagamentos são processados pelo <b>Asaas</b>, instituição de pagamento parceira. Para gerar o PIX, o CPF ou CNPJ do responsável é enviado ao Asaas.</li>
        <li>A vaga fica reservada por 30 minutos enquanto o PIX não é pago. Depois disso, ela pode ser ocupada por outro time.</li>
        <li>Quando o organizador conecta a própria conta Asaas, o valor de cada inscrição é dividido automaticamente: a parte do organizador vai direto para a conta dele e a taxa de serviço fica com a Campia. Sem a conta conectada, a Campia recebe o valor e repassa ao organizador, descontada a taxa de serviço.</li>
        <li>O valor da inscrição é definido pelo organizador. A taxa de serviço da Campia é combinada com o organizador.</li>
        <li><b>Plano Pro:</b> assinatura mensal opcional para organizadores, cobrada pelo Asaas, com taxa de serviço menor e recursos extras. Pode ser cancelada a qualquer momento pelo painel; os recursos continuam até o fim do período já pago e não há devolução proporcional do mês em curso. Se a mensalidade não for paga, o organizador volta ao plano grátis, sem perder campeonatos nem dados.</li>
      </ul>

      <h2>5. Cancelamentos e devoluções</h2>
      <p>A política de cancelamento e devolução de cada campeonato é definida pelo organizador, que deve informá-la aos times. Pela plataforma, o organizador pode cancelar uma inscrição e devolver o PIX. Se o campeonato for cancelado pelo organizador, cabe a ele devolver os valores pagos. Pagamentos que chegarem depois que a vaga expirou são devolvidos ou encaixados pelo organizador.</p>
      <p>Esta cláusula não limita os direitos garantidos pelo Código de Defesa do Consumidor.</p>

      <h2>6. Conteúdo publicado</h2>
      <p>Nomes de campeonatos, times, atletas, logos e textos são de responsabilidade de quem os publica. Não é permitido publicar conteúdo ofensivo, discriminatório, ilegal, que viole direitos de terceiros ou que se passe por outra pessoa ou marca. A Campia pode remover conteúdo e suspender contas que descumpram estes Termos.</p>

      <h2>7. Uso proibido</h2>
      <ul>
        <li>Usar a Campia para fraudes, cobranças indevidas ou eventos que não existem.</li>
        <li>Tentar acessar dados de outros usuários, burlar a segurança ou sobrecarregar a plataforma.</li>
        <li>Coletar dados de atletas e capitães para fins diferentes da organização do campeonato.</li>
      </ul>

      <h2>8. Disponibilidade e responsabilidade</h2>
      <p>A Campia busca funcionar sem interrupções, mas pode ter falhas, manutenções ou indisponibilidade de serviços parceiros (hospedagem, pagamentos, e-mail). A Campia não responde por lesões, acidentes, resultados esportivos, decisões de arbitragem ou pela realização do evento, que são responsabilidade do organizador.</p>

      <h2>9. Mudanças nestes Termos</h2>
      <p>Estes Termos podem ser atualizados. A data da última atualização aparece no topo da página, e mudanças importantes são avisadas na plataforma.</p>

      <h2>10. Contato e foro</h2>
      <p>Dúvidas e solicitações: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Fica eleito o foro do domicílio do consumidor para resolver questões relacionadas a estes Termos, conforme a lei brasileira.</p>
    </LegalPage>
  );
}
