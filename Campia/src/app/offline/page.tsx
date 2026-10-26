export const metadata = { title: 'Sem internet' };

export default function Offline() {
  return (
    <div className="card" style={{ textAlign: 'center', marginTop: 24 }}>
      <div style={{ fontSize: 48 }}>📡</div>
      <h1>Sem internet</h1>
      <p className="sub">As páginas que você já abriu continuam disponíveis. Os placares atualizam quando a conexão voltar.</p>
    </div>
  );
}
