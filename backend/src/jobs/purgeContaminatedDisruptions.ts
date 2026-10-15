import { TRANSIENT_SEVERITY_DESCRIPTIONS } from '../clients/tfl/parser.js';
import { prisma } from '../db.js';

export interface PurgeDisruptionsResult {
  purgedCount: number;
}

// Purges contaminated transient delay records (e.g. real-time Minor Delays, Severe Delays)
// that leaked into the WeekendDisruption database table.
export async function purgeContaminatedDisruptions(db = prisma): Promise<PurgeDisruptionsResult> {
  const result = await db.weekendDisruption.deleteMany({
    where: {
      statusSeverityDescription: {
        in: Array.from(TRANSIENT_SEVERITY_DESCRIPTIONS),
      },
    },
  });

  return { purgedCount: result.count };
}

// When invoked directly via CLI (tsx or node)
if (
  process.argv[1] &&
  (process.argv[1].endsWith('purgeContaminatedDisruptions.ts') ||
    process.argv[1].endsWith('purgeContaminatedDisruptions.js'))
) {
  purgeContaminatedDisruptions()
    .then(({ purgedCount }) => {
      console.log(
        `[Purge Job] Successfully purged ${purgedCount} contaminated records from WeekendDisruption.`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Purge Job] Failed to purge contaminated records:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
