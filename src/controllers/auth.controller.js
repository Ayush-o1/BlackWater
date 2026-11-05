import * as authService from '../services/auth.service.js';
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
  // requireAuth has already loaded this user from the database for this request.
  res.status(200).json(successResponse(req.user, 'Current user retrieved successfully'));
});
