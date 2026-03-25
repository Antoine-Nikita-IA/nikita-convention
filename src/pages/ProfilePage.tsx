import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { dataService } from '@/lib/services';
import { ROLE_LABELS } from '@/types/database';
import { Save, Lock, User } from 'lucide-react';

export function ProfilePage() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Prénom et nom sont requis');
      return;
    }
    setSaving(true);
    try {
      const updated = await dataService.updateOwnProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      if (updated) {
        toast.success('Profil mis à jour');
      } else {
        toast.error('Erreur lors de la mise à jour');
      }
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setChangingPassword(true);
    try {
      const success = await dataService.changePassword(newPassword);
      if (success) {
        toast.success('Mot de passe modifié');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error('Erreur lors du changement de mot de passe');
      }
    } catch {
      toast.error('Erreur lors du changement');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mon profil</h1>

      {/* Info card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-nikita-pink/20 flex items-center justify-center text-nikita-pink font-bold text-lg">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{user?.first_name} {user?.last_name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email} — {user?.role ? ROLE_LABELS[user.role] : ''}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Edit profile */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><User size={16} /> Informations personnelles</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" />
              <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" />
            </div>
            <Input label="Email" value={user?.email || ''} disabled className="opacity-60" />
            <Input label="Rôle" value={user?.role ? ROLE_LABELS[user.role] : ''} disabled className="opacity-60" />
            <div className="flex justify-end">
              <Button type="submit" icon={<Save size={16} />} loading={saving}>Enregistrer</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Lock size={16} /> Changer le mot de passe</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input label="Mot de passe actuel" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
            <Input label="Nouveau mot de passe" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 caractères" />
            <Input label="Confirmer le mot de passe" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmer" />
            <div className="flex justify-end">
              <Button type="submit" variant="outline" icon={<Lock size={16} />} loading={changingPassword} disabled={!newPassword || !confirmPassword}>Changer le mot de passe</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
