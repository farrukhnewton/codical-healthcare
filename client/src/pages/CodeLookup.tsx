import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Tag, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";

type LookupType = "pos" | "modifiers";

const CATEGORIES = ["All", "General", "Surgery", "E/M", "Anesthesia", "Laboratory", "Anatomical", "Telehealth", "HCPCS"];

export function CodeLookup() {
  const [lookupType, setLookupType] = useState<LookupType>("pos");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selected, setSelected] = useState<any>(null);

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as any)._lookupTimeout);
    (window as any)._lookupTimeout = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data: posData } = useQuery({
    queryKey: ["/api/pos", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/pos?search=${debouncedSearch}`, { credentials: "include" });
      return res.json();
    },
    enabled: lookupType === "pos"
  });

  const { data: modifierData } = useQuery({
    queryKey: ["/api/modifiers", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/modifiers?search=${debouncedSearch}`, { credentials: "include" });
      return res.json();
    },
    enabled: lookupType === "modifiers"
  });

  const rawList = lookupType === "pos" ? (posData || []) : (modifierData || []);
  const list = selectedCategory === "All"
    ? rawList
    : rawList.filter((item: any) => item.category === selectedCategory);

  return (
    <div className="flex gap-6 p-8 h-full">
      {/* Left Panel */}
      <div className="w-[420px] flex-shrink-0 space-y-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Tag className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black">Code Lookup</CardTitle>
                  <p className="text-xs text-muted-foreground font-medium">POS and Modifier Reference</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type Toggle */}
              <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
                {[
                  { key: "pos", label: "Place of Service", icon: MapPin },
                  { key: "modifiers", label: "Modifiers", icon: Tag }
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setLookupType(t.key as LookupType); setSelected(null); setSearch(""); setDebouncedSearch(""); setSelectedCategory("All"); }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      lookupType === t.key ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={lookupType === "pos" ? "Search POS code or name..." : "Search modifier code or name..."}
                  className="pl-10 h-11 border-2"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

              {/* Category Filter (Modifiers only) */}
              {lookupType === "modifiers" && (
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                        selectedCategory === cat
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground font-medium">
                {list.length} {lookupType === "pos" ? "place of service codes" : "modifiers"} found
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results List */}
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-26rem)]">
          {list.map((item: any) => (
            <motion.div
              key={item.code}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelected(item)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selected?.code === item.code
                  ? "border-primary bg-primary/5"
                  : "border-border bg-white hover:border-primary/30 hover:shadow-md"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm ${
                  selected?.code === item.code ? "bg-primary text-white" : "bg-primary/10 text-primary"
                }`}>
                  {item.code}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">{item.name}</p>
                  {item.category && (
                    <Badge variant="outline" className="text-xs mt-1">{item.category}</Badge>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.code}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="border-2">
                <CardContent className="p-8">
                  <div className="flex items-start gap-6 mb-8">
                    <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl font-black text-primary">{selected.code}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Badge className="text-sm px-3 py-1 font-black">
                          {lookupType === "pos" ? "POS" : "Modifier"} {selected.code}
                        </Badge>
                        {selected.category && (
                          <Badge variant="outline" className="font-bold">{selected.category}</Badge>
                        )}
                      </div>
                      <h2 className="text-2xl font-black text-foreground">{selected.name}</h2>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Info className="w-4 h-4" /> Description
                      </h3>
                      <div className="bg-slate-50 rounded-2xl p-6 border border-border/50">
                        <p className="text-base text-foreground leading-relaxed">{selected.description}</p>
                      </div>
                    </div>

                    {lookupType === "pos" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                          <p className="text-xs font-black text-primary uppercase tracking-wider mb-1">POS Code</p>
                          <p className="text-3xl font-black text-primary">{selected.code}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-border/50">
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Usage</p>
                          <p className="text-sm font-bold">Box 24B on CMS-1500 claim form</p>
                        </div>
                      </div>
                    )}

                    {lookupType === "modifiers" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                          <p className="text-xs font-black text-primary uppercase tracking-wider mb-1">Modifier</p>
                          <p className="text-3xl font-black text-primary">{selected.code}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-border/50">
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Category</p>
                          <p className="text-lg font-black">{selected.category}</p>
                        </div>
                        <div className="col-span-2 bg-slate-50 rounded-2xl p-4 border border-border/50">
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Usage</p>
                          <p className="text-sm font-bold">Append to CPT/HCPCS code on claim form Box 24D</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center border-2 border-dashed border-border/50 rounded-3xl min-h-[400px]"
            >
              <div className="w-24 h-24 bg-primary/5 rounded-[2rem] flex items-center justify-center mb-6 border border-primary/10">
                <Tag className="w-12 h-12 text-primary/30" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Select a Code</h2>
              <p className="text-sm font-medium max-w-xs">
                {lookupType === "pos"
                  ? "Search and select a Place of Service code to view its full description and usage"
                  : "Search and select a modifier to view its full description and usage guidelines"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
