import { Film, User } from 'lucide-react';
import { useState } from 'react';

interface MediaImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackKind?: 'media' | 'person';
  loading?: 'lazy' | 'eager';
}

export function MediaImage({
  src,
  alt,
  className = '',
  fallbackKind = 'media',
  loading = 'lazy',
}: MediaImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted via-card to-muted/80 text-muted-foreground p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        {fallbackKind === 'person' ? (
          <User className="h-8 w-8 opacity-50" aria-hidden="true" />
        ) : (
          <Film className="h-8 w-8 opacity-50" aria-hidden="true" />
        )}
        <span className="text-xs font-medium line-clamp-2 opacity-80">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
