import * as userService from '../services/user.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listUsers = asyncHandler(async (req, res) => {
  const { data, pagination } = await userService.listUsers(req.user.orgId, req.query);
  res.status(200).json(successResponse(data, 'Users retrieved successfully', pagination));
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.user.id, req.user.orgId);
  res.status(200).json(successResponse(user, 'Current user retrieved successfully'));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.user.orgId, req.body);
  res.status(200).json(successResponse(user, 'Profile updated successfully'));
});
