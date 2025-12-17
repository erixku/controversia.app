import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  pathOrUrl: string;
  expiresInSeconds?: number;
}

const looksLikeHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const AvatarImage: React.FC<AvatarImageProps> = ({
  pathOrUrl,
  expiresInSeconds = 60 * 60 * 24,
  ...imgProps
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const key = useMemo(() => pathOrUrl?.trim() ?? '', [pathOrUrl]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!key) {
        setResolvedUrl(null);
        return;
      }

      if (looksLikeHttpUrl(key)) {
        setResolvedUrl(key);
        return;
      }

      const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(key, expiresInSeconds);

      if (cancelled) return;

      if (error) {
        console.warn('Erro ao resolver avatar (signed url):', error.message);
        setResolvedUrl(null);
        return;
      }

      setResolvedUrl(data?.signedUrl ?? null);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [key, expiresInSeconds]);

  if (!resolvedUrl) return null;

  return <img {...imgProps} src={resolvedUrl} />;
};

export default AvatarImage;
