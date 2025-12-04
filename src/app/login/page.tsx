
"use client";

import { useAuth, useFirestore, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Employee } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import Image from "next/image";
import { loginWithGoogle } from "@/firebase/google-login";

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br'];

// Chave para rastrear se já verificou autorização Google nesta sessão
const SESSION_STORAGE_KEY = 'google-auth-checked-session';

// Componente interno que usa useSearchParams
function LoginPageContent() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
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

    // Se já existe popup aberto, apenas foca nele
    if (popupRef.current && !popupRef.current.closed) {
        console.log("[GoogleAuth] Popup já aberto, apenas focando.");
        popupRef.current.focus();
        return;
    }

    authInProgressRef.current = true;

    if (!user) {
        authInProgressRef.current = false;
        toast({ variant: "destructive", title: "Erro", description: "Usuário não autenticado." });
        return;
    }
    
    console.log("[GoogleAuth] Iniciando fluxo de autorização para:", user.email);
    setIsAuthLoading(true);
    try {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
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
            
            // Poll para verificar se o popup foi fechado
            timer = setInterval(() => {
                try {
                    if (popup.closed) {
                        console.log("[GoogleAuth] Popup fechado pelo usuário.");
                        // Limpa sessionStorage para permitir nova tentativa na mesma sessão
                        if (typeof window !== 'undefined') {
                            sessionStorage.removeItem(SESSION_STORAGE_KEY);
                        }
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
        // Limpa sessionStorage para permitir nova tentativa na mesma sessão
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
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
      // Aceita tanto 3ainvestimentos.com.br quanto 3ariva.com.br
      const result = await loginWithGoogle(auth);
      if (result.status === 'redirect' || result.status === 'cancelled' || result.status === 'ok') {
        // Sem ação adicional necessária aqui; fluxos tratados externamente
      }
    } catch (error: any) {
      console.error("Google sign-in failed", error);
      toast({
        variant: "destructive",
        title: "Erro de Login",
        description: "Falha ao autenticar com o Google. Certifique-se de usar uma conta @3ainvestimentos.com.br.",
      });
    } finally {
      signInInProgressRef.current = false;
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    const verifyAccess = async () => {
      // PRIMEIRA VERIFICAÇÃO: Se já foi verificado nesta sessão (sessionStorage persiste entre recarregamentos)
      const alreadyCheckedThisSession = typeof window !== 'undefined' && sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
      if (alreadyCheckedThisSession) {
        console.log("[Login] Já foi verificado nesta sessão (sessionStorage), ignorando verificação automática.");
        return;
      }

      // Evita múltiplas verificações na mesma renderização (useRef não persiste entre recarregamentos)
      if (hasVerifiedOnceRef.current) {
        console.log("[Login] Verificação já realizada nesta renderização, ignorando.");
        return;
      }

      // Se acabou de autorizar (menos de 5 segundos), aguarda antes de verificar
      const timeSinceAuth = Date.now() - authSuccessTimestampRef.current;
      if (authSuccessTimestampRef.current > 0 && timeSinceAuth < 5000) {
        console.log("[Login] Autorização recente detectada, aguardando propagação do token...");
        setTimeout(() => {
          hasVerifiedOnceRef.current = false; // Permite verificar novamente
          verifyAccess();
        }, 2000);
        return;
      }

      if (isUserLoading || !user || !firestore || isVerifying) return;

      hasVerifiedOnceRef.current = true;
      setIsVerifying(true);
      
      console.log("[Login] Iniciando verificação de acesso para:", user.email);
      
      // Aceita emails de ambos os domínios: @3ainvestimentos.com.br e @3ariva.com.br
      const isValidDomain = user.email?.endsWith('@3ainvestimentos.com.br') || user.email?.endsWith('@3ariva.com.br');
      
      if (!isValidDomain) {
          console.log("[Login] Domínio inválido:", user.email);
          toast({
              variant: "destructive",
              title: "Acesso Negado",
              description: "Por favor, use uma conta de e-mail da 3A Investimentos ou 3A Riva.",
          });
          if (auth) await signOut(auth);
          setIsVerifying(false);
          hasVerifiedOnceRef.current = false;
          return;
      }

      if (user.email && adminEmails.includes(user.email)) {
        // Admins: checar token e escopo no employees por e-mail; só abre o Calendar se faltar
        console.log("[Login] Usuário admin detectado:", user.email);
        try {
          const employeesRef = collection(firestore!, "employees");
          const qByEmail = query(employeesRef, where("email", "==", user.email));
          const snap = await getDocs(qByEmail);
          const doc = snap.docs[0]?.data() as Employee | undefined;
          const googleAuth = (doc as any)?.googleAuth;
          const hasToken = !!googleAuth?.refreshToken;
          
          // Verificar escopo (pode ser string ou array, ou não existir)
          const savedScope = googleAuth?.scope;
          let hasGmailScope = false;
          
          if (savedScope) {
            if (typeof savedScope === 'string') {
              hasGmailScope = savedScope.includes('gmail.send');
            } else if (Array.isArray(savedScope)) {
              hasGmailScope = savedScope.some(scope => 
                typeof scope === 'string' && scope.includes('gmail.send')
              );
            }
          }
          
          console.log("[Login] Admin - Token encontrado:", hasToken, "Escopo gmail.send:", hasGmailScope);
          
          if (!hasToken || !hasGmailScope) {
            // Verifica se já foi verificado nesta sessão (evita popup ao atualizar página)
            const alreadyCheckedThisSession = typeof window !== 'undefined' && sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
            
            if (!alreadyCheckedThisSession && !authInProgressRef.current && !isAuthLoading && handleGoogleAuthRef.current) {
              console.log("[Login] Iniciando autorização Google Calendar/Gmail para admin...", {
                reason: !hasToken ? 'Sem token' : 'Sem escopo gmail.send'
              });
              // Marca que já verificou nesta sessão
              if (typeof window !== 'undefined') {
                sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
              }
              await handleGoogleAuthRef.current();
            }
          } else {
            console.log("[Login] Admin já autorizado com todos os escopos necessários, redirecionando...");
            router.push("/dashboard/v2");
          }
        } catch (e) {
          console.error("[Login] Erro ao verificar admin:", e);
          // Falhou leitura: tenta seguir para dashboard; usuário poderá autorizar depois nas telas
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

        console.log("[Login] Dados do funcionário:", {
          role: employeeData.role,
          isDirector: employeeData.isDirector,
          isAdmin: employeeData.isAdmin,
          hasToken: !!(employeeData as any).googleAuth?.refreshToken
        });

        const hasAccess = employeeData.role === 'Líder' || employeeData.role === 'Líder de Projeto' || employeeData.isDirector === true || employeeData.isAdmin === true;
        const googleAuth = (employeeData as any).googleAuth;
        const hasToken = !!googleAuth?.refreshToken;
        
        // Verificar escopo (pode ser string ou array, ou não existir)
        const savedScope = googleAuth?.scope;
        let hasGmailScope = false;
        
        if (savedScope) {
          if (typeof savedScope === 'string') {
            hasGmailScope = savedScope.includes('gmail.send');
          } else if (Array.isArray(savedScope)) {
            hasGmailScope = savedScope.some(scope => 
              typeof scope === 'string' && scope.includes('gmail.send')
            );
          }
        }
        
        // Precisa autorizar se não tem token OU se tem token antigo sem escopo de email
        const needsCalendarAuth = hasAccess && (!hasToken || !hasGmailScope);

        if (hasAccess) {
            if (needsCalendarAuth) {
                console.log("[Login] Líder precisa autorizar Google Calendar/Gmail", {
                  hasToken,
                  hasGmailScope,
                  savedScope: savedScope || 'N/A',
                  scopeType: typeof savedScope,
                  reason: !hasToken ? 'Sem token' : 'Sem escopo gmail.send'
                });
                // Verifica se já foi verificado nesta sessão (evita popup ao atualizar página)
                const alreadyCheckedThisSession = typeof window !== 'undefined' && sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
                
                // Evita chamar handleGoogleAuth se já está em progresso ou já foi verificado nesta sessão
                if (!alreadyCheckedThisSession && !authInProgressRef.current && !isAuthLoading && handleGoogleAuthRef.current) {
                  // Marca que já verificou nesta sessão
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
                  }
                  await handleGoogleAuthRef.current();
                }
            } else {
                console.log("[Login] Líder já autorizado com todos os escopos necessários, redirecionando...");
                router.push("/dashboard/v2");
            }
        } else {
          throw new Error("Seu perfil de 'Colaborador' não tem permissão de acesso.");
        }

      } catch (error: any) {
        const msg = String(error?.message || "");
        const code = (error?.code || "").toString();
        console.error("[Login] Erro na verificação:", { msg, code });
        // Suprime erro ruidoso de permissão (false-positive em alguns cenários de carga)
        const isPermDenied = code === 'permission-denied' || msg.includes('Missing or insufficient permissions');
        if (!isPermDenied) {
          toast({
            variant: "destructive",
            title: "Acesso Negado",
            description: msg || "Você não tem permissão para acessar este sistema.",
          });
        }
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

  // Verifica se veio com parâmetro de erro da página de loading
  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'no-permission') {
      setAuthErrorMessage("Você não tem permissão para acessar esta aplicação. Apenas Líderes, Diretores e Admins podem acessar.");
    }
  }, [searchParams]);

  const isLoading = isUserLoading || isVerifying || isSigningIn;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4" style={{ backgroundColor: 'hsl(220, 20%, 96%)' }}>
      <Card className="w-full max-w-sm rounded-2xl border-none p-8 bg-white shadow-lg">
        <div className="flex justify-center mb-8">
            <Image 
                src="https://firebasestorage.googleapis.com/v0/b/a-riva-hub.firebasestorage.app/o/Imagens%20institucionais%20(logos%20e%20etc)%2Flogo%20oficial%20preta.png?alt=media&token=ce88dc80-01cd-4295-b443-951e6c0210aa" 
                alt="3A RIVA Investimentos" 
                width={200} 
                height={100} 
                className="h-auto"
            />
        </div>
        {authErrorMessage && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <p className="text-sm text-destructive text-center">{authErrorMessage}</p>
          </div>
        )}
        <CardContent className="p-0">
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
        </CardContent>
      </Card>
    </main>
  );
}

// Componente principal com Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4" style={{ backgroundColor: 'hsl(220, 20%, 96%)' }}>
        <Card className="w-full max-w-sm rounded-2xl border-none p-8 bg-white shadow-lg">
          <div className="flex justify-center mb-8">
            <Image 
              src="https://firebasestorage.googleapis.com/v0/b/a-riva-hub.firebasestorage.app/o/Imagens%20institucionais%20(logos%20e%20etc)%2Flogo%20oficial%20preta.png?alt=media&token=ce88dc80-01cd-4295-b443-951e6c0210aa" 
              alt="3A RIVA Investimentos" 
              width={200} 
              height={100} 
              className="h-auto"
            />
          </div>
          <CardContent className="p-0">
            <Button variant="outline" className="w-full bg-white text-slate-800" disabled>
              Carregando...
            </Button>
          </CardContent>
        </Card>
      </main>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

