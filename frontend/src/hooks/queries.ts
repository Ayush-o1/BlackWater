import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IncidentAPI } from '../api/incident.api';
import { ServiceAPI } from '../api/service.api';
import toast from 'react-hot-toast';

const handleMutationError = (error: any) => {
  const message = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'An error occurred';
  toast.error(message);
};

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Incident declared successfully');
    },
    onError: handleMutationError,
  });
}

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => IncidentAPI.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incidentDetails', variables.id] });
      toast.success('Incident status updated');
    },
    onError: handleMutationError,
  });
}

export function useAssignIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) => IncidentAPI.assign(id, assigneeId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incidentDetails', variables.id] });
      toast.success('Incident reassigned');
    },
    onError: handleMutationError,
  });
}

export function useAddIncidentUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => IncidentAPI.addUpdate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incidentDetails', variables.id] });
      toast.success('Update added successfully');
    },
    onError: handleMutationError,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service created successfully');
    },
    onError: handleMutationError,
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => ServiceAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['serviceDetails', variables.id] });
      toast.success('Service updated successfully');
    },
    onError: handleMutationError,
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ServiceAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service deleted successfully');
    },
    onError: handleMutationError,
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

// Users
import { UserAPI } from '../api/user.api';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: UserAPI.list,
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: UserAPI.getMe,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: UserAPI.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Profile updated successfully');
    },
    onError: handleMutationError,
  });
}

// Organizations
import { OrganizationAPI } from '../api/organization.api';

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: OrganizationAPI.getMe,
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: OrganizationAPI.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Organization updated successfully');
    },
    onError: handleMutationError,
  });
}
