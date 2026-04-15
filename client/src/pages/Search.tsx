import { useState, useEffect } from "react";
import { Stethoscope, Filter, Search as SearchIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useDebounce } from "use-debounce";
import { motion, AnimatePresence } from "framer-motion";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchCodes } from "@/hooks/use-codes";
import { CodeCard } from "@/components/codes/CodeCard";
import { CodeDetails } from "@/components/codes/CodeDetails";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MedicalCode } from "shared/schema";

const CODE_TYPES = ["All", "ICD-10-CM", "CPT", "HCPCS"];

export function Search() {
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState(() => {
    const q = sessionStorage.getItem("codicalhealth_sq") || "";
    sessionStorage.removeItem("codicalhealth_sq");
    return q;
  });
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const [selectedType, setSelectedType] = useState(() => {
    const t = sessionStorage.getItem("codicalhealth_type") || "All";
    sessionStorage.removeItem("codicalhealth_type");
    return t;
  });
  const [selectedCode, setSelectedCode] = useState<MedicalCode | null>(null);

  useEffect(() => {
    const q = sessionStorage.getItem("codicalhealth_sq") || "";
    const t = sessionStorage.getItem("codicalhealth_type") || "";
    if (q) { sessionStorage.removeItem("codicalhealth_sq"); setSearchTerm(q); }
    if (t) { sessionStorage.removeItem("codicalhealth_type"); setSelectedType(t); }
  }, [location]);

  const { data: codes, isLoading, isError, refetch } = useSearchCodes(debouncedSearch, selectedType);

  useEffect(() => {
    if (codes && codes.length > 0 && !selectedCode) {
      setSelectedCode(codes[0] as any);
    }
  }, [codes, selectedCode]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 lg:p-8 h-full">
      <div className="w-full lg:w-[480px] flex-shrink-0 space-y-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
            <Input
              type="text"
              placeholder="Search codes, descriptions, keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 text-base rounded-xl border-2 border-emerald-200/60 bg-white/60 backdrop-blur-sm focus:border-emerald-400 focus:ring-emerald-200/50 shadow-none"
            />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Tabs value={selectedType} onValueChange={setSelectedType} className="w-full">
            <TabsList className="w-full grid grid-cols-4 bg-emerald-50/50 p-1 rounded-xl border border-emerald-200/40">
              {CODE_TYPES.map((type) => (
                <TabsTrigger key={type} value={type} className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm transition-all py-2.5">
                  {type}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {!isLoading && codes && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {codes.length} {codes.length === 1 ? 'result' : 'results'} found
          </motion.p>
        )}

        <ScrollArea className="h-[calc(100vh-280px)] lg:h-[calc(100vh-320px)] -mx-2 px-2">
          <div className="space-y-3 pb-8">
            {isLoading ? (
              <LoadingState message="Scanning database..." variant="dots" />
            ) : isError ? (
              <ErrorState title="Search Failed" message="Could not retrieve codes. Please try again." onRetry={() => refetch()} />
            ) : codes?.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-emerald-200/60 p-8 text-center" style={{ background: "rgba(255,255,255,0.4)" }}>
                <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-bold text-gray-700">No matches found</p>
                <p className="text-sm text-gray-500 mt-1">Try broadening your search terms</p>
                {searchTerm && (
                  <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => { setSearchTerm(""); setSelectedType("All"); }}>Clear Search</Button>
                )}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {codes?.map((code, i) => (
                  <motion.div key={code.type + "-" + code.code + "-" + i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.03 }}>
                    <CodeCard 
                      isFavorite={false} 
                      onToggleFavorite={() => {}} 
                      code={code as any} 
                      isSelected={selectedCode?.code === code.code && selectedCode?.type === code.type} 
                      onClick={() => {
                        setSelectedCode(code as any);
                        // On mobile, navigate to details for better focus
                        if (window.innerWidth < 1024) {
                          setLocation(`/intel/${code.code}`);
                        }
                      }} 
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 min-w-0">
        {selectedCode ? (
          <motion.div key={selectedCode.code} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            <CodeDetails codeItem={selectedCode as any} />
          </motion.div>
        ) : (
          <div className="h-full min-h-[400px] rounded-2xl border-2 border-dashed border-emerald-200/60 flex flex-col items-center justify-center p-8 text-center" style={{ background: "rgba(255,255,255,0.4)" }}>
            <Stethoscope className="w-16 h-16 text-emerald-200 mb-4" />
            <p className="font-bold text-gray-700 text-lg">Select a code</p>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">Click on any code from the search results to view detailed information</p>
          </div>
        )}
      </div>
    </div>
  );
}
