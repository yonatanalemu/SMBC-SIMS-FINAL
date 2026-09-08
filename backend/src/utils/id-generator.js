// ID format rules from spec:
//   Student:    STU-0001, STU-0002 ... expands 4 -> 5 digits when full
//   Teacher:    TCR-001, TCR-002 ...   expands 3 -> 4 digits when full
//   Dept Head:  DHD-001, DHD-002 ...   assumed same pattern as Teacher (not
//               explicitly stated in spec — confirm if this should differ)
//   Interim student registration: N-STU-0001 (the "N-" is stripped, same
//   number preserved, once Finance + Registrar approve the student)
//
// Admin/Registrar/Finance usernames are NOT generated here — those are set
// directly by the school per the spec ("permanent users... will be set by me").

const PREFIX_CONFIG = {
  student: { prefix: "STU", minDigits: 4 },
  teacher: { prefix: "TCR", minDigits: 3 },
  dept_head: { prefix: "DHD", minDigits: 3 },
};

function extractSequence(username, prefix) {
  const match = username.match(new RegExp(`(?:N-)?${prefix}-(\\d+)$`));
  return match ? parseInt(match[1], 10) : null;
}

async function nextSequenceNumber(prisma, prefix) {
  const candidates = await prisma.user.findMany({
    where: { username: { contains: prefix } },
    select: { username: true },
  });

  let max = 0;
  for (const { username } of candidates) {
    const n = extractSequence(username, prefix);
    if (n && n > max) max = n;
  }
  return max + 1;
}

function formatId(prefix, seq, minDigits) {
  const digits = Math.max(minDigits, String(seq).length);
  return `${prefix}-${String(seq).padStart(digits, "0")}`;
}

// role: "student" | "teacher" | "dept_head". interim only applies to student.
export async function generateUsername(prisma, role, { interim = false } = {}) {
  const config = PREFIX_CONFIG[role];
  if (!config) throw new Error(`No ID format configured for role: ${role}`);

  const seq = await nextSequenceNumber(prisma, config.prefix);
  const id = formatId(config.prefix, seq, config.minDigits);
  return interim ? `N-${id}` : id;
}

// Strips the interim "N-" prefix once Finance + Registrar approve a student,
// keeping the same sequence number (STU-0001 stays STU-0001, not renumbered).
export function stripInterimPrefix(username) {
  return username.startsWith("N-") ? username.slice(2) : username;
}
