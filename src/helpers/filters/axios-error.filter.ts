import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AxiosError } from 'axios';

@Catch(AxiosError)
export class AxiosExceptionFilter implements ExceptionFilter {
  catch(exception: AxiosError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.response?.status || 500;
    const message = exception.message;

    response.status(status).json({
      statusCode: status,
      code: 'AXIOS_ERROR',
      message,
      error: exception.response?.data || null,
      stack: exception.stack,
    });
  }
}
