# TelaLocal — Análise de Impacto Firebase (MVP)

## Objetivo
Evitar que cada Web Player mantenha listeners do Firestore durante todo o expediente e impedir crescimento desnecessário de leituras/escritas.

## Decisão para o MVP

### 1. Firestore = fonte de verdade administrativa
Usado para tenants, usuários, pontos, telas, anunciantes, campanhas, playlists e resumos de Proof of Play.

### 2. Player não consulta Firestore continuamente
Ao publicar uma playlist, o sistema gera um manifesto JSON denormalizado e versionado para a tela.

Exemplo:
`manifests/{screenPublicId}/current.json`

O player consulta o manifesto por HTTP, usa cache/ETag e só baixa uma mídia quando sua versão/URL mudou.

### 3. Vídeos em Storage
MP4s são versionados. O player mantém os arquivos no Cache API/IndexedDB para evitar downloads repetidos.

### 4. Proof of Play
Cada reprodução concluída é registrada localmente no IndexedDB.

Não enviar uma escrita Firestore por reprodução.

A sincronização será agregada por tela e janela de tempo, inicialmente 1 resumo por hora:
- screenId
- tenantId
- período
- contagem por mediaId/campaignId
- firstPlayedAt
- lastPlayedAt
- playerVersion
- connectivity metadata

O heartbeat da tela deve ser incorporado nesse mesmo envio sempre que possível.

## Impacto estimado

Com 12 horas de operação/dia e 1 sincronização por hora:

- 1 tela: ~12 escritas/dia
- 100 telas: ~1.200 escritas/dia
- 1.000 telas: ~12.000 escritas/dia

Isso mantém o MVP muito abaixo de uma estratégia de uma escrita por reprodução.

## Regra de publicação
Alterar uma playlist no painel não altera imediatamente o cache local. A publicação gera uma nova versão do manifesto. O player detecta a versão nova, faz prefetch das mídias novas e só então troca a grade ativa.

## Próximos passos
1. Firebase Auth
2. Modelo multi-tenant
3. Firestore Rules
4. Cadastro real
5. Publicação de manifestos
6. Storage de MP4
7. Web Player offline-first
8. Proof of Play agregado
