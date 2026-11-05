export const successResponse = (data, message, pagination) => ({
  success: true,
  data,
  ...(message && { message }),
  ...(pagination && { pagination }),
});
