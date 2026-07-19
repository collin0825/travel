export interface LoginPayload {
  email: string;
  password: string;
  /** Backend schema requires the field; unused for login. */
  display_name: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  display_name: string;
}

export interface ResetPasswordPayload {
  email: string;
  /** Doubles as the verification answer for the no-email reset flow. */
  display_name: string;
  new_password: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}
