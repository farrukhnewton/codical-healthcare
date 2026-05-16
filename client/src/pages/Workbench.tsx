import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Activity,
  Calendar,
  ChevronRight,
  ClipboardList,
  Clock,
  Filter,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type Encounter = {
  id: number;
  mrn?: string | null;
  patientName: string;
  date: string;
  type?: string | null;
  status: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getStatusTone(status: string) {
  if (status === "coded" || status === "finalized") return "success";
  if (status === "pending") return "warning";
  return "info";
}

function formatStatus(status: string) {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Workbench() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id || null);
    });
  }, []);

  const { data: encounters = [], isLoading, error, refetch } = useQuery<Encounter[]>({
    queryKey: ["/api/workbench/encounters", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch("/api/workbench/encounters", {
        headers: { "x-supabase-uid": userId! },
      });
      if (!res.ok) throw new Error("Failed to fetch encounters.");
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/emr/drchrono/auth-url");
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.message || "Could not start EMR sync.");
      window.location.href = data.url;
    },
    onError: (syncError: Error) => {
      toast({ title: "Sync failed", description: syncError.message, variant: "destructive" });
    },
  });

  const filteredEncounters = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return encounters;

    return encounters.filter((encounter) =>
      encounter.patientName.toLowerCase().includes(normalized) ||
      encounter.mrn?.toLowerCase().includes(normalized) ||
      encounter.type?.toLowerCase().includes(normalized),
    );
  }, [encounters, searchTerm]);

  const pendingCount = encounters.filter((encounter) => encounter.status === "pending").length;
  const finalizedCount = encounters.filter((encounter) => encounter.status === "coded" || encounter.status === "finalized").length;
  const queueHealth = pendingCount > finalizedCount ? "Review" : "Good";

  const openEncounter = (encounterId: number) => {
    setLocation(`/workspace?encounter=${encounterId}`);
  };

  return (
    <div className="tool-page assistant-workspace-page workbench-page">
      <section className="tool-panel tool-page-header workbench-hero">
        <div>
          <h1>Workbench</h1>
          <p>Manage assigned patient encounters and coding workload.</p>
        </div>
        <div className="workbench-hero-actions">
          <button type="button" onClick={() => refetch()} className="tool-secondary-button">
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button type="button" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="tool-primary-button">
            {syncMutation.isPending ? <span className="tool-spinner" /> : <Plus size={16} />}
            Sync EMR
          </button>
        </div>
      </section>

      <section className="workbench-metric-grid" aria-label="Workbench metrics">
        <div className="tool-panel workbench-metric-card" data-tone="info">
          <span><Users size={17} /> Total Assigned</span>
          <strong>{encounters.length}</strong>
          <small>All encounters</small>
        </div>
        <div className="tool-panel workbench-metric-card" data-tone="warning">
          <span><Clock size={17} /> Pending Code</span>
          <strong>{pendingCount}</strong>
          <small>Awaiting review</small>
        </div>
        <div className="tool-panel workbench-metric-card" data-tone="success">
          <span><ShieldCheck size={17} /> Finalized</span>
          <strong>{finalizedCount}</strong>
          <small>Ready for submission</small>
        </div>
        <div className="tool-panel workbench-metric-card" data-tone="neutral">
          <span><Activity size={17} /> Queue Health</span>
          <strong>{queueHealth}</strong>
          <small>Updated live</small>
        </div>
      </section>

      {error ? (
        <div className="tool-callout" data-tone="danger">
          <ClipboardList size={17} />
          <span>{error instanceof Error ? error.message : "Could not load workbench encounters."}</span>
        </div>
      ) : null}

      <section className="tool-panel workbench-queue-panel">
        <div className="workbench-queue-head">
          <div>
            <h2>
              <ClipboardList size={18} />
              Assignment Queue
            </h2>
            <p>View and open assigned encounters for coding review.</p>
          </div>
          <div className="workbench-queue-tools">
            <label className="tool-search-field">
              <Search size={17} />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by patient, MRN, or type"
              />
            </label>
            <button type="button" className="tool-icon-action" aria-label="Filter encounters">
              <Filter size={17} />
            </button>
          </div>
        </div>

        <div className="workbench-table-wrap">
          <table className="workbench-table">
            <thead>
              <tr>
                <th>MRN</th>
                <th>Patient</th>
                <th>Service Date</th>
                <th>Type</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || !userId ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td><span className="workbench-skeleton short" /></td>
                    <td><span className="workbench-skeleton" /></td>
                    <td><span className="workbench-skeleton short" /></td>
                    <td><span className="workbench-skeleton short" /></td>
                    <td><span className="workbench-skeleton tiny" /></td>
                    <td><span className="workbench-skeleton action" /></td>
                  </tr>
                ))
              ) : filteredEncounters.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="tool-empty-state compact">
                      <ClipboardList size={30} />
                      <strong>No active assignments found</strong>
                      <span>Sync EMR data or adjust the search filter.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEncounters.map((encounter) => (
                  <tr key={encounter.id}>
                    <td className="workbench-mrn">{encounter.mrn || "N/A"}</td>
                    <td>
                      <div className="workbench-patient">
                        <span>{getInitials(encounter.patientName)}</span>
                        <div>
                          <strong>{encounter.patientName}</strong>
                          <small>Encounter #{encounter.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="workbench-date">
                        <Calendar size={14} />
                        {formatDate(encounter.date)}
                      </span>
                    </td>
                    <td>{encounter.type || "Generic"}</td>
                    <td>
                      <span className="workbench-status-pill" data-tone={getStatusTone(encounter.status)}>
                        {formatStatus(encounter.status)}
                      </span>
                    </td>
                    <td>
                      <button type="button" onClick={() => openEncounter(encounter.id)} className="workbench-open-button">
                        Open Chart
                        <ChevronRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="workbench-mobile-list">
          {isLoading || !userId ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="workbench-mobile-card is-loading">
                <span className="workbench-skeleton" />
                <span className="workbench-skeleton short" />
              </div>
            ))
          ) : filteredEncounters.length === 0 ? (
            <div className="tool-empty-state compact">
              <ClipboardList size={30} />
              <strong>No active assignments found</strong>
              <span>Sync EMR data or adjust the search filter.</span>
            </div>
          ) : (
            filteredEncounters.map((encounter) => (
              <button type="button" key={encounter.id} className="workbench-mobile-card" onClick={() => openEncounter(encounter.id)}>
                <div>
                  <span className="workbench-avatar">{getInitials(encounter.patientName)}</span>
                  <div>
                    <strong>{encounter.patientName}</strong>
                    <small>MRN {encounter.mrn || "N/A"}</small>
                  </div>
                  <span className="workbench-status-pill" data-tone={getStatusTone(encounter.status)}>
                    {formatStatus(encounter.status)}
                  </span>
                </div>
                <div>
                  <span><Calendar size={13} /> {formatDate(encounter.date)}</span>
                  <span><Activity size={13} /> {encounter.type || "Generic"}</span>
                  <strong>Open <ChevronRight size={13} /></strong>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <div className="tool-callout compact" data-tone="success">
        <ShieldCheck size={15} />
        HIPAA audit logging remains enabled across workbench actions.
      </div>
    </div>
  );
}
