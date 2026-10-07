"use client";

export type CloudinaryVideoUpload = {
  secureUrl: string;
  publicId: string;
  bytes: number;
  duration?: number;
  format?: string;
  resourceType?: string;
};

function codedError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export function uploadVideoToCloudinary(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void
): Promise<CloudinaryVideoUpload> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return Promise.reject(
      codedError(
        "cloudinary/not-configured",
        "Cloudinary não está configurado."
      )
    );
  }

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", uploadPreset);
    form.append("folder", folder);
    form.append("tags", "telalocal,campaign");

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      true
    );
    xhr.timeout = 120000;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(
        Math.max(
          1,
          Math.min(99, Math.round((event.loaded / event.total) * 100))
        )
      );
    };

    xhr.onload = () => {
      let payload: Record<string, unknown> = {};

      try {
        payload = JSON.parse(xhr.responseText || "{}") as Record<string, unknown>;
      } catch {}

      if (xhr.status < 200 || xhr.status >= 300) {
        const apiMessage =
          typeof payload.error === "object" &&
          payload.error &&
          "message" in payload.error
            ? String((payload.error as { message?: string }).message)
            : "Falha no upload para o Cloudinary.";

        reject(codedError("cloudinary/upload-failed", apiMessage));
        return;
      }

      const secureUrl = String(payload.secure_url ?? "");
      const publicId = String(payload.public_id ?? "");

      if (!secureUrl || !publicId) {
        reject(
          codedError(
            "cloudinary/invalid-response",
            "O Cloudinary não retornou a URL do vídeo."
          )
        );
        return;
      }

      onProgress?.(100);

      resolve({
        secureUrl,
        publicId,
        bytes: Number(payload.bytes ?? file.size),
        duration:
          typeof payload.duration === "number"
            ? payload.duration
            : undefined,
        format:
          typeof payload.format === "string" ? payload.format : undefined,
        resourceType:
          typeof payload.resource_type === "string"
            ? payload.resource_type
            : undefined,
      });
    };

    xhr.onerror = () =>
      reject(
        codedError(
          "cloudinary/network-error",
          "Falha de rede durante o upload."
        )
      );

    xhr.ontimeout = () =>
      reject(
        codedError(
          "cloudinary/timeout",
          "O upload demorou mais de 2 minutos."
        )
      );

    xhr.send(form);
  });
}
