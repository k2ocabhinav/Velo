import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type {
  AuthResponseDto,
  DriverDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  OnboardDriverDto,
  ResetPasswordRequestDto,
  SignupDto,
  UpdateProfileRequestDto,
  UserDto,
} from "./types";

export type AuthMessageResponse = Record<string, string>;

export interface AuthApi {
  login(input: LoginRequestDto): Promise<AuthResponseDto>;
  signup(input: SignupDto): Promise<UserDto>;
  onboardNewDriver(userId: number, payload: OnboardDriverDto): Promise<DriverDto>;
  forgotPassword(input: ForgotPasswordRequestDto): Promise<AuthMessageResponse>;
  resetPassword(input: ResetPasswordRequestDto): Promise<AuthMessageResponse>;
  updateProfile(input: UpdateProfileRequestDto): Promise<UserDto>;
}

export function createAuthApi(client: AxiosInstance = createVeloClient()): AuthApi {
  return {
    login: (input) =>
      requestData<AuthResponseDto>(client, {
        method: "POST",
        url: "/auth/login",
        data: input,
      }),
    signup: (input) =>
      requestData<UserDto>(client, {
        method: "POST",
        url: "/auth/signup",
        data: input,
      }),
    onboardNewDriver: (userId, payload) =>
      requestData<DriverDto>(client, {
        method: "POST",
        url: `/auth/onBoardNewDriver/${userId}`,
        data: payload,
      }),
    forgotPassword: (input) =>
      requestData<AuthMessageResponse>(client, {
        method: "POST",
        url: "/auth/forgot-password",
        data: input,
      }),
    resetPassword: (input) =>
      requestData<AuthMessageResponse>(client, {
        method: "POST",
        url: "/auth/reset-password",
        data: input,
      }),
    updateProfile: (input) =>
      requestData<UserDto>(client, {
        method: "PUT",
        url: "/auth/profile",
        data: input,
      }),
  };
}
