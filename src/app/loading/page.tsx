"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Loader2 } from "lucide-react";

// Componente interno que usa useSearchParams (precisa estar em Suspense)
function LoadingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [message, setMessage] = useState("Carregando CRM Interno");

  // Função de preload de employees (opcional, com segurança)
  const preloadEmployees = async () => {
    try {
      if (!firestore || !user) return null;
      const employeesRef = collection(firestore, "employees");
      const snapshot = await getDocs(employeesRef);
      const employees = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      // Salvar em cache apenas se localStorage disponível
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem('preloaded-employees', JSON.stringify({
            data: employees,
            timestamp: Date.now()
          }));
        } catch (e) {
          // Ignora erro de localStorage
        }
      }
      return employees;
    } catch (error) {
      console.warn('[Loading] Erro ao precarregar employees:', error);
      return null; // Não quebra se falhar
    }
  };

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

    // Promise com delay de 1s e preload opcional, com timeout máximo de 3s
    const delay = new Promise(resolve => setTimeout(resolve, 1000));
    const preload = preloadEmployees();
    
    Promise.race([
      Promise.all([delay, preload]),
      new Promise(resolve => setTimeout(resolve, 3000)) // Timeout máximo
    ]).then(() => {
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
    }).catch((error) => {
      // Fallback: redireciona mesmo se houver erro
      console.warn('[Loading] Erro no preload, redirecionando mesmo assim:', error);
      if (user) {
        router.replace("/dashboard/v2");
      } else {
        router.replace("/login");
      }
    });
  }, [user, isUserLoading, router, searchParams, firestore]);

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
