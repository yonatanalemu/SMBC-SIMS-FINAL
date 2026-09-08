import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/rbac.js";

const router = Router();

const DEFAULTS = { registrationFeeAmount: "500", tuitionFeeAmount: "1000" };

async function getSetting(key) {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? row.value : DEFAULTS[key];
}

// Readable by any authenticated role that needs it (Registrar, at registration time)
router.get("/", authenticate, async (req, res) => {
  const registrationFeeAmount = await getSetting("registrationFeeAmount");
  const tuitionFeeAmount = await getSetting("tuitionFeeAmount");
  res.json({
    registrationFeeAmount: Number(registrationFeeAmount),
    tuitionFeeAmount: Number(tuitionFeeAmount),
  });
});

router.patch("/", authenticate, requireRole("admin"), async (req, res) => {
  const { registrationFeeAmount, tuitionFeeAmount } = req.body;
  const updates = [];
  if (registrationFeeAmount !== undefined) {
    updates.push(
      prisma.setting.upsert({
        where: { key: "registrationFeeAmount" },
        update: { value: String(registrationFeeAmount) },
        create: { key: "registrationFeeAmount", value: String(registrationFeeAmount) },
      })
    );
  }
  let tuitionUpdatedCount = 0;
  if (tuitionFeeAmount !== undefined) {
    updates.push(
      prisma.setting.upsert({
        where: { key: "tuitionFeeAmount" },
        update: { value: String(tuitionFeeAmount) },
        create: { key: "tuitionFeeAmount", value: String(tuitionFeeAmount) },
      })
    );
  }
  await Promise.all(updates);

  // Tuition (unlike Registration Fee) is an ongoing amount every student
  // owes, not a one-time per-registration charge — so a rate change should
  // apply school-wide, not just to future registrations. Only unpaid
  // invoices are touched, so amounts already paid under the old rate aren't
  // rewritten after the fact.
  if (tuitionFeeAmount !== undefined) {
    const result = await prisma.invoice.updateMany({
      where: { title: "Tuition Fee", status: "unpaid" },
      data: { amount: Number(tuitionFeeAmount) },
    });
    tuitionUpdatedCount = result.count;
  }

  res.json({ message: "Settings updated", tuitionUpdatedCount });
});

export async function getInvoiceDefaults() {
  return {
    registrationFeeAmount: Number(await getSetting("registrationFeeAmount")),
    tuitionFeeAmount: Number(await getSetting("tuitionFeeAmount")),
  };
}

export default router;
