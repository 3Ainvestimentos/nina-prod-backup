"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/firebase";
import { Loader2 } from "lucide-react";

// Componente interno que usa useSearchParams (precisa estar em Suspense)
function LoadingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isUserLoading } = useUser();
  const [message, setMessage] = useState("Carregando CRM Interno");

  useEffect(() => {
    // Aguarda o Firebase verificar autenticação
    if (isUserLoading) {
      return;
    }

    // Verifica se veio com parâmetro de erro
    const reason = searchParams.get('reason');
    if (reason === 'no-permission') {
      setMessage("Sem permissão. Redirecionando...");
      setTimeout(() => router.replace("/login?reason=no-permission"), 1500);
      return;
    }

    // Adiciona um delay mínimo de 100ms para melhor UX
    setTimeout(() => {
      if (user) {
        // Usuário autenticado → vai para dashboard
        // A validação de permissões acontecerá no dashboard ou já foi feita no login
        console.log("[Loading] Usuário autenticado, redirecionando para dashboard...");
        router.replace("/dashboard/v2");
      } else {
        // Usuário não autenticado → vai para login
        console.log("[Loading] Usuário não autenticado, redirecionando para login...");
        router.replace("/login");
      }
    }, 100);
  }, [user, isUserLoading, router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  );
}

// Componente principal com Suspense boundary
export default function LoadingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Carregando CRM Interno</p>
      </div>
    }>
      <LoadingContent />
    </Suspense>
  );
}
