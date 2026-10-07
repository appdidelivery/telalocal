import Link from "next/link";

const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TelaLocal",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Plataforma de mídia indoor e DOOH local para conectar Smart TVs de estabelecimentos e anunciantes locais com mensuração de exibições e conversões.",
  offers: [
    {
      "@type": "Offer",
      name: "Ponto Parceiro",
      price: "0",
      priceCurrency: "BRL",
      description:
        "Participação sem mensalidade e remuneração variável sobre a mídia comercializada na tela.",
    },
    {
      "@type": "Offer",
      name: "Presença Local",
      price: "295",
      priceCurrency: "BRL",
      description: "Pacote inicial para anunciante em até 5 telas com mídia de 15 segundos.",
    },
  ],
};

const advertiserPlans = [
  {
    name: "Presença Local",
    price: "R$ 295",
    note: "/ mês",
    highlight: "5 telas",
    items: [
      "Spot de até 15 segundos",
      "1 campanha ativa",
      "QR + WhatsApp rastreável",
      "Proof of Play e relatório",
    ],
  },
  {
    name: "Bairro",
    price: "R$ 490",
    note: "/ mês",
    highlight: "até 10 telas",
    featured: true,
    items: [
      "Spots de 15s ou 30s",
      "Até 3 campanhas",
      "Agendamento por horário",
      "Segmentação por região/categoria",
      "QR, WhatsApp e cupom",
    ],
  },
  {
    name: "Rede Local",
    price: "R$ 890",
    note: "/ mês",
    highlight: "até 20 telas",
    items: [
      "Até 5 campanhas",
      "Distribuição em múltiplos pontos",
      "Relatórios por tela/campanha",
      "Prioridade de programação",
    ],
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <header className="wrap nav">
        <div className="brand">
          Tela<span>Local</span>
        </div>
        <nav className="navlinks">
          <a href="#como-funciona">Como funciona</a>
          <a href="#ganha-ganha">Modelo</a>
          <a href="#planos">Planos</a>
          <Link className="btn ghost" href="/login">
            Acessar painel
          </Link>
        </nav>
      </header>

      <main>
        <section className="wrap hero">
          <div>
            <div className="eyebrow">Mídia indoor • DOOH local mensurável</div>
            <h1>Sua TV gera audiência. O comércio local transforma isso em resultado.</h1>
            <p>
              O TelaLocal conecta estabelecimentos com Smart TVs e empresas da região.
              O ponto parceiro monetiza a tela, o anunciante alcança pessoas perto do negócio
              e cada exibição pode ser auditada com QR, WhatsApp, cupom e Proof of Play.
            </p>
            <div className="cta">
              <Link className="btn primary" href="/cadastro?perfil=lojista">
                Quero ganhar com minha TV
              </Link>
              <Link className="btn ghost" href="/cadastro?perfil=anunciante">
                Quero anunciar no meu bairro
              </Link>
            </div>
            <div className="hero-trust">
              <span>Sem hardware obrigatório</span>
              <span>URL direto na Smart TV</span>
              <span>Cache offline</span>
            </div>
          </div>

          <div className="landing-tv-shell">
            <div className="landing-tv-bezel">
              <iframe
                src="/player/demo"
                title="Demonstração do TelaLocal rodando em uma TV"
                loading="eager"
              />
            </div>
            <div className="landing-tv-stand" />
            <small>Demonstração ao vivo do player • conteúdo rotativo + QR</small>
          </div>
        </section>

        <section id="como-funciona" className="wrap section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">DO ZERO À TV</div>
              <h2>Funciona com o navegador que já existe na Smart TV.</h2>
            </div>
            <p className="lead">
              Sem pendrive e sem alguém trocando arquivos manualmente. O painel publica,
              a TV sincroniza e continua rodando mesmo se a internet oscilar.
            </p>
          </div>

          <div className="flow-grid">
            {[
              ["01", "Abra /tv", "Na Smart TV, abra telalocal.vercel.app/tv e receba um código de pareamento."],
              ["02", "Vincule a tela", "No celular, escolha o estabelecimento e informe o código de 6 dígitos."],
              ["03", "Publique campanhas", "Vídeos e slides entram na playlist com horário e segmentação."],
              ["04", "Meça o resultado", "Exibições, QR, WhatsApp e cupons ficam associados à campanha e à tela."],
            ].map(([n, t, p]) => (
              <article className="flow-card" key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{p}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="ganha-ganha" className="wrap section">
          <div className="winwin-head">
            <div>
              <div className="eyebrow">MODELO GANHA-GANHA</div>
              <h2>A mesma tela cria valor para quem recebe e para quem anuncia.</h2>
            </div>
            <p>
              O TelaLocal comercializa a mídia, mede a entrega e divide a receita com o ponto
              que disponibiliza a audiência. O anunciante compra presença local com rastreamento,
              em vez de pagar por uma TV sem saber o que aconteceu depois.
            </p>
          </div>

          <div className="winwin-grid">
            <article className="win-card host">
              <span className="win-icon">TV</span>
              <div className="eyebrow">PONTO PARCEIRO</div>
              <h3>R$ 0 de mensalidade</h3>
              <p>
                Usa a própria TV para conteúdo do estabelecimento e recebe
                <strong> 30% da receita líquida de mídia atribuída àquela tela</strong>.
              </p>
              <div className="money-example">
                <small>Exemplo ilustrativo</small>
                <strong>R$ 590 em mídia vendida na tela</strong>
                <span>→ R$ 177 para o ponto parceiro</span>
              </div>
              <Link className="btn primary full" href="/cadastro?perfil=lojista">
                Cadastrar minha TV
              </Link>
            </article>

            <article className="win-card advertiser">
              <span className="win-icon">QR</span>
              <div className="eyebrow">ANUNCIANTE LOCAL</div>
              <h3>A partir de R$ 295/mês</h3>
              <p>
                A campanha aparece em estabelecimentos próximos do público desejado e pode
                levar direto para WhatsApp, cupom ou oferta por QR Code.
              </p>
              <div className="money-example">
                <small>Você acompanha</small>
                <strong>Exibições → QR → WhatsApp → cupom</strong>
                <span>por campanha e por tela</span>
              </div>
              <Link className="btn ghost full" href="/cadastro?perfil=anunciante">
                Quero anunciar
              </Link>
            </article>
          </div>

          <p className="pricing-disclaimer">
            A participação de 30% é o modelo comercial do piloto e incide sobre a receita
            líquida de mídia efetivamente comercializada na tela; não representa renda mínima
            ou garantia de faturamento.
          </p>
        </section>

        <section id="planos" className="wrap section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">PLANOS DE LANÇAMENTO</div>
              <h2>Preço simples para empresas locais.</h2>
            </div>
            <p className="lead">
              Comece pequeno e aumente a cobertura conforme a campanha provar resultado.
              Durante o piloto, a ativação é feita após validação da disponibilidade das telas.
            </p>
          </div>

          <div className="pricing-grid">
            {advertiserPlans.map((plan) => (
              <article
                className={plan.featured ? "price-card featured" : "price-card"}
                key={plan.name}
              >
                {plan.featured ? <span className="price-badge">MAIS INDICADO</span> : null}
                <div className="eyebrow">{plan.highlight}</div>
                <h3>{plan.name}</h3>
                <div className="price-value">
                  <strong>{plan.price}</strong>
                  <span>{plan.note}</span>
                </div>
                <ul>
                  {plan.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link className={plan.featured ? "btn primary full" : "btn ghost full"} href="/cadastro?perfil=anunciante">
                  Começar como anunciante
                </Link>
              </article>
            ))}
          </div>

          <div className="host-plan-strip">
            <div>
              <div className="eyebrow">PARA QUEM TEM A TV</div>
              <h3>Ponto Parceiro • R$ 0/mês</h3>
              <p>
                Cadastre a tela, use seu próprio conteúdo e participe da receita de anúncios
                externos vendidos para aquele ponto.
              </p>
            </div>
            <Link className="btn primary" href="/cadastro?perfil=lojista">
              Quero ser ponto parceiro
            </Link>
          </div>
        </section>

        <section id="para-quem" className="wrap section">
          <h2>Exemplos reais de uso.</h2>
          <p className="lead">
            O mesmo player atende diferentes negócios sem mudar o equipamento.
          </p>
          <div className="usecase-grid">
            {[
              ["Barbearia", "Primeiro corte com 50% OFF", "QR abre o WhatsApp e identifica em qual TV o cliente viu a oferta."],
              ["Hamburgueria", "Combo + cashback", "A tela alterna oferta, clube fidelidade e pedido por QR durante o atendimento."],
              ["Mercado", "Oferta por faixa de horário", "Produtos podem aparecer apenas nos horários e pontos definidos no painel."],
            ].map(([niche, title, text]) => (
              <article className="usecase-card" key={niche}>
                <div className="usecase-screen">
                  <span>{niche}</span>
                  <strong>{title}</strong>
                  <i>QR</i>
                </div>
                <h3>{niche}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="wrap section">
          <div className="banner">
            <div>
              <h2>Uma rede local só funciona quando os dois lados ganham.</h2>
              <p>
                Mais audiência útil para os anunciantes, mais receita para os pontos parceiros
                e métricas para saber o que realmente foi exibido.
              </p>
            </div>
            <Link className="btn primary" href="/cadastro">
              Participar do piloto
            </Link>
          </div>
        </section>
      </main>

      <footer className="wrap footer">
        © 2026 TelaLocal. Mídia indoor local com Proof of Play e conversão rastreável.
      </footer>
    </>
  );
}
