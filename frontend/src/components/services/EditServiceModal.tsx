import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { useUpdateService } from '../../hooks/queries';

interface ServiceData {
  id: string;
  name: string;
  description: string;
}

interface EditServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceData;
}

// Only mounted while the modal is open (Modal renders `null` otherwise), so
// this always initializes its local state fresh from the current service —
// no effect needed to keep it in sync, and a background refetch while the
// modal is closed can never clobber an in-progress edit.
function EditServiceForm({ service, onClose }: { service: ServiceData; onClose: () => void }) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description || '');
  const { mutateAsync: updateService, isPending } = useUpdateService();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    try {
      await updateService({ id: service.id, data: { name: trimmedName, description: description.trim() } });
      onClose();
    } catch {
      // Error handled by react-query global toast
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Service Name"
        required
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Payment Gateway"
      />

      <Textarea
        label="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Handles all Stripe webhook processing..."
      />

      <div className="flex justify-end gap-3 mt-6">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" isLoading={isPending} disabled={!name.trim()}>Save Changes</Button>
      </div>
    </form>
  );
}

export function EditServiceModal({ isOpen, onClose, service }: EditServiceModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Service"
      description="Update the details of this infrastructure component."
    >
      <EditServiceForm service={service} onClose={onClose} />
    </Modal>
  );
}
