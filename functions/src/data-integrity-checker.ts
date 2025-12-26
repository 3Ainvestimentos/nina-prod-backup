// functions/src/data-integrity-checker.ts
import * as functions from "firebase-functions";
import { admin } from "./admin-app";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

export interface IntegrityIssue {
  type: "broken_reference" | "orphaned_data" | "invalid_data";
  severity: "high" | "medium" | "low";
  collection: string;
  documentId: string;
  documentName?: string;
  field?: string;
  referencedId?: string;
  issue: string;
  fixable: boolean;
  suggestedFix?: string;
}

export interface IntegrityReport {
  timestamp: Date;
  totalIssues: number;
  issues: IntegrityIssue[];
  summary: {
    brokenReferences: number;
    orphanedData: number;
    invalidData: number;
  };
  fixableCount: number;
  orphanedDataDetails: {
    interactions: Array<{
      interactionId: string;
      employeeId: string;
      employeeName: string;
      type: string;
      date: string;
      authorId: string;
    }>;
    pdiActions: Array<{
      pdiActionId: string;
      employeeId: string;
      employeeName: string;
      description: string;
      status: string;
    }>;
    projectInteractions: Array<{
      interactionId: string;
      projectId: string;
      projectName: string;
      type: string;
      date: string;
    }>;
  };
}

/**
 * Verifica integridade de dados no Firestore
 */
export const checkDataIntegrity = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.isAdmin !== true) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Apenas admins podem verificar integridade de dados"
      );
    }

    functions.logger.log("[IntegrityChecker] Iniciando verificação de integridade");

    const issues: IntegrityIssue[] = [];
    const orphanedInteractions: IntegrityReport["orphanedDataDetails"]["interactions"] = [];
    const orphanedPdiActions: IntegrityReport["orphanedDataDetails"]["pdiActions"] = [];
    const orphanedProjectInteractions: IntegrityReport["orphanedDataDetails"]["projectInteractions"] = [];

    try {
      const db = admin.firestore();

      // 1. Buscar todos os employees
      const employeesSnapshot = await db.collection("employees").get();
      const employeesMap = new Map<string, any>();
      employeesSnapshot.docs.forEach((doc) => {
        employeesMap.set(doc.id, { id: doc.id, ...doc.data() });
      });

      // 2. Buscar todos os projects
      const projectsSnapshot = await db.collection("projects").get();
      const projectsMap = new Map<string, any>();
      projectsSnapshot.docs.forEach((doc) => {
        projectsMap.set(doc.id, { id: doc.id, ...doc.data() });
      });

      // 3. Verificar referências quebradas em employees
      functions.logger.log("[IntegrityChecker] Verificando referências em employees");
      for (const employee of employeesMap.values()) {
        // Verificar leaderId
        if (employee.leaderId && !employeesMap.has(employee.leaderId)) {
          issues.push({
            type: "broken_reference",
            severity: "high",
            collection: "employees",
            documentId: employee.id,
            documentName: employee.name || "Sem nome",
            field: "leaderId",
            referencedId: employee.leaderId,
            issue: `Employee "${employee.name || employee.id}" referencia leaderId "${employee.leaderId}" que não existe`,
            fixable: true,
            suggestedFix: "Remover referência leaderId",
          });
        }
      }

      // 4. Verificar referências quebradas em projects
      functions.logger.log("[IntegrityChecker] Verificando referências em projects");
      for (const project of projectsMap.values()) {
        // Verificar leaderId
        if (project.leaderId && !employeesMap.has(project.leaderId)) {
          issues.push({
            type: "broken_reference",
            severity: "high",
            collection: "projects",
            documentId: project.id,
            documentName: project.name || "Sem nome",
            field: "leaderId",
            referencedId: project.leaderId,
            issue: `Project "${project.name || project.id}" referencia leaderId "${project.leaderId}" que não existe`,
            fixable: true,
            suggestedFix: "Remover referência leaderId ou atualizar para um employee válido",
          });
        }

        // Verificar memberIds
        if (project.memberIds && Array.isArray(project.memberIds)) {
          for (const memberId of project.memberIds) {
            if (!employeesMap.has(memberId)) {
              issues.push({
                type: "broken_reference",
                severity: "medium",
                collection: "projects",
                documentId: project.id,
                documentName: project.name || "Sem nome",
                field: "memberIds",
                referencedId: memberId,
                issue: `Project "${project.name || project.id}" referencia memberId "${memberId}" que não existe`,
                fixable: true,
                suggestedFix: "Remover memberId da lista",
              });
            }
          }
        }
      }

      // 5. Verificar dados órfãos: interações de employees deletados
      functions.logger.log("[IntegrityChecker] Verificando interações órfãs");
      const deletedEmployeeIds = new Set<string>();
      for (const employee of employeesMap.values()) {
        if (employee._isDeleted === true) {
          deletedEmployeeIds.add(employee.id);
        }
      }

      for (const employeeId of deletedEmployeeIds) {
        const employee = employeesMap.get(employeeId);
        const employeeName = employee?.name || employeeId;

        // Buscar interações do employee deletado
        const interactionsSnapshot = await db
          .collection("employees")
          .doc(employeeId)
          .collection("interactions")
          .get();

        for (const interactionDoc of interactionsSnapshot.docs) {
          const interaction = interactionDoc.data();
          orphanedInteractions.push({
            interactionId: interactionDoc.id,
            employeeId,
            employeeName,
            type: interaction.type || "Desconhecido",
            date: interaction.date || "Sem data",
            authorId: interaction.authorId || "Desconhecido",
          });
        }

        // Buscar PDI actions do employee deletado
        const pdiActionsSnapshot = await db
          .collection("employees")
          .doc(employeeId)
          .collection("pdiActions")
          .get();

        for (const pdiDoc of pdiActionsSnapshot.docs) {
          const pdi = pdiDoc.data();
          orphanedPdiActions.push({
            pdiActionId: pdiDoc.id,
            employeeId,
            employeeName,
            description: pdi.description || "Sem descrição",
            status: pdi.status || "Desconhecido",
          });
        }
      }

      // 6. Verificar project interactions de projects arquivados/deletados
      functions.logger.log("[IntegrityChecker] Verificando project interactions órfãs");
      for (const project of projectsMap.values()) {
        if (project.isArchived === true) {
          const projectInteractionsSnapshot = await db
            .collection("projects")
            .doc(project.id)
            .collection("interactions")
            .get();

          for (const interactionDoc of projectInteractionsSnapshot.docs) {
            const interaction = interactionDoc.data();
            orphanedProjectInteractions.push({
              interactionId: interactionDoc.id,
              projectId: project.id,
              projectName: project.name || "Sem nome",
              type: interaction.type || "Desconhecido",
              date: interaction.date || "Sem data",
            });
          }
        }
      }

      // 7. Verificar referências quebradas em interactions (authorId)
      functions.logger.log("[IntegrityChecker] Verificando authorId em interactions");
      for (const employee of employeesMap.values()) {
        if (employee._isDeleted) continue; // Pular employees deletados

        const interactionsSnapshot = await db
          .collection("employees")
          .doc(employee.id)
          .collection("interactions")
          .get();

        for (const interactionDoc of interactionsSnapshot.docs) {
          const interaction = interactionDoc.data();
          if (interaction.authorId && !employeesMap.has(interaction.authorId)) {
            issues.push({
              type: "broken_reference",
              severity: "medium",
              collection: "interactions",
              documentId: interactionDoc.id,
              field: "authorId",
              referencedId: interaction.authorId,
              issue: `Interaction "${interactionDoc.id}" do employee "${employee.name || employee.id}" referencia authorId "${interaction.authorId}" que não existe`,
              fixable: true,
              suggestedFix: "Atualizar authorId para um employee válido ou remover",
            });
          }
        }
      }

      // 8. Verificar referências quebradas em project interactions
      functions.logger.log("[IntegrityChecker] Verificando project interactions");
      for (const project of projectsMap.values()) {
        const projectInteractionsSnapshot = await db
          .collection("projects")
          .doc(project.id)
          .collection("interactions")
          .get();

        for (const interactionDoc of projectInteractionsSnapshot.docs) {
          const interaction = interactionDoc.data();
          if (interaction.authorId && !employeesMap.has(interaction.authorId)) {
            issues.push({
              type: "broken_reference",
              severity: "medium",
              collection: "projectInteractions",
              documentId: interactionDoc.id,
              field: "authorId",
              referencedId: interaction.authorId,
              issue: `Project interaction "${interactionDoc.id}" do project "${project.name || project.id}" referencia authorId "${interaction.authorId}" que não existe`,
              fixable: true,
              suggestedFix: "Atualizar authorId para um employee válido ou remover",
            });
          }

          if (interaction.targetMemberId && !employeesMap.has(interaction.targetMemberId)) {
            issues.push({
              type: "broken_reference",
              severity: "medium",
              collection: "projectInteractions",
              documentId: interactionDoc.id,
              field: "targetMemberId",
              referencedId: interaction.targetMemberId,
              issue: `Project interaction "${interactionDoc.id}" referencia targetMemberId "${interaction.targetMemberId}" que não existe`,
              fixable: true,
              suggestedFix: "Remover targetMemberId",
            });
          }
        }
      }

      // Contar issues por tipo
      const brokenReferences = issues.filter((i) => i.type === "broken_reference").length;
      const orphanedData =
        orphanedInteractions.length + orphanedPdiActions.length + orphanedProjectInteractions.length;
      const invalidData = issues.filter((i) => i.type === "invalid_data").length;
      const fixableCount = issues.filter((i) => i.fixable).length;

      const report: IntegrityReport = {
        timestamp: new Date(),
        totalIssues: issues.length + orphanedData,
        issues,
        summary: {
          brokenReferences,
          orphanedData,
          invalidData,
        },
        fixableCount,
        orphanedDataDetails: {
          interactions: orphanedInteractions,
          pdiActions: orphanedPdiActions,
          projectInteractions: orphanedProjectInteractions,
        },
      };

      functions.logger.log(
        `[IntegrityChecker] Verificação concluída: ${report.totalIssues} problemas encontrados`
      );

      return {
        success: true,
        report,
      };
    } catch (error: any) {
      functions.logger.error("[IntegrityChecker] Erro ao verificar integridade:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Erro ao verificar integridade: ${error.message}`
      );
    }
  });

