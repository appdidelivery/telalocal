export const metadata = {
  title: "Player Demo",
  robots: { index: false, follow: false },
};

export default function PlayerDemo() {
  return (
    <main className="demo-player">
      <div className="demo-slide demo-slide-one">
        <div className="demo-badge">HAMBURGUERIA LOCAL</div>
        <strong>50% OFF</strong>
        <p>no primeiro pedido</p>
        <span>Escaneie o QR e peça agora</span>
      </div>

      <div className="demo-slide demo-slide-two">
        <div className="demo-badge">CASHBACK</div>
        <strong>10% de volta</strong>
        <p>para usar no próximo pedido</p>
        <span>Oferta rastreável por tela</span>
      </div>

      <div className="demo-slide demo-slide-three">
        <div className="demo-badge">CLUBE FIDELIDADE</div>
        <strong>Quem volta, ganha.</strong>
        <p>benefícios para clientes fiéis</p>
        <span>QR + WhatsApp + cupom</span>
      </div>

      <div className="demo-qr" aria-hidden="true">
        <div className="demo-qr-grid">
          {Array.from({ length: 64 }).map((_, index) => (
            <i key={index} className={(index * 7 + Math.floor(index / 8) * 3) % 5 < 2 ? "on" : ""} />
          ))}
        </div>
        <small>APONTE A CÂMERA</small>
      </div>

      <div className="demo-proof">● Proof of Play ativo</div>
    </main>
  );
}
