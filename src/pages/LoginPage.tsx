import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LogIn } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('antoine@agencenikita.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Veuillez remplir tous les champs'); return; }
    setError('');
    setLoading(true);
    try {
      const ok = await Promise.race([
        login(email, password),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 10000)),
      ]);
      setLoading(false);
      if (ok) navigate('/');
      else setError('Email ou mot de passe incorrect');
    } catch {
      setLoading(false);
      setError('Erreur de connexion au serveur');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-nikita-gray px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-nikita-pink rounded-2xl flex items-center justify-center font-bold text-2xl text-white mx-auto mb-4">N</div>
          <h1 className="text-2xl font-bold text-gray-800">NIKITA Convention</h1>
          <p className="text-sm text-gray-500 mt-1">Plateforme de gestion des conventions</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" required />
          <Input label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <Button type="submit" loading={loading} className="w-full" icon={<LogIn size={16} />}>Se connecter</Button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-4">NIKITA — Organisme de formation certifié Qualiopi</p>
      </div>
    </div>
  );
}
