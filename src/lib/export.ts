
import { collection, getDocs, Firestore } from "firebase/firestore";
import type { Employee, Interaction, PDIAction } from "./types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

async function fetchEmployeeHistory(firestore: Firestore, employeeId: string) {
  const interactionsRef = collection(firestore, `employees/${employeeId}/interactions`);
  const pdiActionsRef = collection(firestore, `employees/${employeeId}/pdiActions`);

  const [interactionsSnapshot, pdiActionsSnapshot] = await Promise.all([
    getDocs(interactionsRef),
    getDocs(pdiActionsRef),
  ]);

  const interactions = interactionsSnapshot.docs.map(doc => doc.data() as Interaction);
  const pdiActions = pdiActionsSnapshot.docs.map(doc => doc.data() as PDIAction);

  return { interactions, pdiActions };
}

function convertToCSV(data: any[]) {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(",")];
    
    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + row[header]).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(","));
    }
    
    return csvRows.join("\n");
}

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function generateCSV(firestore: Firestore, selectedEmployeeIds: string[], allEmployees: Employee[]) {
    const allData = [];
    
    for (const employeeId of selectedEmployeeIds) {
        const employee = allEmployees.find(e => e.id === employeeId);
        if (!employee) continue;

        const { interactions, pdiActions } = await fetchEmployeeHistory(firestore, employeeId);

        if (interactions.length === 0 && pdiActions.length === 0) {
            allData.push({
                employee_id: employee.id,
                employee_name: employee.name,
                employee_email: employee.email,
                item_type: 'no_history',
            });
            continue;
        }

        for (const item of interactions) {
            allData.push({
                employee_id: employee.id,
                employee_name: employee.name,
                employee_email: employee.email,
                item_type: 'Interaction',
                item_id: item.id,
                item_date: item.date,
                item_subtype: item.type,
                item_details: item.notes,
                item_status: '',
                item_risk_score: item.riskScore,
            });
        }

        for (const item of pdiActions) {
            allData.push({
                employee_id: employee.id,
                employee_name: employee.name,
                employee_email: employee.email,
                item_type: 'PDI Action',
                item_id: item.id,
                item_date: item.startDate,
                item_subtype: '',
                item_details: item.description,
                item_status: item.status,
                item_risk_score: '',
            });
        }
    }
    
    const csvContent = convertToCSV(allData);
    downloadFile(csvContent, 'historico_colaboradores.csv', 'text/csv;charset=utf-8;');
}

async function generatePDF(firestore: Firestore, selectedEmployeeIds: string[], allEmployees: Employee[]) {
  const doc = new jsPDF();
  let isFirstPage = true;

  for (const employeeId of selectedEmployeeIds) {
    const employee = allEmployees.find(e => e.id === employeeId);
    if (!employee) continue;

    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    doc.setFontSize(16);
    doc.text(`Histórico de: ${employee.name}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Email: ${employee.email}`, 14, 26);
    doc.text(`Cargo: ${employee.position}`, 14, 32);

    const { interactions, pdiActions } = await fetchEmployeeHistory(firestore, employeeId);
    
    interactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    pdiActions.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());


    if (interactions.length > 0) {
      autoTable(doc, {
        head: [['Data', 'Tipo', 'Anotações', 'Risco']],
        body: interactions.map(i => [
            new Date(i.date).toLocaleDateString('pt-BR'), 
            i.type, 
            typeof i.notes === 'string' ? i.notes : JSON.stringify(i.notes),
            i.riskScore ?? 'N/A'
        ]),
        startY: 40,
        headStyles: { fillColor: [22, 163, 74] },
        didDrawPage: (data) => {
           doc.setFontSize(12);
           doc.text("Interações", 14, data.cursor ? data.cursor.y - 10 : 38);
        }
      });
    } else {
        doc.setFontSize(12);
        doc.text("Interações", 14, 40);
        doc.setFontSize(10);
        doc.text("Nenhuma interação registrada.", 14, 46);
    }
    
    const lastTableY = (doc as any).lastAutoTable.finalY || (interactions.length === 0 ? 50 : 40);

    if (pdiActions.length > 0) {
      autoTable(doc, {
        head: [['Início', 'Prazo', 'Ação', 'Status']],
        body: pdiActions.map(p => [
            new Date(p.startDate).toLocaleDateString('pt-BR'),
            new Date(p.endDate).toLocaleDateString('pt-BR'),
            p.description,
            p.status
        ]),
        startY: lastTableY + 15,
        headStyles: { fillColor: [22, 163, 74] },
         didDrawPage: (data) => {
           doc.setFontSize(12);
           doc.text("Plano de Desenvolvimento Individual (PDI)", 14, data.cursor ? data.cursor.y - 10 : lastTableY + 13);
        }
      });
    } else {
        doc.setFontSize(12);
        doc.text("Plano de Desenvolvimento Individual (PDI)", 14, lastTableY + 15);
        doc.setFontSize(10);
        doc.text("Nenhuma ação de PDI registrada.", 14, lastTableY + 21);
    }
  }

  doc.save('historico_colaboradores.pdf');
}

export async function exportData(
  firestore: Firestore,
  selectedEmployeeIds: string[],
  format: "csv" | "pdf",
  allEmployees: Employee[]
) {
  if (format === "csv") {
    await generateCSV(firestore, selectedEmployeeIds, allEmployees);
  } else if (format === "pdf") {
    await generatePDF(firestore, selectedEmployeeIds, allEmployees);
  }
}
