export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export const successResponse = <T>(
  data: T,
  message?: string,
  pagination?: ApiResponse<T>['pagination']
): ApiResponse<T> => {
  return {
    success: true,
    data,
    ...(message && { message }),
    ...(pagination && { pagination }),
  };
};

export const errorResponse = (message: string): ApiResponse<null> => {
  return {
    success: false,
    message,
  };
};
