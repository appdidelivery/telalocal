# Deploy automático das regras do Firebase

O repositório publica automaticamente as regras do Firestore quando arquivos de configuração mudam na branch `main`.

## Configuração única

Crie no GitHub o secret:

`FIREBASE_SERVICE_ACCOUNT_TELALOCAL`

O valor deve ser o conteúdo completo do JSON de uma Service Account do projeto Firebase `telalocal`.

Não versione o JSON no repositório e não envie a chave em chats.

## Fluxo

Alteração em:
- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`
- `.firebaserc`

gera uma execução do workflow `Deploy Firebase Rules`.

O deploy executado é:

`firebase deploy --only firestore:rules,firestore:indexes --project telalocal --non-interactive`

## Storage

O deploy automático de `storage.rules` será habilitado depois que o bucket do Firebase Storage estiver definitivamente provisionado e validado.
