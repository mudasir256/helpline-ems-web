import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { isObjectId } from "@/lib/object-id";
import { formatDateTime } from "@/lib/datetime";
import { csvResponse, parseExportRange, toCsv } from "@/lib/csv";

const HEADER = [
  "Date",
  "Submitted at",
  "Added late",
  "Employee code",
  "Name",
  "Designation",
  "Project",
  "Summary",
  "Details",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = parseExportRange(searchParams);
  if ("error" in range) return jsonError(range.error!);
  const { from, to } = range;
  const projectId = searchParams.get("projectId") || undefined;
  const employeeId = searchParams.get("employeeId") || undefined;
  if ((projectId && !isObjectId(projectId)) || (employeeId && !isObjectId(employeeId))) {
    return jsonError("Invalid filter");
  }

  const reports = await prisma.dailyReport.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(projectId ? { projectId } : {}),
      ...(employeeId ? { employeeId } : {}),
    },
    include: {
      employee: { select: { employeeCode: true, name: true, designation: true } },
      project: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const rows = reports
    // Same rule as the reports list: a report whose project was removed is left out.
    .filter((r) => r.project)
    .map((r) => [
      r.date,
      formatDateTime(r.createdAt),
      r.submittedLate ? "Yes" : "No",
      r.employee.employeeCode,
      r.employee.name,
      r.employee.designation,
      r.project?.name ?? "",
      r.summary,
      r.details,
    ]);

  return csvResponse(`helpline-reports_${from}_to_${to}.csv`, toCsv(HEADER, rows));
}
