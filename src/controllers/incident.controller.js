import * as incidentService from '../services/incident.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createIncident = asyncHandler(async (req, res) => {
  const incident = await incidentService.createIncident(req.user.orgId, req.user.id, req.body);
  res.status(201).json(successResponse(incident, 'Incident created successfully'));
});

export const listIncidents = asyncHandler(async (req, res) => {
  const { data, pagination } = await incidentService.listIncidents(req.user.orgId, req.query);
  res.status(200).json(successResponse(data, 'Incidents retrieved successfully', pagination));
});

export const getIncidentDetails = asyncHandler(async (req, res) => {
  const incident = await incidentService.getIncidentDetails(req.user.orgId, req.params.id);
  res.status(200).json(successResponse(incident, 'Incident details retrieved successfully'));
});

export const assignIncident = asyncHandler(async (req, res) => {
  const incident = await incidentService.assignIncident(req.user.orgId, req.params.id, req.body);
  res.status(200).json(successResponse(incident, 'Incident assigned successfully'));
});

export const updateStatus = asyncHandler(async (req, res) => {
  const incident = await incidentService.updateStatus(req.user.orgId, req.params.id, req.body);
  res.status(200).json(successResponse(incident, 'Incident status updated successfully'));
});

export const addUpdate = asyncHandler(async (req, res) => {
  const update = await incidentService.addUpdate(req.user.orgId, req.params.id, req.user.id, req.body);
  res.status(201).json(successResponse(update, 'Incident update added successfully'));
});
