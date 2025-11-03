
"use client";

import { useAuth, useFirestore, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useEffect, useState, useCallback, useRef } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Employee } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br'];

export function LoginButton() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const authInProgressRef = useRef(false);

  const handleGoogleAuth = useCallback(async () => {
    // Previne múltiplas chamadas simultâneas
    if (authInProgressRef.current || isAuthLoading) {
        console.log("Autenticação Google já em progresso, ignorando chamada duplicada.");
        return;
    }

    if (!user) {
        toast({ variant: "destructive", title: "Erro", description: "Usuário não autenticado." });
        return;
    }

    // Se já existe popup aberto, apenas foca nele
    if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.focus();
        return;
    }

    authInProgressRef.current = true;
    setIsAuthLoading(true);
    
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
                    description: "Por favor, habilite pop-ups para este site e tente novamente.",
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
                            description: "Por favor, habilite pop-ups para este site e tente novamente.",
                        });
                    }
                } catch (e) {
                    // Se não conseguir acessar popup.closed, pode ser problema de cross-origin, mas não é bloqueio
                    console.log("Não foi possível verificar status do popup (isso é normal)");
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
                    cleanup();
                    // Aguarda um pouco para garantir que o token foi salvo
                    setTimeout(() => {
                        router.push("/dashboard/v2");
                    }, 1000);
                }
            };
            window.addEventListener('message', messageHandler);
            
            // Poll to see if the popup is closed
            timer = setInterval(() => {
                try {
                    if (popup.closed) {
                        cleanup();
                        // Não redireciona automaticamente - apenas limpa
                        // O usuário já foi redirecionado ou precisa fazer login novamente
                    }
                } catch (e) {
                    // Ignora erros de cross-origin
                }
            }, 500);

        } else {
            throw new Error("URL de autorização não recebida.");
        }
    } catch (error: any) {
        console.error("Erro ao iniciar autorização com Google:", error);
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


  const handleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      'hd': '3ainvestimentos.com.br',
      'prompt': 'select_account'
    });
    try {
      await signInWithPopup(auth, provider);
      // O useEffect cuidará do redirecionamento após a verificação
    } catch (error) {
      console.error("Google sign-in failed", error);
      toast({
        variant: "destructive",
        title: "Erro de Login",
        description: "Falha ao autenticar com o Google.",
      });
    }
  };

  useEffect(() => {
    const verifyAccess = async () => {
      // Aguarda o usuário ser carregado e não estar em outra verificação
      if (isUserLoading || !user || !firestore || isVerifying) return;

      setIsVerifying(true);

      if (user.email && adminEmails.includes(user.email)) {
        // Admins: checar token em employees por e-mail; só abre o Calendar se faltar
        try {
          const employeesRef = collection(firestore!, "employees");
          const qByEmail = query(employeesRef, where("email", "==", user.email));
          const snap = await getDocs(qByEmail);
          const doc = snap.docs[0]?.data() as Employee | undefined;
          const hasToken = !!(doc as any)?.googleAuth?.refreshToken;
          if (!hasToken) {
            if (!authInProgressRef.current && !isAuthLoading) {
              await handleGoogleAuth();
            }
          } else {
            router.push("/dashboard/v2");
          }
        } catch (_e) {
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

        const hasAccess = employeeData.role === 'Líder' || employeeData.isDirector === true || employeeData.isAdmin === true;
        const needsCalendarAuth = hasAccess && !(employeeData as any).googleAuth?.refreshToken;

        if (hasAccess) {
            if (needsCalendarAuth) {
                // Evita chamar handleGoogleAuth se já está em progresso
                if (!authInProgressRef.current && !isAuthLoading) {
                  await handleGoogleAuth(); // Redirect directly to Google OAuth
                }
            } else {
                router.push("/dashboard/v2"); // Already authorized, proceed
            }
        } else {
          throw new Error("Seu perfil de 'Colaborador' não tem permissão de acesso.");
        }

      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Acesso Negado",
          description: error.message || "Você não tem permissão para acessar este sistema.",
        });
        if (auth) {
          await signOut(auth);
        }
      } finally {
        setIsVerifying(false);
      }
    };

    if (user) {
        verifyAccess();
    }
  }, [user, isUserLoading, firestore, router, auth, toast, isVerifying, handleGoogleAuth]);

  const isLoading = isUserLoading || isVerifying;

  return (
    <>
        <Button
        onClick={handleLogin}
        variant="outline"
        className="w-full bg-white text-slate-800 hover:bg-white/90"
        disabled={isLoading}
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
