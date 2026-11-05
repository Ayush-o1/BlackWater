import * as statusService from '../services/status.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getOverview = asyncHandler(async (req, res) => {
  const overview = await statusService.getOverview(req.query.orgId);
  res.status(200).json(successResponse(overview));
});

export const getServices = asyncHandler(async (req, res) => {
  const services = await statusService.getServices(req.query.orgId);
  res.status(200).json(successResponse(services));
});

export const getIncidents = asyncHandler(async (req, res) => {
  const { data, pagination } = await statusService.getIncidents(req.query.orgId, req.query);
  res.status(200).json(successResponse(data, undefined, pagination));
});

export const getIncidentDetails = asyncHandler(async (req, res) => {
  const incident = await statusService.getIncidentDetails(req.query.orgId, req.params.id);
  res.status(200).json(successResponse(incident));
});
