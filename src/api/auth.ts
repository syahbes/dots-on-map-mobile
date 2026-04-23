import { request } from "./client";

export type User = {
  id: string;
  email: string;
  fullName: string;
};

type AuthResponse = { user: User; accessToken: string };

export function signup(input: {
  email: string;
  fullName: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: input,
    auth: false,
  });
}

export function login(input: { email: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: input,
    auth: false,
  });
}

export function me(): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/me");
}
