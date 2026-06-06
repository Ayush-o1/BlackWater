export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export const successResponse = <T>(data: T, message?: string): ApiResponse<T> => {
  return {
    success: true,
    data,
    ...(message && { message }),
  };
};

export const errorResponse = (message: string): ApiResponse<null> => {
  return {
    success: false,
    message,
  };
};
