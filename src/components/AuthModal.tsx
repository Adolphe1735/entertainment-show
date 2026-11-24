import { Film, X } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (name: string, email: string) => void;
}

export function AuthModal({ open, onClose, onSignIn }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your display name.');
      return;
    }
    onSignIn(name.trim() || email.split('@')[0], email.trim());
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
            <Film className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
          </div>
          <h2 id="auth-modal-title" className="font-display text-xl font-bold text-foreground">
            {mode === 'signin' ? 'Sign in to CineVerse' : 'Create CineVerse profile'}
          </h2>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          Save your personalized watchlist, mark favorites, and publish film &amp; TV reviews.
        </p>

        <div className="mb-4 flex rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              mode === 'signin' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              mode === 'signup' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-foreground mb-1.5">
                Display Name
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-foreground mb-1.5">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {mode === 'signin' ? 'Continue' : 'Create Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
