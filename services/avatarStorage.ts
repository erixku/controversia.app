import { supabase } from './supabase';

export interface UploadAvatarOptions {
  bucket?: string;
  authUserId: string;
  profileId?: string | null;
  blob: Blob;
  upsert?: boolean;
  cacheControl?: string;
  contentType?: string;
}

export interface UploadAvatarResult {
  path: string;
}

const inferUploadErrorMessage = (err: any) => {
  const message = String(err?.message || err?.error || err || '');
  const statusCode = err?.statusCode ?? err?.status ?? err?.code;
  return statusCode ? `${message} (code: ${statusCode})` : message;
};

export const uploadAvatarWithFallback = async (options: UploadAvatarOptions): Promise<UploadAvatarResult> => {
  const {
    bucket = 'avatars',
    authUserId,
    profileId,
    blob,
    upsert = false,
    cacheControl = '3600',
    contentType = 'image/webp'
  } = options;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    throw new Error('Você não está autenticado (sessão ausente). Refaça login e tente novamente.');
  }

  const timestamp = Date.now();
  const candidates: string[] = [];

  // Most common + recommended: folder matches auth.uid()
  candidates.push(`${authUserId}/${timestamp}.webp`);

  // Some projects instead key by profiles.id
  if (profileId && profileId !== authUserId) {
    candidates.push(`${profileId}/${timestamp}.webp`);
  }

  const errors: string[] = [];

  for (const path of candidates) {
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      upsert,
      cacheControl,
      contentType
    });

    if (!error) {
      return { path };
    }

    errors.push(`${path}: ${inferUploadErrorMessage(error)}`);
  }

  throw new Error(`Falha ao enviar avatar para o Storage (${bucket}). Detalhes: ${errors.join(' | ')}`);
};
