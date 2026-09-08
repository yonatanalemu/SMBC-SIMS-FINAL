import prisma from "../config/prisma.js";
import { getInvoiceDefaults } from "../routes/settings.routes.js";

// Monthly tuition cycle: once a student's Tuition Fee invoice is marked paid,
// tuitionPaidUntil is set to the end of that month. Nothing runs on a schedule
// to expire that — instead, this is called at the top of every route that
// reads student/tuition data (Finance, Admin, AND the student's own dashboard),
// so whoever looks first — staff or the student themselves — triggers the
// reset for everyone whose paid-through date has already passed.
export async function resetExpiredTuition() {
  const expired = await prisma.student.findMany({
    where: { tuitionStatus: "paid", tuitionPaidUntil: { lt: new Date() } },
    select: { id: true },
  });
  if (expired.length === 0) return;

  const expiredIds = expired.map((s) => s.id);
  // Always re-apply the CURRENT tuition rate when a student becomes due
  // again — a settings change only touches invoices that happen to already
  // be unpaid at that exact moment (see settings.routes.js), so anyone who
  // was "paid" then and only becomes unpaid later (right here) would
  // otherwise keep showing a stale, outdated amount forever.
  const { tuitionFeeAmount } = await getInvoiceDefaults();

  await prisma.$transaction([
    prisma.student.updateMany({
      where: { id: { in: expiredIds } },
      data: { tuitionStatus: "unpaid", tuitionPaidUntil: null },
    }),
    prisma.invoice.updateMany({
      where: { studentId: { in: expiredIds }, title: "Tuition Fee" },
      data: { status: "unpaid", amount: tuitionFeeAmount },
    }),
  ]);
}