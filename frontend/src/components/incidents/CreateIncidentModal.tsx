import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { ServiceMultiSelect } from '../ui/ServiceMultiSelect';
import { useServices, useCreateIncident } from '../../hooks/queries';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateIncidentModal({ isOpen, onClose }: CreateIncidentModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('LOW');
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  const { data: servicesData, isLoading: loadingServices } = useServices();
  const { mutateAsync: createIncident, isPending } = useCreateIncident();

  const services = Array.isArray(servicesData) ? servicesData : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    try {
      await createIncident({
        title: trimmedTitle,
        description: description.trim(),
        severity,
        serviceIds,
      });
      // Reset form
      setTitle('');
      setDescription('');
      setSeverity('LOW');
      setServiceIds([]);
      onClose();
    } catch {
      // Error handled by global toast
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Incident"
      description="Declare a new incident. This will immediately notify responders."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Incident Title"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="API Latency Spike"
        />

        <Textarea
          label="Description"
          required
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Initial investigation details..."
        />

        <Select
          label="Severity"
          required
          value={severity}
          onChange={e => setSeverity(e.target.value)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </Select>

        <div className="relative">
          <ServiceMultiSelect
            label="Affected Services"
            options={services}
            selected={serviceIds}
            onChange={setServiceIds}
            isLoading={loadingServices}
            placeholder="Click to select affected services..."
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" isLoading={isPending}>Declare Incident</Button>
        </div>
      </form>
    </Modal>
  );
}
