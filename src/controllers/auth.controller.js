import * as authService from '../services/auth.service.js';
import * as organizationService from '../services/organization.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(successResponse(result, 'User registered successfully'));
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.status(200).json(successResponse(result, 'Login successful'));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  // requireAuth has already loaded this user from the database for this request. The
  // organization's name is added here (not on every request) because every page shows
  // it and already calls this endpoint, so it costs no extra round trip.
  const { id, name } = await organizationService.getOrganization(req.user.orgId);
  res.status(200).json(successResponse({ ...req.user, organization: { id, name } }, 'Current user retrieved successfully'));
});
