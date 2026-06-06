import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { useCreateService } from '../../hooks/queries';

interface CreateServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateServiceModal({ isOpen, onClose }: CreateServiceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const { mutateAsync: createService, isPending } = useCreateService();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createService({ name, description });
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register Service"
      description="Add a new infrastructure component or microservice to track."
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
          <Button type="submit" isLoading={isPending}>Create Service</Button>
        </div>
      </form>
    </Modal>
  );
}
