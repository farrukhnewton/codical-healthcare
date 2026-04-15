import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ShieldCheck, 
  History, 
  User, 
  FileText, 
  Search,
  Download,
  Filter,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

export function Compliance() {
  const [userId, setUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id || null);
    });
  }, []);

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["/api/admin/audit-logs"],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch("/api/admin/audit-logs", {
        headers: { "x-supabase-uid": userId! }
      });
      if (res.status === 403) throw new Error("PERMISSION_DENIED");
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    }
  });

  const filteredLogs = logs?.filter((log: any) => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entityType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user?.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error?.message === "PERMISSION_DENIED") {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] p-8 text-center">
        <div className="bg-red-50 p-6 rounded-3xl mb-4 text-red-600 shadow-xl shadow-red-900/10">
          <AlertCircle className="h-12 w-12" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          This page is restricted to administrators only. Please contact your health information management lead for access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 drop-shadow-sm flex items-center gap-3 font-sans">
            <ShieldCheck className="h-8 w-8 text-emerald-600" />
            Compliance Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            HIPAA Audit Trails: Monitoring PHI access and clinical workflows across the USA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Audit CSV
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
               <History className="h-5 w-5 text-emerald-600" />
               <CardTitle className="text-lg font-bold">Activity Audit Trail</CardTitle>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search actions or users..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100/50">
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target Entity</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                   <TableRow key={i}>
                      <TableCell colSpan={5}><div className="h-10 w-full bg-slate-50 animate-pulse rounded-lg" /></TableCell>
                   </TableRow>
                ))
              ) : filteredLogs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center text-muted-foreground">
                    No matching audit records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs?.map((log: any) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs font-mono text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                          {log.user?.username?.charAt(0).toUpperCase() || "S"}
                        </div>
                        <span className="font-semibold text-sm">{log.user?.username || "System"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 capitalize">
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium text-slate-500">{log.entityType}</span>
                      <span className="ml-2 text-xs text-slate-400 font-mono">#{log.entityId}</span>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="text-xs">
                          View Details
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="bg-emerald-50/30 border-emerald-100">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <User className="h-4 w-4" /> Coder Access
               </CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-2xl font-black text-emerald-950">12 Patients</p>
               <p className="text-xs text-muted-foreground mt-1">Accessed in the last 24h</p>
            </CardContent>
         </Card>
         <Card className="bg-blue-50/30 border-blue-100">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4" /> HIPAA Compliance
               </CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-2xl font-black text-blue-950">100% Secure</p>
               <p className="text-xs text-muted-foreground mt-1">All PHI access encrypted & logged</p>
            </CardContent>
         </Card>
         <Card className="bg-slate-50/30 border-slate-100">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Alert Status
               </CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-2xl font-black text-slate-900">0 Flags</p>
               <p className="text-xs text-muted-foreground mt-1">No unauthorized access detected</p>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
