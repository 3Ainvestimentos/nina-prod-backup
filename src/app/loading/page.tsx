"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { Loader2 } from "lucide-react";

export default function LoadingPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (!loading) {
      // Adiciona um delay mínimo de 100ms para melhor UX
      setTimeout(() => {
        if (user) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      }, 100);
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Carregando CRM Interno</p>
    </div>
  );
}

