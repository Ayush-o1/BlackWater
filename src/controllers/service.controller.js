import * as serviceService from '../services/service.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createService = asyncHandler(async (req, res) => {
  const service = await serviceService.createService(req.user.orgId, req.body);
  res.status(201).json(successResponse(service, 'Service created successfully'));
});

export const listServices = asyncHandler(async (req, res) => {
  const { data, pagination } = await serviceService.listServices(req.user.orgId, req.query);
  res.status(200).json(successResponse(data, 'Services retrieved successfully', pagination));
});

export const getServiceDetails = asyncHandler(async (req, res) => {
  const service = await serviceService.getServiceDetails(req.user.orgId, req.params.id);
  res.status(200).json(successResponse(service, 'Service details retrieved successfully'));
});

export const updateService = asyncHandler(async (req, res) => {
  const service = await serviceService.updateService(req.user.orgId, req.params.id, req.body);
  res.status(200).json(successResponse(service, 'Service updated successfully'));
});

export const deleteService = asyncHandler(async (req, res) => {
  await serviceService.deleteService(req.user.orgId, req.params.id);
  res.status(200).json(successResponse(null, 'Service deleted successfully'));
});
