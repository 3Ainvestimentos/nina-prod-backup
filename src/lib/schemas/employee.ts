import * as z from "zod";

export const employeeFormSchema = z.object({
  id3a: z.string().min(1, "O ID externo é obrigatório."),
  name: z.string().min(1, "O nome é obrigatório."),
  email: z.string().email("O email é inválido."),
  position: z.string().optional(),
  axis: z.string().optional(),
  area: z.string().optional(),
  segment: z.string().optional(),
  leaderId: z.string().optional(),
  city: z.string().optional(),
  role: z.string().optional(),
  photoURL: z.string().url().optional().or(z.literal("")),
});

/** @deprecated Use employeeFormSchema. Alias para compatibilidade. */
export const formSchema = employeeFormSchema;

export type EmployeeFormData = z.infer<typeof employeeFormSchema>;
