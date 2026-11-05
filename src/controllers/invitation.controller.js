import * as invitationService from '../services/invitation.service.js';
import { successResponse } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createInvitation = asyncHandler(async (req, res) => {
  const invitation = await invitationService.createInvitation(req.user.orgId, req.user.id, req.body.role);
  res.status(201).json(successResponse(invitation, 'Invitation created. Share the link; it is shown only once.'));
});

export const listInvitations = asyncHandler(async (req, res) => {
  const invitations = await invitationService.listPendingInvitations(req.user.orgId);
  res.status(200).json(successResponse(invitations, 'Pending invitations retrieved successfully'));
});

export const revokeInvitation = asyncHandler(async (req, res) => {
  await invitationService.revokeInvitation(req.user.orgId, req.params.id);
  res.status(200).json(successResponse(null, 'Invitation revoked'));
});

export const previewInvitation = asyncHandler(async (req, res) => {
  const preview = await invitationService.previewInvitation(req.body.token);
  res.status(200).json(successResponse(preview));
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const result = await invitationService.acceptInvitation(req.body);
  res.status(201).json(successResponse(result, 'Welcome! Your account has been created'));
});
