"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Dropdown } from "@/components/dropdown";
import { ExportPanel } from "@/components/export-panel";
import { TableSkeleton } from "@/components/skeleton";
import { EmptyState, PageHeader, StatusBadge, TypeBadge } from "@/components/ui";
import { formatDate, formatTime, todayPK } from "@/lib/datetime";
import { telHref } from "@/lib/phone";
import { useNotifications } from "@/components/notifications";

type Report = {
  id: string;
  date: string;
  summary: string;
  details: string;
  submittedLate?: boolean | null;
  createdAt: string;
  employee: { id: string; name: string; employeeCode: string; designation: string; phone: string | null };
  project: { id: string; name: string; type: string; code: string };
};

type Project = { id: string; name: string };
type Employee = { id: string; name: string };

export default function ReportsPage() {
  const today = todayPK();
  const { unreadCount } = useNotifications();
  const [reports, setReports] = useState<Report[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(today);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<{ projects: Project[] }>("/api/admin/projects").then((d) => setProjects(d.projects));
    api<{ employees: Employee[] }>("/api/admin/employees").then((d) => setEmployees(d.employees));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (projectId) params.set("projectId", projectId);
    if (employeeId) params.set("employeeId", employeeId);
    if (date) params.set("date", date);
    function load() {
      api<{ reports: Report[] }>(`/api/admin/reports?${params}`)
        .then((d) => setReports(d.reports))
        .finally(() => setReady(true));
    }
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [q, projectId, employeeId, date, unreadCount]);

  const showingToday = date === today;

  return (
    <div>
      <PageHeader
        eyebrow="Field updates"
        title={showingToday ? "Today’s reports" : "Daily reports"}
        description={
          showingToday
            ? "Reports submitted from the staff app today, in Pakistan time. New submissions appear here automatically."
            : "Every task report submitted from the employee app appears here, with the project and checkout time attached."
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <input className="input" placeholder="Search report or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <Dropdown
          value={projectId}
          onChange={setProjectId}
          options={[{ value: "", label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <Dropdown
          value={employeeId}
          onChange={setEmployeeId}
          options={[{ value: "", label: "All employees" }, ...employees.map((person) => ({ value: person.id, label: person.name }))]}
        />
        <div className="flex gap-2">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {date !== today ? (
            <button className="btn btn-ghost shrink-0" onClick={() => setDate(today)} type="button">
              Today
            </button>
          ) : null}
        </div>
      </div>

      <ExportPanel kinds={["reports"]} filters={{ projectId, employeeId }} />

      <div className="card">
        {!ready ? (
          <TableSkeleton rows={5} bare />
        ) : reports.length === 0 ? (
          <EmptyState
            title={showingToday ? "No reports today yet" : "No reports found"}
            hint="When staff submit a daily report from the app, it will show here with the full summary and details."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Employee</th>
                  <th>Project</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="whitespace-nowrap">
                      <div className="font-semibold">{formatTime(report.createdAt)}</div>
                      <div className="text-xs text-muted">{formatDate(report.date)}</div>
                      {report.submittedLate ? (
                        <div className="mt-1">
                          <StatusBadge status="LATE" />
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <Link className="font-semibold hover:text-leaf" href={`/employees/${report.employee.id}`}>
                        {report.employee.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {report.employee.designation}
                        {report.employee.phone && telHref(report.employee.phone) ? (
                          <>
                            {" · "}
                            <a className="hover:text-leaf" href={telHref(report.employee.phone)}>
                              {report.employee.phone}
                            </a>
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="mb-1">
                        <TypeBadge type={report.project.type} />
                      </div>
                      {report.project.name}
                    </td>
                    <td className="max-w-lg">
                      <Link className="font-semibold hover:text-leaf" href={`/reports/${report.id}`}>
                        {report.summary}
                      </Link>
                      <p className="mt-1 line-clamp-3 text-sm text-muted">{report.details}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
