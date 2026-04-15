import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, Search, DollarSign, Activity, Building, FileText, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

interface RvuData {
  code: string;
  description: string;
  year: number;
  conversionFactor: number;
  workRvu: number;
  nonFacilityPeRvu: number;
  facilityPeRvu: number;
  malpracticeRvu: number;
  totalNonFacilityRvu: number;
  totalFacilityRvu: number;
  nonFacilityPayment: number;
  facilityPayment: number;
  globalPeriod: string;
  procStatus: string;
}

export function RvuCalculator() {
  const [cptInput, setCptInput] = useState(() => { const c = sessionStorage.getItem("rvu_code") || ""; sessionStorage.removeItem("rvu_code"); return c; });
  const [activeCode, setActiveCode] = useState(() => sessionStorage.getItem("rvu_code_active") || "");
  const [units, setUnits] = useState(1);
  const [setting, setSetting] = useState<"non-facility" | "facility">("non-facility");

  const { data: rvuData, isLoading, isError } = useQuery({
    queryKey: ["/api/rvu", activeCode],
    queryFn: async () => {
      const res = await fetch(`/api/rvu/${activeCode}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch RVU data");
      return res.json() as Promise<RvuData>;
    },
    enabled: !!activeCode
  });

  useEffect(() => {
    const c = sessionStorage.getItem("rvu_code") || "";
    if (c) { sessionStorage.removeItem("rvu_code"); setCptInput(c); setActiveCode(c); }
  }, []);

  const handleSearch = () => {
    if (cptInput.trim()) {
      setActiveCode(cptInput.trim().toUpperCase());
    }
  };

  const totalRvu = rvuData
    ? setting === "non-facility"
      ? rvuData.totalNonFacilityRvu * units
      : rvuData.totalFacilityRvu * units
    : 0;

  const totalPayment = rvuData
    ? setting === "non-facility"
      ? rvuData.nonFacilityPayment * units
      : rvuData.facilityPayment * units
    : 0;

  const getGlobalPeriodLabel = (gp: string) => {
    const map: Record<string, string> = {
      "000": "0 days", "010": "10 days", "090": "90 days",
      "MMM": "Maternity", "XXX": "N/A", "YYY": "By report", "ZZZ": "Add-on"
    };
    return map[gp] || gp;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">RVU Calculator</h1>
            <p className="text-muted-foreground font-medium">CY 2026 Medicare Physician Fee Schedule</p>
          </div>
          <Badge className="ml-auto bg-green-100 text-green-700 border-green-200 font-black">
            CF: $33.4009
          </Badge>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Enter CPT code (e.g. 99213, 45378, 00100)..."
                  className="pl-12 h-14 text-lg font-mono font-bold border-2 rounded-2xl"
                  value={cptInput}
                  onChange={(e) => setCptInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="h-14 px-8 rounded-2xl text-base font-bold"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : "Calculate"}
              </Button>
            </div>

            {rvuData && (
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground">Units:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUnits(Math.max(1, units - 1))}
                      className="w-8 h-8 rounded-lg border-2 border-border font-bold hover:border-primary transition-colors"
                    >-</button>
                    <span className="w-8 text-center font-black text-lg">{units}</span>
                    <button
                      onClick={() => setUnits(units + 1)}
                      className="w-8 h-8 rounded-lg border-2 border-border font-bold hover:border-primary transition-colors"
                    >+</button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground">Setting:</span>
                  {(["non-facility", "facility"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSetting(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all capitalize ${
                        setting === s
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {s === "non-facility" ? "Office/Clinic" : "Hospital/Facility"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {isError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-red-500 font-bold">
            CPT code not found in 2026 Fee Schedule
          </motion.div>
        )}

        {rvuData && (
          <motion.div
            key={rvuData.code}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Code Header */}
            <div className="flex items-start gap-4 p-6 bg-primary/5 rounded-2xl border-2 border-primary/20">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-4xl font-black font-mono text-primary">{rvuData.code}</span>
                  <Badge variant="outline" className="font-bold">
                    {rvuData.procStatus === "A" ? "Active" : rvuData.procStatus}
                  </Badge>
                  <Badge variant="secondary" className="font-bold">
                    Global: {getGlobalPeriodLabel(rvuData.globalPeriod)}
                  </Badge>
                </div>
                <p className="text-lg font-bold text-foreground">{rvuData.description}</p>
                <p className="text-sm text-muted-foreground">CY {rvuData.year} Medicare Physician Fee Schedule</p>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="grid grid-cols-2 gap-6">
              <Card className={`border-2 ${setting === "non-facility" ? "border-primary shadow-lg shadow-primary/10" : "border-border"}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Building className="w-5 h-5 text-primary" />
                    <h3 className="font-black text-sm uppercase tracking-wider">Office/Non-Facility</h3>
                    {setting === "non-facility" && <Badge className="ml-auto text-xs">Selected</Badge>}
                  </div>
                  <p className="text-4xl font-black text-primary">
                    ${(rvuData.nonFacilityPayment * units).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {rvuData.totalNonFacilityRvu.toFixed(2)} RVU × {units} × ${rvuData.conversionFactor}
                  </p>
                </CardContent>
              </Card>

              <Card className={`border-2 ${setting === "facility" ? "border-secondary shadow-lg shadow-secondary/10" : "border-border"}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-secondary" />
                    <h3 className="font-black text-sm uppercase tracking-wider">Hospital/Facility</h3>
                    {setting === "facility" && <Badge variant="secondary" className="ml-auto text-xs">Selected</Badge>}
                  </div>
                  <p className="text-4xl font-black text-secondary">
                    ${(rvuData.facilityPayment * units).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {rvuData.totalFacilityRvu.toFixed(2)} RVU × {units} × ${rvuData.conversionFactor}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* RVU Breakdown */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  RVU Component Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "Work RVU", value: rvuData.workRvu, color: "bg-blue-500", desc: "Physician work effort" },
                    { label: "PE RVU (Non-Facility)", value: rvuData.nonFacilityPeRvu, color: "bg-green-500", desc: "Practice expense - office" },
                    { label: "PE RVU (Facility)", value: rvuData.facilityPeRvu, color: "bg-teal-500", desc: "Practice expense - hospital" },
                    { label: "Malpractice RVU", value: rvuData.malpracticeRvu, color: "bg-orange-500", desc: "Professional liability" },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold">{item.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{item.desc}</span>
                        </div>
                        <span className="font-black text-lg">{item.value.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, (item.value / (rvuData.workRvu + rvuData.nonFacilityPeRvu + rvuData.malpracticeRvu)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Total Non-Facility RVU</p>
                    <p className="text-2xl font-black text-foreground">{(rvuData.totalNonFacilityRvu * units).toFixed(2)}</p>
                    {units > 1 && <p className="text-xs text-muted-foreground">{rvuData.totalNonFacilityRvu.toFixed(2)} × {units} units</p>}
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Total Facility RVU</p>
                    <p className="text-2xl font-black text-foreground">{(rvuData.totalFacilityRvu * units).toFixed(2)}</p>
                    {units > 1 && <p className="text-xs text-muted-foreground">{rvuData.totalFacilityRvu.toFixed(2)} × {units} units</p>}
                  </div>
                </div>

                <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
                  <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Payment = Total RVU × Conversion Factor (${rvuData.conversionFactor}). Geographic adjustments (GPCI) not applied. Actual Medicare payment may vary by locality.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
