import { ProfileSettings } from '../components/settings/ProfileSettings';
import { OrganizationSettings } from '../components/settings/OrganizationSettings';
import { TeamSettings } from '../components/settings/TeamSettings';

export function Settings() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your account settings and organization preferences.</p>
      </div>

      <div className="space-y-8">
        <ProfileSettings />
        <OrganizationSettings />
        <TeamSettings />
      </div>
    </div>
  );
}
