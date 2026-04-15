import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { 
  Plus, 
  RefreshCcw, 
  ClipboardList, 
  ChevronRight, 
  Search, 
  Filter,
  Activity,
  User,
  Calendar,
  Clock,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

export function Workbench() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEncounterId, setSelectedEncounterId] = useState<number | null>(null);

  // Fetch Supabase session to get UID for API headers
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id || null);
    });
  }, []);

  const { data: encounters, isLoading, refetch } = useQuery({
    queryKey: ["/api/workbench/encounters"],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch("/api/workbench/encounters", {
        headers: { "x-supabase-uid": userId! }
      });
      if (!res.ok) throw new Error("Failed to fetch encounters");
      return res.json();
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/emr/drchrono/auth-url");
      const data = await res.json();
      window.location.href = data.url;
    }
  });

  const filteredEncounters = encounters?.filter((e: any) => 
    e.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.mrn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 drop-shadow-sm flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            Coder Workbench
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your assigned patient encounters and clinical documentation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="gap-2 bg-white/50 backdrop-blur-sm border-blue-100 hover:border-blue-200"
            onClick={() => refetch()}
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button 
            className="gap-2 shadow-lg shadow-primary/20"
            onClick={() => syncMutation.mutate()}
          >
            <Plus className="h-4 w-4" />
            Sync EMR (DrChrono)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-emerald-900">Total Assigned</p>
              <Activity className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-950 mt-1">{encounters?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 border-amber-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-amber-900">Pending Code</p>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-950 mt-1">
              {encounters?.filter((e: any) => e.status === 'pending').length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-900">Coded / Finalized</p>
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-950 mt-1">
              {encounters?.filter((e: any) => e.status === 'coded').length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-6 text-center flex flex-col items-center justify-center">
             <div className="flex gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-2 h-4 rounded-sm bg-primary/20" />
                ))}
             </div>
             <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Productivity Level</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg">Assignment Queue</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-72">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder="Search MRN or Patient..." 
                  className="pl-9 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
            <TableHeader className="bg-slate-100/50">
              <TableRow>
                <TableHead className="w-[100px]">MRN</TableHead>
                <TableHead>Patient Name</TableHead>
                <TableHead>Service Date</TableHead>
                <TableHead>Encounter Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-12 bg-slate-100 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-slate-100 rounded animate-pulse" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-8 bg-slate-100 rounded ml-auto animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : filteredEncounters?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="bg-slate-100 p-4 rounded-full">
                         <ClipboardList className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 font-medium">No active assignments found.</p>
                      <p className="text-slate-400 text-sm">Sync with DrChrono to fetch new patient data.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEncounters?.map((e: any) => (
                  <TableRow key={e.id} className="hover:bg-slate-50/80 group">
                    <TableCell className="font-mono text-xs">{e.mrn || 'N/A'}</TableCell>
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                            {e.patientName.charAt(0)}
                         </div>
                         {e.patientName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(e.date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-normal">
                        {e.type || 'Generic'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={
                          e.status === 'pending' 
                            ? "bg-amber-50 text-amber-700 border-amber-200" 
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }
                      >
                        {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="group-hover:bg-white group-hover:shadow-sm" onClick={() => window.location.href = `/workspace?encounter=${e.id}`}>
                        Open Chart
                        <ChevronRight className="h-4 w-4 ml-1 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="flex flex-col md:hidden divide-y divide-slate-100">
            {isLoading ? (
               [...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 h-32 bg-slate-50 animate-pulse" />
               ))
            ) : filteredEncounters?.length === 0 ? (
               <div className="p-12 text-center text-slate-400">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No assignments found.</p>
               </div>
            ) : (
              filteredEncounters?.map((e: any) => (
                <div key={e.id} className="p-4 flex flex-col gap-3 active:bg-slate-50 transition-colors" onClick={() => window.location.href = `/workspace?encounter=${e.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {e.patientName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{e.patientName}</p>
                        <p className="text-[10px] text-slate-500 font-mono tracking-tighter">MRN: {e.mrn || 'N/A'}</p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={e.status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}
                    >
                      {e.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(e.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {e.type || 'Generic'}
                      </div>
                    </div>
                    <div className="flex items-center text-primary font-bold gap-0.5">
                      Open <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-auto pt-8 border-t flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             EMR Gateway: Online
           </div>
           <div className="flex items-center gap-1.5">
             <ShieldCheck className="h-3.5 w-3.5" />
             HIPAA Audit Enabled
           </div>
        </div>
        <p>© 2026 Codical Health - Practice Intelligence</p>
      </div>
    </div>
  );
}
