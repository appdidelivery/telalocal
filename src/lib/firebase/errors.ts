export function firebaseErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já possui uma conta.",
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/weak-password": "Use uma senha mais forte, com pelo menos 8 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
    "permission-denied": "O Firestore ainda não autorizou esta operação. Verifique as regras publicadas.",
    "firestore/permission-denied": "O Firestore ainda não autorizou esta operação. Verifique as regras publicadas.",
  };

  return messages[code] ?? "Não foi possível concluir a operação. Tente novamente.";
}
