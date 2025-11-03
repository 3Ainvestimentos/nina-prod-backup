
"use client";

import { useState, useMemo, useEffect } from "react";
import type { Employee } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Skeleton } from "./ui/skeleton";
import { X, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

interface RiskAnalysisSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allEmployees: Employee[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading: boolean;
}

export function RiskAnalysisSelectionDialog({
  open,
  onOpenChange,
  allEmployees,
  selectedIds,
  onSelectionChange,
  isLoading,
}: RiskAnalysisSelectionDialogProps) {
    const initialFilters = {
        name: new Set<string>(),
        area: new Set<string>(),
        position: new Set<string>(),
        leader: new Set<string>(),
    };
    const [filters, setFilters] = useState(initialFilters);
    const [localSelectedIds, setLocalSelectedIds] = useState(selectedIds);

  useEffect(() => {
    setLocalSelectedIds(selectedIds);
  }, [selectedIds, open]);
  
  const { uniqueNames, uniqueAreas, uniquePositions, uniqueLeaders } = useMemo(() => {
    if (!allEmployees) return { uniqueNames: [], uniqueAreas: [], uniquePositions: [], uniqueLeaders: [] };
    const names = [...new Set(allEmployees.map(e => e.name).filter(Boolean))].sort();
    const areas = [...new Set(allEmployees.map(e => e.area).filter(Boolean))].sort();
    const positions = [...new Set(allEmployees.map(e => e.position).filter(Boolean))].sort();
    const leaders = [...new Set(allEmployees.map(e => e.leader).filter(Boolean))].sort();
    return { uniqueNames: names, uniqueAreas: areas, uniquePositions: positions, uniqueLeaders: leaders };
  }, [allEmployees]);


  const filteredEmployees = useMemo(() => {
    if (!allEmployees) return [];
    return allEmployees.filter(employee => {
        return (
            (filters.name.size === 0 || (employee.name && filters.name.has(employee.name))) &&
            (filters.area.size === 0 || (employee.area && filters.area.has(employee.area))) &&
            (filters.position.size === 0 || (employee.position && filters.position.has(employee.position))) &&
            (filters.leader.size === 0 || (employee.leader && filters.leader.has(employee.leader)))
        );
    }).sort((a,b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [allEmployees, filters]);

  const handleSelect = (id: string) => {
    setLocalSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (localSelectedIds.length === filteredEmployees.length) {
      setLocalSelectedIds([]);
    } else {
      setLocalSelectedIds(filteredEmployees.map(e => e.id));
    }
  };

  const handleConfirm = () => {
    onSelectionChange(localSelectedIds);
    onOpenChange(false);
  };
  
    const handleMultiSelectFilterChange = (filterName: keyof typeof filters, value: string) => {
        setFilters(prev => {
        const newSet = new Set(prev[filterName] as Set<string>);
        if (newSet.has(value)) {
            newSet.delete(value);
        } else {
            newSet.add(value);
        }
        return { ...prev, [filterName]: newSet };
        });
    };

    const isFilterActive = Object.values(filters).some(s => s.size > 0);

    const clearFilters = () => setFilters(initialFilters);

    const FilterComponent = ({ title, filterKey, options }: { title: string, filterKey: keyof typeof filters, options: string[]}) => (
        <div className="flex items-center gap-1">
          <span>{title}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Filter className={`h-4 w-4 ${(filters[filterKey] as Set<string>).size > 0 ? 'text-primary' : ''}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
                {options.map((option) => (
                    <DropdownMenuCheckboxItem
                    key={option}
                    checked={(filters[filterKey] as Set<string>).has(option)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => handleMultiSelectFilterChange(filterKey, option)}
                    >
                    {option}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Colaboradores para Análise</DialogTitle>
           <div className="flex justify-between items-center">
             <DialogDescription>
                Use os filtros no cabeçalho da tabela para encontrar e selecionar os colaboradores.
             </DialogDescription>
             {isFilterActive && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-primary">
                    <X className="mr-2 h-4 w-4" />
                    Limpar filtros
                </Button>
            )}
           </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-secondary">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={filteredEmployees.length > 0 && localSelectedIds.length === filteredEmployees.length && localSelectedIds.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead><FilterComponent title="Nome" filterKey="name" options={uniqueNames} /></TableHead>
                  <TableHead><FilterComponent title="Área" filterKey="area" options={uniqueAreas} /></TableHead>
                  <TableHead><FilterComponent title="Cargo" filterKey="position" options={uniquePositions} /></TableHead>
                  <TableHead><FilterComponent title="Líder" filterKey="leader" options={uniqueLeaders} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredEmployees.map(employee => (
                  <TableRow key={employee.id} data-state={localSelectedIds.includes(employee.id) && "selected"}>
                    <TableCell>
                      <Checkbox
                        checked={localSelectedIds.includes(employee.id)}
                        onCheckedChange={() => handleSelect(employee.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.area || "N/A"}</TableCell>
                    <TableCell>{employee.position || "N/A"}</TableCell>
                    <TableCell>{employee.leader || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!isLoading && filteredEmployees.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                    Nenhum colaborador encontrado para os filtros selecionados.
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar ({localSelectedIds.length} selecionado(s))
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
