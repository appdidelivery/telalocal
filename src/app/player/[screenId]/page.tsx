import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Web Player",
  robots: { index: false, follow: false },
};

export default async function ScreenPlayer({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = await params;

  return (
    <main className="tv">
      <div className="tv-ad">
        <div>
          <div className="eyebrow">TELALOCAL • TELA CONFIGURADA</div>
          <h1>Player pronto.</h1>
          <p>Aguardando a primeira playlist publicada.</p>
          <small className="player-id">ID da tela: {screenId}</small>
        </div>
      </div>
    </main>
  );
}
