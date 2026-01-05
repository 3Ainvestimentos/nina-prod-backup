// functions/src/update-ranking.ts
import { db, FieldValue } from "./admin-app";

export const updateLeaderRanking = async (employeeId: string) => {
  const employeeDoc = await db.collection("employees").doc(employeeId).get();
  if (!employeeDoc.exists) return;

  const data = employeeDoc.data();
  const leaderId = data?.leaderId;
  if (!leaderId) return;

  await db.collection("leaderRankings").doc(leaderId).set({
    lastUpdate: FieldValue.serverTimestamp(),
    totalInteractions: FieldValue.increment(1),
  }, { merge: true });
};
