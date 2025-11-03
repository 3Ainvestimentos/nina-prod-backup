"use client";

import { useUser } from "@/firebase";

const adminEmails = [
  'matheus@3ainvestimentos.com.br',
  'lucas.nogueira@3ainvestimentos.com.br',
  'henrique.peixoto@3ainvestimentos.com.br',
];

export function useIsConfigAdmin() {
  const { user } = useUser();
  const email = user?.email || "";
  const isConfigAdmin = adminEmails.includes(email);
  return { isConfigAdmin };
}


