import * as organizationService from '../services/organization.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.getOrganization(req.user.orgId);
  res.status(200).json(successResponse(organization, 'Organization details retrieved successfully'));
});

export const updateOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.updateOrganization(req.user.orgId, req.body);
  res.status(200).json(successResponse(organization, 'Organization updated successfully'));
});
