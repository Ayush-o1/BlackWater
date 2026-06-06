import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { useServices, useCreateIncident } from '../../hooks/queries';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateIncidentModal({ isOpen, onClose }: CreateIncidentModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('MINOR');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  
  const { data: servicesData, isLoading: loadingServices } = useServices();
  const { mutateAsync: createIncident, isPending } = useCreateIncident();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createIncident({
        title,
        description,
        severity,
        serviceIds,
      });
      // Reset form
      setTitle('');
      setDescription('');
      setSeverity('MINOR');
      setServiceIds([]);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions);
    setServiceIds(options.map(o => o.value));
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
        
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Severity"
            required
            value={severity}
            onChange={e => setSeverity(e.target.value)}
          >
            <option value="MINOR">Minor</option>
            <option value="MAJOR">Major</option>
            <option value="CRITICAL">Critical</option>
          </Select>
          
          <Select
            label="Affected Services"
            multiple
            required
            value={serviceIds}
            onChange={handleServiceChange}
            className="h-24"
          >
            {loadingServices ? (
              <option disabled>Loading...</option>
            ) : (
              servicesData?.services?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))
            )}
          </Select>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" isLoading={isPending}>Declare Incident</Button>
        </div>
      </form>
    </Modal>
  );
}
