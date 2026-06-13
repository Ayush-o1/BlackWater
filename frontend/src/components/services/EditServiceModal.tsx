import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { useUpdateService } from '../../hooks/queries';

interface EditServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: {
    id: string;
    name: string;
    description: string;
  };
}

export function EditServiceModal({ isOpen, onClose, service }: EditServiceModalProps) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description || '');
  
  // Update local state if service prop changes
  useEffect(() => {
    setName(service.name);
    setDescription(service.description || '');
  }, [service]);

  const { mutateAsync: updateService, isPending } = useUpdateService();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateService({ id: service.id, data: { name, description } });
      onClose();
    } catch (err) {
      // Error handled by react-query global toast
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Service"
      description="Update the details of this infrastructure component."
    >
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
          <Button type="submit" isLoading={isPending}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}
