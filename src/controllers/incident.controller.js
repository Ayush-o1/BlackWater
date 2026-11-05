import * as incidentService from '../services/incident.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// req.user.id is passed to every write as the actor. It comes from the verified
// token, never from the request body, so nobody can act "as" someone else.

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

export const editIncident = asyncHandler(async (req, res) => {
  const incident = await incidentService.editIncident(req.user.orgId, req.params.id, req.user.id, req.body);
  res.status(200).json(successResponse(incident, 'Incident updated successfully'));
});

export const assignIncident = asyncHandler(async (req, res) => {
  const incident = await incidentService.assignIncident(req.user.orgId, req.params.id, req.user.id, req.body.assigneeId);
  res.status(200).json(successResponse(incident, 'Incident assignment updated successfully'));
});

export const updateStatus = asyncHandler(async (req, res) => {
  const incident = await incidentService.updateStatus(req.user.orgId, req.params.id, req.user.id, req.body.status);
  res.status(200).json(successResponse(incident, 'Incident status updated successfully'));
});

export const addUpdate = asyncHandler(async (req, res) => {
  const update = await incidentService.addUpdate(req.user.orgId, req.params.id, req.user.id, req.body);
  res.status(201).json(successResponse(update, 'Incident update added successfully'));
});

export const setVisibility = asyncHandler(async (req, res) => {
  const incident = await incidentService.setVisibility(req.user.orgId, req.params.id, req.user.id, req.body.isPublic);
  res.status(200).json(successResponse(incident, 'Incident visibility updated successfully'));
});
