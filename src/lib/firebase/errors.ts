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
    "storage/unauthorized": "O Storage não autorizou o envio. Verifique se as regras do Storage foram publicadas.",
    "storage/object-not-found": "O arquivo não foi encontrado no Storage.",
    "storage/quota-exceeded": "A cota do Firebase Storage foi atingida.",
    "storage/retry-limit-exceeded": "O upload demorou demais. Tente novamente.",
    "storage/invalid-format": "Use um arquivo MP4.",
    "storage/file-too-large": "O MP4 deve ter no máximo 60 MB neste MVP.",
  };

  return messages[code] ?? "Não foi possível concluir a operação. Tente novamente.";
}
