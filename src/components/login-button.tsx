
"use client";

import { useAuth, useFirestore, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { useEffect, useState, useCallback, useRef } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Employee } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { loginWithGoogle } from "@/firebase/google-login";

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br'];

export function LoginButton() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const authInProgressRef = useRef(false);
  const signInInProgressRef = useRef(false);
  const hasVerifiedOnceRef = useRef(false);
  const authSuccessTimestampRef = useRef<number>(0);

  // Versão estável de handleGoogleAuth usando useRef para evitar loop de dependências
  const handleGoogleAuthRef = useRef<(() => Promise<void>) | null>(null);

  const handleGoogleAuth = useCallback(async () => {
    // Previne múltiplas chamadas simultâneas
    if (authInProgressRef.current || isAuthLoading) {
        console.log("[GoogleAuth] Autenticação já em progresso, ignorando chamada duplicada.");
        return;
    }

    if (!user) {
        toast({ variant: "destructive", title: "Erro", description: "Usuário não autenticado." });
        return;
    }

    // Se já existe popup aberto, apenas foca nele
    if (popupRef.current && !popupRef.current.closed) {
        console.log("[GoogleAuth] Popup já aberto, apenas focando.");
        popupRef.current.focus();
        return;
    }

    authInProgressRef.current = true;
    setIsAuthLoading(true);
    
    console.log("[GoogleAuth] Iniciando fluxo de autorização para:", user.email);
    
    try {
        const projectId = "studio-9152494730-25d31";
        const uid = user.uid;
        const url = `https://us-central1-${projectId}.cloudfunctions.net/googleAuthInit?uid=${uid}`;
        
        const response = await fetch(url, { method: "GET" });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Falha ao obter URL de autorização.");
        }
        const result: any = await response.json();
        const authUrl = result.authUrl;

        if (authUrl) {
            // Instead of redirecting the whole window, open a popup
            const popup = window.open(authUrl, 'google-auth', 'width=520,height=650');
            popupRef.current = popup;
            
            // Se popup é null imediatamente, está bloqueado
            if (!popup) {
                authInProgressRef.current = false;
                setIsAuthLoading(false);
                popupRef.current = null;
                toast({
                    variant: "destructive",
                    title: "Pop-up Bloqueado",
                    description: "Por favor, habilite pop-ups para este site e tente novamente. Se o problema persistir, limpe o cache do navegador (Ctrl+Shift+Del) e recarregue a página.",
                });
                return;
            }
            
            // Verifica se popup foi fechado imediatamente após abrir (indica bloqueio)
            setTimeout(() => {
                try {
                    if (popup.closed) {
                        authInProgressRef.current = false;
                        setIsAuthLoading(false);
                        popupRef.current = null;
                        toast({
                            variant: "destructive",
                            title: "Pop-up Bloqueado",
                            description: "Por favor, habilite pop-ups para este site e tente novamente. Se o problema persistir, limpe o cache do navegador (Ctrl+Shift+Del) e recarregue a página.",
                        });
                    }
                } catch (e) {
                    console.log("[GoogleAuth] Não foi possível verificar status do popup (cross-origin)");
                }
            }, 500);
            
            let timer: NodeJS.Timeout | null = null;
            let messageHandler: ((event: MessageEvent) => void) | null = null;
            let cleanedUp = false;
            
            const cleanup = () => {
                if (cleanedUp) return;
                cleanedUp = true;
                
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                }
                if (messageHandler) {
                    window.removeEventListener('message', messageHandler);
                    messageHandler = null;
                }
                authInProgressRef.current = false;
                setIsAuthLoading(false);
                popupRef.current = null;
            };
            
            // Escuta mensagem do popup
            messageHandler = (event: MessageEvent) => {
                if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
                    console.log("[GoogleAuth] Autorização concluída com sucesso!");
                    authSuccessTimestampRef.current = Date.now();
                    cleanup();
                    // Aguarda para garantir que o token foi salvo no Firestore
                    setTimeout(() => {
                        console.log("[GoogleAuth] Redirecionando para dashboard...");
                        router.push("/dashboard/v2");
                    }, 2000); // Aumentado para 2 segundos
                }
            };
            window.addEventListener('message', messageHandler);
            
            // Poll to see if the popup is closed
            timer = setInterval(() => {
                try {
                    if (popup.closed) {
                        console.log("[GoogleAuth] Popup fechado pelo usuário.");
                        cleanup();
                    }
                } catch (e) {
                    // Ignora erros de cross-origin
                }
            }, 500);

        } else {
            throw new Error("URL de autorização não recebida.");
        }
    } catch (error: any) {
        console.error("[GoogleAuth] Erro ao iniciar autorização:", error);
        authInProgressRef.current = false;
        setIsAuthLoading(false);
        popupRef.current = null;
        toast({
            variant: "destructive",
            title: "Erro de Autorização",
            description: error.message || "Não foi possível iniciar a conexão com o Google Calendar.",
        });
    }
  }, [user, toast, router, isAuthLoading]);

  // Atualiza a ref sempre que a função mudar
  handleGoogleAuthRef.current = handleGoogleAuth;


  const handleLogin = async () => {
    if (!auth) return;
    if (signInInProgressRef.current) return;
    signInInProgressRef.current = true;
    setIsSigningIn(true);
    try {
      const result = await loginWithGoogle(auth, { domain: '3ainvestimentos.com.br' });
      if (result.status === 'redirect' || result.status === 'cancelled' || result.status === 'ok') {
        // Sem ação adicional necessária aqui; fluxos tratados externamente
      }
    } catch (error: any) {
      console.error("Google sign-in failed", error);
      toast({
        variant: "destructive",
        title: "Erro de Login",
        description: "Falha ao autenticar com o Google.",
      });
    } finally {
      signInInProgressRef.current = false;
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    const verifyAccess = async () => {
      // Evita múltiplas verificações na mesma sessão
      if (hasVerifiedOnceRef.current) {
        console.log("[LoginButton] Verificação já realizada nesta sessão, ignorando.");
        return;
      }

      // Se acabou de autorizar (menos de 5 segundos), aguarda antes de verificar
      const timeSinceAuth = Date.now() - authSuccessTimestampRef.current;
      if (authSuccessTimestampRef.current > 0 && timeSinceAuth < 5000) {
        console.log("[LoginButton] Autorização recente detectada, aguardando propagação do token...");
        setTimeout(() => {
          hasVerifiedOnceRef.current = false; // Permite verificar novamente
          verifyAccess();
        }, 2000);
        return;
      }

      // Aguarda o usuário ser carregado e não estar em outra verificação
      if (isUserLoading || !user || !firestore || isVerifying) return;

      hasVerifiedOnceRef.current = true;
      setIsVerifying(true);

      console.log("[LoginButton] Iniciando verificação de acesso para:", user.email);

      if (user.email && adminEmails.includes(user.email)) {
        // Admins: checar token em employees por e-mail; só abre o Calendar se faltar
        console.log("[LoginButton] Usuário admin detectado:", user.email);
        try {
          const employeesRef = collection(firestore!, "employees");
          const qByEmail = query(employeesRef, where("email", "==", user.email));
          const snap = await getDocs(qByEmail);
          const doc = snap.docs[0]?.data() as Employee | undefined;
          const hasToken = !!(doc as any)?.googleAuth?.refreshToken;
          
          console.log("[LoginButton] Admin - Token encontrado:", hasToken);
          
          if (!hasToken) {
            if (!authInProgressRef.current && !isAuthLoading && handleGoogleAuthRef.current) {
              console.log("[LoginButton] Iniciando autorização Google Calendar para admin...");
              await handleGoogleAuthRef.current();
            }
          } else {
            console.log("[LoginButton] Admin já autorizado, redirecionando...");
            router.push("/dashboard/v2");
          }
        } catch (e) {
          console.error("[LoginButton] Erro ao verificar admin:", e);
          router.push("/dashboard/v2");
        }
        setIsVerifying(false);
        return;
      }

      const employeesRef = collection(firestore, "employees");
      const q = query(employeesRef, where("email", "==", user.email));
      
      try {
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error("Usuário não encontrado no sistema.");
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data() as Employee;

        console.log("[LoginButton] Dados do funcionário:", {
          role: employeeData.role,
          isDirector: employeeData.isDirector,
          isAdmin: employeeData.isAdmin,
          hasToken: !!(employeeData as any).googleAuth?.refreshToken
        });

        const hasAccess = employeeData.role === 'Líder' || employeeData.role === 'Líder de Projeto' || employeeData.isDirector === true || employeeData.isAdmin === true;
        const needsCalendarAuth = hasAccess && !(employeeData as any).googleAuth?.refreshToken;

        if (hasAccess) {
            if (needsCalendarAuth) {
                console.log("[LoginButton] Líder precisa autorizar Google Calendar...");
                // Evita chamar handleGoogleAuth se já está em progresso
                if (!authInProgressRef.current && !isAuthLoading && handleGoogleAuthRef.current) {
                  await handleGoogleAuthRef.current();
                }
            } else {
                console.log("[LoginButton] Líder já autorizado, redirecionando...");
                router.push("/dashboard/v2");
            }
        } else {
          throw new Error("Seu perfil de 'Colaborador' não tem permissão de acesso.");
        }

      } catch (error: any) {
        console.error("[LoginButton] Erro na verificação:", error);
        toast({
          variant: "destructive",
          title: "Acesso Negado",
          description: error.message || "Você não tem permissão para acessar este sistema.",
        });
        if (auth) {
          await signOut(auth);
        }
        hasVerifiedOnceRef.current = false;
      } finally {
        setIsVerifying(false);
      }
    };

    if (user) {
        verifyAccess();
    }
  }, [user, isUserLoading, firestore, router, auth, toast, isVerifying, isAuthLoading]);

  const isLoading = isUserLoading || isVerifying || isSigningIn;

  return (
    <>
        <Button
        onClick={handleLogin}
        variant="outline"
        className="w-full bg-white text-slate-800 hover:bg-white/90"
        disabled={isLoading}
        aria-busy={isSigningIn}
        >
        {isLoading ? (
            "Verificando..."
        ) : (
            <>
            <Icons.google className="mr-2 h-4 w-4" />
            Entrar com Google
            </>
        )}
        </Button>
    </>
  );
}
