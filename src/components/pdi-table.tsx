
"use client"

import { useState } from "react";
import type { PDIAction } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, PlusCircle, Pen, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PdiActionFormDialog } from "./pdi-action-form-dialog";
import { useFirestore, useUser, softDeleteDocument } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type PdiTableProps = {
    pdiActions: PDIAction[];
    employeeId: string;
};

export function PdiTable({ pdiActions, employeeId }: PdiTableProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState<PDIAction | undefined>(undefined);
    const firestore = useFirestore();
    const { toast } = useToast();

    const { user } = useUser();

    const handleAdd = () => {
        setSelectedAction(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (action: PDIAction) => {
        setSelectedAction(action);
        setIsFormOpen(true);
    };

    const handleDelete = async (actionId: string) => {
        if (!firestore || !user) return;
        const docRef = doc(firestore, "employees", employeeId, "pdiActions", actionId);
        try {
            await softDeleteDocument(docRef, user.uid);
            toast({
                title: "Ação Removida",
                description: "A ação do PDI foi removida com sucesso (Soft Delete).",
            });
        } catch (error) {
            console.error("Error deleting PDI action:", error);
            toast({
                variant: "destructive",
                title: "Erro ao Remover",
                description: "Não foi possível remover a ação do PDI.",
            });
        }
    };

    const getStatusBadge = (status: "To Do" | "In Progress" | "Completed") => {
        switch (status) {
          case "Completed":
            return "default";
          case "In Progress":
            return "secondary";
          case "To Do":
            return "outline";
        }
    };

    const getStatusLabel = (status: "To Do" | "In Progress" | "Completed") => {
        const labels = {
            "To Do": "A Fazer",
            "In Progress": "Em Progresso",
            "Completed": "Concluído",
        };
        return labels[status];
    }
    
  return (
    <>
        <div className="flex justify-end mb-4">
            <Button size="sm" onClick={handleAdd}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Ação
            </Button>
        </div>
        <Table>
        <TableHeader>
            <TableRow>
            <TableHead>Ação</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {pdiActions.length > 0 ? pdiActions.map((item) => (
            <TableRow key={item.id}>
                <TableCell className="font-medium max-w-xs truncate">{item.description}</TableCell>
                <TableCell>{new Date(item.startDate).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>{new Date(item.endDate).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                <Badge variant={getStatusBadge(item.status)}>{getStatusLabel(item.status)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleEdit(item)}><Pen className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}><Trash className="mr-2 h-4 w-4" /> Remover</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
            )) : (
                <TableRow>
                    <TableCell colSpan={5} className="text-center">Nenhuma ação PDI encontrada.</TableCell>
                </TableRow>
            )}
        </TableBody>
        </Table>
        <PdiActionFormDialog
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            employeeId={employeeId}
            action={selectedAction}
        />
    </>
  );
}
