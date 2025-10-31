
"use client";

import { useState } from 'react';
import { getFunctions, httpsCallable } from "firebase/functions";
import { useUser, useFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, ShieldX } from "lucide-react";

const superAdminEmail = 'matheus@3ainvestimentos.com.br';
const emailsToPromote = [
    'lucas.nogueira@3ainvestimentos.com.br',
    'matheus@3ainvestimentos.com.br'
];

export default function SetupAdminPage() {
    const { user, isUserLoading } = useUser();
    const { firebaseApp } = useFirebase();
    const { toast } = useToast();
    const [loading, setLoading] = useState<{[key: string]: boolean}>({});

    const grantAdminAccess = async (email: string) => {
        if (!firebaseApp) {
            toast({ variant: "destructive", title: "Erro", description: "Firebase não inicializado."});
            return;
        }

        setLoading(prev => ({...prev, [email]: true}));
        
        try {
            const functions = getFunctions(firebaseApp, 'southamerica-east1');
            const setupFirstAdmin = httpsCallable(functions, 'setupFirstAdmin');
            
            const result: any = await setupFirstAdmin({ email: email });

            toast({
                title: "Sucesso!",
                description: result.data.message,
            });

        } catch (error: any) {
            console.error("Erro ao chamar a função:", error);
            toast({
                variant: "destructive",
                title: "Erro ao promover usuário",
                description: error.message || "Ocorreu um erro desconhecido.",
            });
        } finally {
            setLoading(prev => ({...prev, [email]: false}));
        }
    };

    if (isUserLoading) {
        return <p>Carregando...</p>;
    }

    if (user?.email !== superAdminEmail) {
        return (
            <Alert variant="destructive">
                <ShieldX className="h-4 w-4" />
                <AlertTitle>Acesso Negado</AlertTitle>
                <AlertDescription>
                    Você não tem permissão para acessar esta página.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Card className="max-w-xl mx-auto">
            <CardHeader>
                <CardTitle>Configuração Inicial de Administrador</CardTitle>
                <CardDescription>
                    Use esta página para conceder permissões de administrador aos usuários iniciais.
                    Esta é uma ação única. Após a execução, esta página pode ser removida.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Acesso de Super Administrador Concedido</AlertTitle>
                    <AlertDescription>
                        Você está vendo esta página porque seu e-mail ({user.email}) está autorizado.
                    </AlertDescription>
                </Alert>
                <div className="space-y-3">
                    {emailsToPromote.map(email => (
                         <div key={email} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <p className="font-medium">Tornar administrador:</p>
                                <p className="text-sm text-muted-foreground">{email}</p>
                            </div>
                            <Button 
                                onClick={() => grantAdminAccess(email)}
                                disabled={loading[email]}
                            >
                                {loading[email] ? 'Processando...' : 'Executar Função'}
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

    