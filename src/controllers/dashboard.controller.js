import * as dashboardService from '../services/dashboard.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getDashboard(req.user.orgId);
  res.status(200).json(successResponse(dashboard));
});
