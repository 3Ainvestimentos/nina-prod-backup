
"use client";

import { useAuth, useFirestore, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Employee } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { 
    AlertDialog, 
    AlertDialogContent, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogDescription, 
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import Image from "next/image";

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br'];

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleGoogleAuth = async () => {
    if (!user) {
        toast({ variant: "destructive", title: "Erro", description: "Usuário não autenticado." });
        return;
    }
    setIsAuthLoading(true);
    try {
        const response = await fetch(`https://southamerica-east1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/googleAuthInit?uid=${user.uid}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Falha ao obter URL de autorização.");
        }
        const result: any = await response.json();
        const authUrl = result.authUrl;

        if (authUrl) {
            const popup = window.open(authUrl, 'google-auth', 'width=600,height=700');
            
            if (!popup || popup.closed || typeof popup.closed == 'undefined') {
                 toast({
                    variant: "destructive",
                    title: "Pop-up Bloqueado",
                    description: "Por favor, habilite pop-ups para este site e tente novamente.",
                });
                setIsAuthLoading(false);
                return;
            }
            
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    setIsAuthLoading(false);
                    setShowAuthModal(false);
                    router.push("/dashboard/v2");
                }
            }, 500);

        } else {
            throw new Error("URL de autorização não recebida.");
        }
    } catch (error: any) {
        console.error("Erro ao iniciar autorização com Google:", error);
        toast({
            variant: "destructive",
            title: "Erro de Autorização",
            description: error.message || "Não foi possível iniciar a conexão com o Google Calendar.",
        });
        setIsAuthLoading(false);
    }
  };


  const handleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      'hd': '3ainvestimentos.com.br'
    });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google sign-in failed", error);
      toast({
        variant: "destructive",
        title: "Erro de Login",
        description: "Falha ao autenticar com o Google. Certifique-se de usar uma conta @3ainvestimentos.com.br.",
      });
    }
  };

  useEffect(() => {
    const verifyAccess = async () => {
      if (isUserLoading || !user || !firestore || isVerifying) return;

      setIsVerifying(true);
      
      if (!user.email?.endsWith('@3ainvestimentos.com.br')) {
          toast({
              variant: "destructive",
              title: "Acesso Negado",
              description: "Por favor, use uma conta de e-mail da 3A Investimentos.",
          });
          if (auth) await signOut(auth);
          setIsVerifying(false);
          return;
      }

      if (adminEmails.includes(user.email)) {
        setShowAuthModal(true);
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
                setShowAuthModal(true);
            } else {
                router.push("/dashboard/v2");
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
  }, [user, isUserLoading, firestore, router, auth, toast, isVerifying]);

  const isLoading = isUserLoading || isVerifying;

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
        <CardContent className="p-0">
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
          <AlertDialog open={showAuthModal}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Conectar ao Google Calendar?</AlertDialogTitle>
                      <AlertDialogDescription>
                          Para uma melhor experiência e para automatizar o agendamento de interações (como o N3 Individual), a plataforma Nina precisa de permissão para criar eventos na sua agenda do Google. Seus dados não serão compartilhados.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => {
                          setShowAuthModal(false);
                          router.push("/dashboard/v2");
                      }} disabled={isAuthLoading}>
                          Pular por agora
                      </AlertDialogCancel>
                      <AlertDialogAction onClick={handleGoogleAuth} disabled={isAuthLoading}>
                          {isAuthLoading ? 'Aguardando autorização...' : (
                              <>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Conectar e Autorizar
                              </>
                          )}
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </main>
  );
}
