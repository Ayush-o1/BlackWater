import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IncidentAPI } from '../api/incident.api';
import { ServiceAPI } from '../api/service.api';

// Incidents
export function useIncidents(params?: any) {
  return useQuery({
    queryKey: ['incidents', params],
    queryFn: () => IncidentAPI.list(params),
  });
}

export function useIncidentDetails(id: string) {
  return useQuery({
    queryKey: ['incidentDetails', id],
    queryFn: () => IncidentAPI.getDetails(id),
    enabled: !!id,
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: IncidentAPI.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => IncidentAPI.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incidentDetails', variables.id] });
    },
  });
}

export function useAssignIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) => IncidentAPI.assign(id, assigneeId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incidentDetails', variables.id] });
    },
  });
}

export function useAddIncidentUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => IncidentAPI.addUpdate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidentDetails', variables.id] });
    },
  });
}

// Services
export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: ServiceAPI.list,
  });
}

export function useServiceDetails(id: string) {
  return useQuery({
    queryKey: ['serviceDetails', id],
    queryFn: () => ServiceAPI.getDetails(id),
    enabled: !!id,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ServiceAPI.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ServiceAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
}

// Public Status
import { StatusAPI } from '../api/status.api';

export function useStatusOverview(orgId: string) {
  return useQuery({
    queryKey: ['statusOverview', orgId],
    queryFn: () => StatusAPI.getOverview(orgId),
    enabled: !!orgId,
  });
}

export function usePublicIncidentDetails(orgId: string, id: string) {
  return useQuery({
    queryKey: ['publicIncidentDetails', orgId, id],
    queryFn: () => StatusAPI.getIncidentDetails(orgId, id),
    enabled: !!orgId && !!id,
  });
}
