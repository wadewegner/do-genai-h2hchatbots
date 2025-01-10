const tokenService = require('../../services/tokenService');
const axios = require('axios');

jest.mock('axios');

describe('TokenService', () => {
    const mockEnv = {
        API_BASE: 'test-api-base',
        AGENT_ID: '2d358eb3-cecb-11ef-bf8f-4e013e2ddde4',
        AGENT_KEY: 'test-agent-key'
    };

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...mockEnv };
        tokenService.initialize();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should validate required environment variables', () => {
            const originalEnv = { ...process.env };
            delete process.env.AGENT_ID;
            
            expect(() => tokenService.validateConfig()).toThrow('AGENT_ID is required');
            
            process.env = originalEnv;
        });

        it('should validate AGENT_ID format', () => {
            const originalEnv = { ...process.env };
            process.env.AGENT_ID = 'invalid-format';
            
            expect(() => tokenService.validateConfig()).toThrow('AGENT_ID format is invalid');
            
            process.env = originalEnv;
        });
    });

    describe('getRefreshToken', () => {
        const expectedHeaders = {
            'Content-Type': 'application/json',
            'X-Api-Key': process.env.AGENT_KEY
        };

        it('should handle 400 errors with detailed logging', async () => {
            axios.post.mockRejectedValue({
                response: {
                    status: 400,
                    data: { error: 'Invalid credentials' }
                }
            });

            await expect(tokenService.getRefreshToken())
                .rejects.toThrow('Failed to get refresh token: Invalid credentials');
        });

        it('should handle network errors', async () => {
            axios.post.mockRejectedValue(new Error('Network Error'));
            
            await expect(tokenService.getRefreshToken())
                .rejects.toThrow('Failed to get refresh token: Network Error');
        });

        it('should return refresh token on success', async () => {
            const mockResponse = { data: { refresh_token: 'test-refresh-token' } };
            axios.post.mockResolvedValue(mockResponse);

            const result = await tokenService.getRefreshToken();
            expect(result).toBe('test-refresh-token');
            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                {},
                { headers: expectedHeaders }
            );
        });
    });

    describe('getAccessToken', () => {
        const expectedHeaders = {
            'Content-Type': 'application/json',
            'X-Api-Key': process.env.AGENT_KEY
        };

        it('should handle invalid refresh tokens', async () => {
            axios.put.mockRejectedValue({
                response: {
                    status: 401,
                    data: { error: 'Invalid refresh token' }
                }
            });

            await expect(tokenService.getAccessToken('invalid-token'))
                .rejects.toBe('Invalid refresh token');
        });

        it('should return access token on success', async () => {
            const mockResponse = { data: { access_token: 'test-access-token' } };
            axios.put.mockResolvedValue(mockResponse);

            const result = await tokenService.getAccessToken('valid-refresh-token');
            expect(result).toBe('test-access-token');
            expect(axios.put).toHaveBeenCalledWith(
                expect.stringContaining('?refresh_token=valid-refresh-token'),
                {},
                { headers: expectedHeaders }
            );
        });
    });

    describe('ensureValidToken', () => {
        it('should get new tokens when none exist', async () => {
            const mockRefreshToken = 'test-refresh-token';
            const mockAccessToken = 'test-access-token';

            axios.post.mockResolvedValueOnce({ data: { refresh_token: mockRefreshToken } });
            axios.put.mockResolvedValueOnce({ data: { access_token: mockAccessToken } });

            const result = await tokenService.ensureValidToken();
            expect(result).toBe(mockAccessToken);
            expect(tokenService.refreshToken).toBe(mockRefreshToken);
            expect(tokenService.accessToken).toBe(mockAccessToken);
            expect(tokenService.accessTokenExpiry).toBeGreaterThan(Date.now());
        });

        it('should reuse valid access token', async () => {
            const mockAccessToken = 'test-access-token';
            tokenService.accessToken = mockAccessToken;
            tokenService.accessTokenExpiry = Date.now() + 3600000; // 1 hour from now

            const result = await tokenService.ensureValidToken();
            expect(result).toBe(mockAccessToken);
            expect(axios.post).not.toHaveBeenCalled();
            expect(axios.put).not.toHaveBeenCalled();
        });

        it('should refresh expired access token', async () => {
            const mockRefreshToken = 'test-refresh-token';
            const mockAccessToken = 'test-access-token';
            tokenService.refreshToken = mockRefreshToken;
            tokenService.accessToken = 'old-token';
            tokenService.accessTokenExpiry = Date.now() - 1000; // Expired

            axios.put.mockResolvedValueOnce({ data: { access_token: mockAccessToken } });

            const result = await tokenService.ensureValidToken();
            expect(result).toBe(mockAccessToken);
            expect(axios.put).toHaveBeenCalledTimes(1);
            expect(axios.put).toHaveBeenCalledWith(
                expect.stringContaining('?refresh_token=test-refresh-token'),
                {},
                { headers: expect.any(Object) }
            );
        });

        it('should clear tokens on error', async () => {
            tokenService.refreshToken = null;
            tokenService.accessToken = null;
            tokenService.accessTokenExpiry = null;

            const error = new Error('API Error');
            axios.post.mockRejectedValueOnce({
                response: {
                    status: 500,
                    data: { error: 'API Error' }
                }
            });

            await expect(tokenService.ensureValidToken())
                .rejects.toThrow('Failed to get refresh token: API Error');
                
            expect(tokenService.refreshToken).toBeNull();
            expect(tokenService.accessToken).toBeNull();
            expect(tokenService.accessTokenExpiry).toBeNull();
        });
    });
}); 