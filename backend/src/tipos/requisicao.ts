import type { Request } from "express";
import type { User } from "@supabase/supabase-js";

export interface RequisicaoAutenticada extends Request {
  usuarioAutenticado?: User;
  perfilAutenticado?: {
    role?: string | null;
  };
}
