
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { differenceInMonths, getMonth, getYear, parseISO, startOfYear, endOfYear, isWithinInterval } from "date-fns";

const db = admin.firestore();


// --- Interfaces ---
interface Employee {
    id: string;
    leaderId?: string;
    segment?: string;
    isUnderManagement?: boolean;
}

interface Interaction {
    id: string;
    date: string; // ISO String
    type: string;
}

interface PDIAction {
    id: string;
    startDate: string; // ISO String
}


// --- Schedules ---
const n3IndividualSchedule = {
    "Alfa": 4, // 4 per month
    "Beta": 2, // 2 per month
    "Senior": 1, // 1 per month
};

const interactionSchedules: { [key in "1:1" | "PDI" | "Índice de Risco"]?: number[] } = {
    "PDI": [0, 6], // Jan, Jul
    "1:1": [2, 5, 8, 11], // Mar, Jun, Sep, Dec
    "Índice de Risco": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Monthly
};


// --- Helper Functions ---

/**
 * Calculates the number of required interactions for a given period.
 * @param {Date} startDate The start of the date range.
 * @param {Date} endDate The end of the date range.
 * @param {number[]} schedule Array of months (0-11) when interaction is required.
 * @return {number} The total count of required interactions in the range.
 */
function getRequiredCountForSchedule(startDate: Date, endDate: Date, schedule: number[]): number {
    const fromMonth = getMonth(startDate);
    const fromYear = getYear(startDate);
    const toMonth = getMonth(endDate);
    const toYear = getYear(endDate);
    let requiredCount = 0;

    for (let y = fromYear; y <= toYear; y++) {
        const startMonth = (y === fromYear) ? fromMonth : 0;
        const endMonth = (y === toYear) ? toMonth : 11;
        requiredCount += schedule.filter((month) => month >= startMonth && month <= endMonth).length;
    }
    return requiredCount;
}


// --- Main Logic ---

/**
 * Recalculates and updates the adherence ranking for a leader.
 * @param {string} employeeId - The ID of the employee whose interaction triggered the update.
 */
export async function updateLeaderRanking(employeeId: string) {
    // 1. Identify the Leader
    const employeeSnap = await db.collection("employees").doc(employeeId).get();
    const employee = employeeSnap.data() as Employee | undefined;
    const leaderId = employee?.leaderId;

    if (!leaderId) {
        functions.logger.log(`Employee ${employeeId} has no leader. No ranking update needed.`);
        return;
    }
    
    // 2. Fetch Leader and Team
    const leaderSnap = await db.collection("employees").doc(leaderId).get();
    if (!leaderSnap.exists) {
        functions.logger.warn(`Leader ${leaderId} not found.`);
        return;
    }

    const teamQuery = db.collection("employees").where("leaderId", "==", leaderId).where("isUnderManagement", "==", true);
    const teamSnaps = await teamQuery.get();
    const teamMembers = teamSnaps.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Employee));

    if (teamMembers.length === 0) {
        functions.logger.log(`Leader ${leaderId} has no managed team members. Setting score to 0.`);
        const leaderRankRef = db.collection("leaderRankings").doc(leaderId);
        await leaderRankRef.set({
            leaderId: leaderId,
            leaderName: leaderSnap.data()?.name || "",
            leaderPhotoURL: leaderSnap.data()?.photoURL || "",
            adherenceScore: 0,
            completedCount: 0,
            totalCount: 0,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return;
    }

    // 3. Calculate Adherence for the current year
    const now = new Date();
    const range = { start: startOfYear(now), end: endOfYear(now) };
    const monthsInYear = differenceInMonths(range.end, range.start) + 1;

    let totalCompleted = 0;
    let totalRequired = 0;

    for (const member of teamMembers) {
        const interactionsRef = db.collection("employees").doc(member.id).collection("interactions");
        const pdiActionsRef = db.collection("employees").doc(member.id).collection("pdiActions");

        const [interactionsSnap, pdiActionsSnap] = await Promise.all([
            interactionsRef.get(),
            pdiActionsRef.get(),
        ]);

        const memberInteractions = interactionsSnap.docs.map((doc) => doc.data() as Interaction);
        const memberPdiActions = pdiActionsSnap.docs.map((doc) => doc.data() as PDIAction);
        
        // N3 Individual - Cap at the adherence limit for ranking calculation
        const n3Segment = member.segment as keyof typeof n3IndividualSchedule | undefined;
        if (n3Segment && n3IndividualSchedule[n3Segment]) {
            const adherenceLimitPerMonth = n3IndividualSchedule[n3Segment];
            const requiredN3 = adherenceLimitPerMonth * monthsInYear;
            const completedN3 = memberInteractions.filter((i) => i.type === "N3 Individual" && isWithinInterval(parseISO(i.date), range)).length;
            totalRequired += requiredN3;
            totalCompleted += Math.min(completedN3, requiredN3); // Cap at the required amount for adherence
        }

        // 1:1 and Índice de Risco
        (["1:1", "Índice de Risco"] as const).forEach((type) => {
            const schedule = interactionSchedules[type];
            if (schedule) {
                const requiredCount = getRequiredCountForSchedule(range.start, range.end, schedule);
                totalRequired += requiredCount;

                const executedMonths = new Set<number>();
                memberInteractions.forEach((i) => {
                    const intDate = parseISO(i.date);
                    if (i.type === type && isWithinInterval(intDate, range) && schedule.includes(getMonth(intDate))) {
                        executedMonths.add(getMonth(intDate));
                    }
                });
                totalCompleted += executedMonths.size;
            }
        });

        // PDI
        const pdiSchedule = interactionSchedules["PDI"];
        if (pdiSchedule) {
            const requiredPdiCount = getRequiredCountForSchedule(range.start, range.end, pdiSchedule);
            totalRequired += requiredPdiCount;

            const executedPdiMonths = new Set<number>();
            memberPdiActions.forEach((action) => {
                const actionDate = parseISO(action.startDate);
                if (isWithinInterval(actionDate, range) && pdiSchedule.includes(getMonth(actionDate))) {
                    executedPdiMonths.add(getMonth(actionDate));
                }
            });
            totalCompleted += executedPdiMonths.size;
        }
    }
    
    // 4. Update Firestore
    const adherenceScore = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;
    
    const leaderRankRef = db.collection("leaderRankings").doc(leaderId);
    
    const dataToSave = {
        leaderId: leaderId,
        leaderName: leaderSnap.data()?.name || "",
        leaderPhotoURL: leaderSnap.data()?.photoURL || "",
        adherenceScore: adherenceScore,
        completedCount: Math.round(totalCompleted),
        totalCount: Math.round(totalRequired),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    await leaderRankRef.set(dataToSave, { merge: true });

    functions.logger.log(`Ranking updated for leader ${leaderId}: ${adherenceScore.toFixed(2)}%`);
}
