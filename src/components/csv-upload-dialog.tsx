
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileUp, FileCheck2, AlertCircle } from "lucide-react";
import { useFirestore } from "@/firebase";
import { collection, doc, getDocs } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import type { Employee } from "@/lib/types";


type CsvData = { [key: string]: string };

const EXPECTED_COLUMNS = [
    'id3a',
    'name',
    'email',
    'photoURL',
    'axis',
    'area',
    'position',
    'segment',
    'leaderEmail', // Alterado de 'leader' para 'leaderEmail'
    'city'
];

export function CsvUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void; }) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<CsvData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    setFile(null);
    setData([]);
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
        if(selectedFile.type !== 'text/csv') {
            setError("Tipo de arquivo inválido. Por favor, selecione um arquivo CSV.");
            return;
        }
      setFile(selectedFile);
      parseCsv(selectedFile);
    }
  }, []);

  const parseCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => {
        // Remove linhas vazias ou que contenham apenas separadores (ex: ",,,,,")
        const cleaned = line.replace(/,/g, '').trim();
        return cleaned !== '';
      });
      if (lines.length < 2) {
        setError("O arquivo CSV está vazio ou contém apenas o cabeçalho.");
        return;
      }
      const header = lines[0].split(',').map(h => h.trim());
      
      const missingColumns = EXPECTED_COLUMNS.filter(col => !header.includes(col));
      if (missingColumns.length > 0) {
          setError(`As seguintes colunas obrigatórias estão faltando: ${missingColumns.join(', ')}`);
          return;
      }

      const rows = lines.slice(1).map((line) => {
        const values = line.split(',');
        return header.reduce((obj, nextKey, index) => {
            obj[nextKey] = values[index] ? values[index].trim() : '';
            return obj;
        }, {} as CsvData);
      });
      setData(rows);
    };
    reader.onerror = () => {
        setError("Ocorreu um erro ao ler o arquivo.");
    }
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  const handleClose = () => {
    setFile(null);
    setData([]);
    setError(null);
    setIsImporting(false);
    onOpenChange(false);
  }

  const handleImport = async () => {
    if (!firestore || data.length === 0) return;

    setIsImporting(true);
    try {
        // 1. Buscar todos os funcionários existentes para criar um mapa de email -> funcionário
        const employeesRef = collection(firestore, "employees");
        const querySnapshot = await getDocs(employeesRef);
        const employeeMap = new Map<string, Employee>();
        querySnapshot.forEach(doc => {
            const employee = { id: doc.id, ...doc.data() } as Employee;
            if (employee.email) {
                employeeMap.set(employee.email.toLowerCase(), employee);
            }
        });

        const importPromises = data
            .filter(row => {
                if (!row.id3a || !row.name || !row.email) {
                    console.warn("Linha ignorada por falta de dados obrigatórios (id3a, name, email):", row);
                    return false;
                }
                return true;
            })
            .map(row => {
            const docId = row.id3a;
            // Validação extra redundante, mas segura
            if (!docId) return Promise.resolve();

            const docRef = doc(firestore, "employees", docId);
            
            const leaderEmail = row.leaderEmail?.toLowerCase();
            const leader = leaderEmail ? employeeMap.get(leaderEmail) : undefined;
            
            const employeeData = {
                ...row,
                leaderId: leader?.id || "",
                leader: leader?.name || "",
            };

            return setDocumentNonBlocking(docRef, employeeData, { merge: true });
        });
        
        await Promise.all(importPromises);

      toast({
        title: "Importação Concluída",
        description: `${data.length} registros foram processados com sucesso.`,
      });
    } catch (e) {
      console.error("Erro durante a importação:", e);
      toast({
        variant: "destructive",
        title: "Erro na Importação",
        description: "Ocorreu um erro ao salvar os dados. Verifique o console para mais detalhes.",
      });
    } finally {
      handleClose();
    }
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload de Funcionários via CSV</DialogTitle>
          <DialogDescription>
            Selecione ou arraste um arquivo CSV para importar os dados dos funcionários. O CSV deve conter as colunas: {EXPECTED_COLUMNS.join(', ')}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="text-center">
                    <FileCheck2 className="mx-auto h-12 w-12 text-green-500" />
                    <p className="mt-2 font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{data.length} registros encontrados</p>
                </div>
              ) : (
                <div className="text-center">
                    <FileUp className="mx-auto h-12 w-12 text-muted-foreground" />
                    {isDragActive ? (
                        <p className="mt-2 text-primary">Solte o arquivo aqui...</p>
                    ) : (
                        <p className="mt-2">
                        Arraste e solte o arquivo CSV aqui, ou{" "}
                        <span className="font-semibold text-primary">clique para selecionar</span>.
                        </p>
                    )}
                </div>
              )}
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{error}</p>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>Cancelar</Button>
          <Button onClick={handleImport} disabled={data.length === 0 || !!error || isImporting}>
            {isImporting ? "Importando..." : `Importar ${data.length > 0 ? `${data.length} registros` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
