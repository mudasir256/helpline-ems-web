"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Dropdown } from "@/components/dropdown";
import { ExportPanel } from "@/components/export-panel";
import { TableSkeleton } from "@/components/skeleton";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { durationBetween, formatTime, todayPK } from "@/lib/datetime";
import { telHref } from "@/lib/phone";

type Row = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  autoCheckedOut?: boolean | null;
  employee: { id: string; name: string; designation: string; employeeCode: string; phone: string | null };
  project: { id: string; name: string } | null;
};

type Payload = {
  date: string;
  records: Row[];
  absent: Array<{ id: string; name: string; designation: string; employeeCode: string; phone: string | null }>;
  summary: { present: number; checkedOut: number; onDuty: number; absent: number };
};

type Project = { id: string; name: string };

export default function AttendancePage() {
  const [date, setDate] = useState(todayPK());
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    api<{ projects: Project[] }>("/api/admin/projects").then((d) => setProjects(d.projects));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ date });
    if (projectId) params.set("projectId", projectId);
    api<Payload>(`/api/admin/attendance?${params}`).then(setData);
  }, [date, projectId]);

  return (
    <div>
      <PageHeader
        eyebrow="Time"
        title="Attendance"
        description="Check-in when the employee opens the app, check-out when they submit the daily report. Times are Pakistan time."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Dropdown
          className="sm:col-span-2"
          value={projectId}
          onChange={setProjectId}
          options={[{ value: "", label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
        />
      </div>

      <ExportPanel kinds={["attendance", "reports"]} filters={{ projectId }} />

      {data ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            {[
              ["Present", data.summary.present],
              ["On duty", data.summary.onDuty],
              ["Checked out", data.summary.checkedOut],
              ["Absent", data.summary.absent],
            ].map(([label, value]) => (
              <div key={label} className="card card-hover px-5 py-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="card mb-6">
            <h2 className="border-b border-line px-5 py-4 font-semibold">Checked in</h2>
            {data.records.length === 0 ? (
              <EmptyState title="No check-ins for this date" />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Project</th>
                      <th>Check-in</th>
                      <th>Check-out</th>
                      <th>Hours</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link className="font-semibold hover:text-leaf" href={`/employees/${row.employee.id}`}>
                            {row.employee.name}
                          </Link>
                          <div className="text-xs text-muted">
                            {row.employee.employeeCode} · {row.employee.designation}
                            {row.employee.phone ? (
                              <>
                                {" · "}
                                <a className="hover:text-leaf" href={telHref(row.employee.phone)} onClick={(e) => e.stopPropagation()}>
                                  {row.employee.phone}
                                </a>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td>{row.project?.name || "—"}</td>
                        <td>{formatTime(row.checkInAt)}</td>
                        <td>{row.checkOutAt ? formatTime(row.checkOutAt) : "—"}</td>
                        <td>{row.checkOutAt ? durationBetween(row.checkInAt, row.checkOutAt) : "—"}</td>
                        <td>
                          <StatusBadge status={row.checkOutAt ? (row.autoCheckedOut ? "AUTO_CHECKED_OUT" : "CHECKED_OUT") : "ON_DUTY"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="border-b border-line px-5 py-4 font-semibold">Not checked in</h2>
            {data.absent.length === 0 ? (
              <EmptyState title="Everyone active has checked in" />
            ) : (
              <div className="divide-y divide-line">
                {data.absent.map((emp) => (
                  <Link key={emp.id} href={`/employees/${emp.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-canvas">
                    <div>
                      <p className="font-semibold">{emp.name}</p>
                      <p className="text-xs text-muted">
                        {emp.employeeCode} · {emp.designation}
                        {emp.phone ? ` · ${emp.phone}` : ""}
                      </p>
                    </div>
                    <StatusBadge status="ABSENT" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <TableSkeleton rows={5} />
      )}
    </div>
  );
}
