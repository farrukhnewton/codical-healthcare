import { useQuery } from "@tanstack/react-query";
import { 
  Building2, 
  ExternalLink, 
  Phone, 
  Search, 
  ShieldAlert,
  BookOpen,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { motion } from "framer-motion";

export function PayerIntelligence() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: payers, isLoading } = useQuery({
    queryKey: ["/api/payers"],
    queryFn: async () => {
      const res = await fetch("/api/payers");
      if (!res.ok) throw new Error("Failed to fetch payers");
      return res.json();
    }
  });

  const filteredPayers = payers?.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.shortName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 drop-shadow-sm flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            Commercial Payer Intelligence
          </h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            National Medical Policy & Prior Authorization Directory (USA)
          </p>
        </div>

        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search Aetna, UHC, BCBS..." 
            className="pl-10 h-11 bg-white shadow-sm border-blue-100 focus-visible:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="h-48 animate-pulse bg-slate-50 border-slate-100" />
          ))
        ) : filteredPayers?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No payers found matching your search.
          </div>
        ) : (
          filteredPayers.map((payer: any) => (
            <motion.div
              key={payer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="group hover:shadow-xl hover:shadow-blue-900/5 transition-all border-slate-200 h-full flex flex-col overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    {payer.logoUrl ? (
                      <img src={payer.logoUrl} alt="" className="w-12 h-12 grayscale" />
                    ) : (
                      <Building2 className="w-12 h-12" />
                    )}
                  </div>
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">{payer.name}</CardTitle>
                      <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                        {payer.shortName || "Major Carrier"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                       <Phone className="h-3.5 w-3.5 text-slate-400" />
                       <span className="font-mono">{payer.phone || "No direct line"}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 pt-1">
                       <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none px-2 py-0">
                          Medical Policies
                       </Badge>
                       <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none px-2 py-0">
                          Prior Auth
                       </Badge>
                       <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-none px-2 py-0">
                          Appeals
                       </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-[10px] lg:text-xs font-bold gap-1 p-2 h-9"
                      onClick={() => window.open(payer.policyPortalUrl, '_blank')}
                    >
                      <BookOpen className="h-3 w-3" />
                       Policy Portal
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-[10px] lg:text-xs font-bold gap-1 p-2 h-9"
                      onClick={() => window.open(payer.paPortalUrl, '_blank')}
                    >
                      <Search className="h-3 w-3" />
                       PA Lookup
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Commercial Intelligence Alerts */}
      <div className="mt-4">
         <Card className="bg-amber-50/50 border-amber-100 shadow-none">
            <CardContent className="pt-6 flex items-start gap-4">
               <ShieldAlert className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
               <div>
                  <h4 className="font-bold text-amber-900">Commercial Intelligence Warning</h4>
                  <p className="text-sm text-amber-800 mt-1 max-w-3xl">
                     Unlike Medicare (CMS), commercial payers often have unique medical policies for experimental procedures, therapy limits, and specific rendering provider requirements. Always verify the **Effective Date** of the medical policy bulletin before finalizing a claim.
                  </p>
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
