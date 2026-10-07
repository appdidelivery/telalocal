# Análise de Impacto — Firestore / Web Player

## Decisão
O listener `onSnapshot()` do manifesto foi mantido no MVP.

Para um único documento por tela, com poucas alterações de playlist, trocar o listener por polling periódico poderia aumentar o número de leituras. O custo do listener fica concentrado no carregamento inicial, nas alterações efetivas do documento e em reconexões.

## Otimizações aplicadas
- Heartbeat do player: de 5 para 10 minutos.
- Janela operacional de online: 25 minutos.
- O painel deixou de ler toda a coleção de heartbeats e agora consulta apenas registros recentes por `lastSeenAtMs`.
- A tela de gerenciamento usa a mesma consulta limitada de heartbeats recentes.
- Proof of Play permanece agregado localmente e sincronizado em lote, evitando uma escrita por exibição.

## Impacto estimado
Antes, cada TV gerava até 288 writes de heartbeat/dia se permanecesse ligada 24h.
Com intervalo de 10 minutos, o teto passa a 144 writes/dia por TV.

O ganho na leitura do painel depende do tamanho da rede: heartbeats antigos deixam de ser lidos a cada abertura do dashboard.

## Próximo passo recomendado
Na próxima evolução de escala, publicar o manifesto também como JSON estático versionado em CDN/Storage e manter o Firestore apenas como controle administrativo. Isso reduz ainda mais a dependência do player em leituras do banco sem introduzir polling agressivo.
