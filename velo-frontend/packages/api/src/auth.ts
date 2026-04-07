import type { AxiosInstance } from "axios";
import {
  createVeloClient,
  requestData,
} from "./client";
import type {
  AuthResponseDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  SignupDto,
  UpdateProfileRequestDto,
  UserSummaryDto,
  ResetPasswordRequestDto,
} from "./types";

export interface AuthApi {
  login(input: LoginRequestDto): Promise<AuthResponseDto>;
  signup(input: SignupDto): Promise<AuthResponseDto>;
  onboardNewDriver(userId: number, payload: { vehicleId: string }): Promise<void>;
  forgotPassword(input: ForgotPasswordRequestDto): Promise<void>;
  resetPassword(input: ResetPasswordRequestDto): Promise<void>;
  updateProfile(input: UpdateProfileRequestDto): Promise<UserSummaryDto>;
  getProfile(): Promise<UserSummaryDto>;
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
      requestData<AuthResponseDto>(client, {
        method: "POST",
        url: "/auth/signup",
        data: input,
      }),
    onboardNewDriver: (userId, payload) =>
      requestData<void>(client, {
        method: "POST",
        url: `/auth/onBoardNewDriver/${userId}`,
        data: payload,
      }).then(() => undefined),
    forgotPassword: (input) =>
      requestData<void>(client, {
        method: "POST",
        url: "/auth/forgot-password",
        data: input,
      }).then(() => undefined),
    resetPassword: (input) =>
      requestData<void>(client, {
        method: "POST",
        url: "/auth/reset-password",
        data: input,
      }).then(() => undefined),
    updateProfile: (input) =>
      requestData<UserSummaryDto>(client, {
        method: "PUT",
        url: "/auth/profile",
        data: input,
      }),
    getProfile: () =>
      requestData<UserSummaryDto>(client, {
        method: "GET",
        url: "/auth/profile",
      }),
  };
}
