import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { UserProps } from '../models/User';
import { ApiAddress } from './ApiAddress';
import { ApiBaseInterface, ApiBase } from './ApiBase';
import { ApiDriverLocations } from './ApiDriverLocations';
interface CredentialsProps {
    email?: string;
    cellphone?: string;
    password?: string;
}
interface ForgotProps {
    email?: string;
}
interface ResetProps {
    code?: string;
    random?: string;
    password: string;
}
interface FacebookProps {
    access_token?: string;
}
interface GoogleProps {
    access_token?: string;
}
interface LogoutProps {
    token_notification?: string;
}
/**
 * Class to user api control
 */
export declare class ApiUser extends ApiBase implements ApiBaseInterface {
    private userId;
    constructor(ordering: Ordering, userId?: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a user if userId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a user if userId is set else create user
     * @param {UserProps} user Attributes to create or update user
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(user: UserProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a user by userId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Get session for a user
     * @param {CredentialsProps} credentials Email/cellphone and password
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    auth(credentials: CredentialsProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Close session for a user
     * @param {LogoutProps} logout token_notification to avoid send notification to this device
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    logout(logout?: LogoutProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Send a email to reset the user password
     * @param {ForgotProps} forgot data to send data to reset password
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    forgotPassword(forgot: ForgotProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Change password with email data
     * @param {ResetProps} reset data to reset password
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    resetPassword(reset: ResetProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Login with Facebook
     * @param {FacebookProps} facebook access_token to login with Facebook
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    authFacebook(facebook: FacebookProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Login with Google
     * @param {GoogleProps} google access_token to login with Facebook
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    authGoogle(google: GoogleProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Return api alert a user by userId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    alerts(): {
        get: (options?: RequestOptionsProps) => Promise<ApiResponse>;
    };
    /**
     * Return the api addresses
     * @param {number} addressId Address id is optional
     */
    addresses(addressId: number): ApiAddress;
    /**
   * Return the api driver locations
   * @param {number} addressId Address id is optional
   */
    driverLocations(): ApiDriverLocations;
}
export {};
