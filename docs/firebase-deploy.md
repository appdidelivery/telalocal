# Deploy automático das regras do Firebase

O repositório publica automaticamente as regras do Firestore quando `firestore.rules` ou o workflow de deploy muda na branch `main`.

## Credencial

O GitHub Secret obrigatório é:

`FIREBASE_SERVICE_ACCOUNT_TELALOCAL`

Ele contém o JSON completo de uma Service Account do projeto Firebase `telalocal`.

Nunca versione o JSON no repositório, em variáveis públicas ou em arquivos de ambiente da Vercel.

## Fluxo atual

1. GitHub Actions recebe o secret criptografado.
2. A credencial é materializada apenas no runner temporário.
3. O Firebase Admin SDK usa Application Default Credentials.
4. `releaseFirestoreRulesetFromSource()` cria e publica o ruleset do Firestore.
5. O arquivo temporário é descartado ao término do runner.

Essa estratégia evita a verificação prévia de Service Usage feita pela Firebase CLI e mantém a Service Account com permissões menores.

## Arquivos envolvidos

- `firestore.rules`
- `.github/scripts/deploy-firestore-rules.mjs`
- `.github/workflows/firebase-rules.yml`

## Storage

`storage.rules` será adicionado ao mesmo pipeline após a confirmação do bucket do Firebase Storage.
