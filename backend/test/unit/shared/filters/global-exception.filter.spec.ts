import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter, ErrorResponse } from '../../../../src/shared/filters/global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: {
    url: string;
    method: string;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/v1/test',
      method: 'GET',
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;
  });

  describe('when exception is an HttpException', () => {
    it('should return the correct status code and message for a 400 error', () => {
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonArg: ErrorResponse = mockResponse.json.mock.calls[0][0];
      expect(jsonArg.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(jsonArg.path).toBe('/v1/test');
      expect(jsonArg.timestamp).toBeDefined();
    });

    it('should return 404 for NotFoundException', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      const jsonArg: ErrorResponse = mockResponse.json.mock.calls[0][0];
      expect(jsonArg.statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it('should return validation error array when response contains message array', () => {
      const validationErrors = ['field must not be empty', 'email must be valid'];
      const exception = new HttpException(
        { message: validationErrors, error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const jsonArg: ErrorResponse = mockResponse.json.mock.calls[0][0];
      expect(jsonArg.message).toEqual(validationErrors);
      expect(jsonArg.error).toBe('Bad Request');
    });
  });

  describe('when exception is a generic Error', () => {
    it('should return 500 Internal Server Error', () => {
      const exception = new Error('Something unexpected went wrong');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const jsonArg: ErrorResponse = mockResponse.json.mock.calls[0][0];
      expect(jsonArg.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(jsonArg.message).toBe('Internal server error');
      expect(jsonArg.error).toBe('Internal Server Error');
    });
  });

  describe('response shape', () => {
    it('should always include statusCode, message, error, timestamp, and path', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      const jsonArg: ErrorResponse = mockResponse.json.mock.calls[0][0];
      expect(jsonArg).toHaveProperty('statusCode');
      expect(jsonArg).toHaveProperty('message');
      expect(jsonArg).toHaveProperty('error');
      expect(jsonArg).toHaveProperty('timestamp');
      expect(jsonArg).toHaveProperty('path');
    });

    it('should include the correct request path', () => {
      mockRequest.url = '/v1/members/123';
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      const jsonArg: ErrorResponse = mockResponse.json.mock.calls[0][0];
      expect(jsonArg.path).toBe('/v1/members/123');
    });
  });
});
