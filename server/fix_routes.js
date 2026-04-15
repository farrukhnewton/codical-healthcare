const fs = require('fs');
let content = fs.readFileSync('/home/user/codical-healthcare/server/routes.ts', 'utf8');

// Remove the broken unified route
const start = content.indexOf('  // ─── Unified Intelligence Search');
const end = content.indexOf('  return httpServer;');

if (start !== -1 && end !== -1) {
  content = content.slice(0, start) + content.slice(end);
  console.log('Removed broken route');
}

const unifiedRoute = `
  // Unified Intelligence Search
  app.get("/api/unified/search", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      if (!q || q.length < 1) return res.json({ results: [], intent: "empty" });
      const isCpt = /^\\d{4,5}[A-Z]?$/.test(q.toUpperCase());
      const isIcd = /^[A-Z]\\d{2}/.test(q.toUpperCase());
      const isNpi = /^\\d{10}$/.test(q);
      const codeOnly = q.split(/\\s+/)[0];
      const hasRvu = /rvu|relative value/i.test(q);
      let intent = "general";
      if (isNpi) intent = "npi";
      else if (isCpt && hasRvu) intent = "rvu";
      else if (isCpt) intent = "cpt";
      else if (isIcd) intent = "icd";
      const results: any[] = [];
      const base = "http://localhost:5000";
      try {
        const r = await fetch(base + "/api/codes/search?query=" + encodeURIComponent(q) + "&limit=5");
        const data = await r.json();
        if (Array.isArray(data)) {
          data.slice(0, 5).forEach((c: any) => results.push({
            id: c.code, type: c.type, category: "code",
            title: c.code, subtitle: String(c.description || "").replace(/^"|"$/g, ""),
            action: "code", data: c,
          }));
        }
      } catch {}
      if (isCpt || /^\\d{4,5}$/.test(q)) {
        try {
          const r = await fetch(base + "/api/rvu/" + encodeURIComponent(codeOnly.toUpperCase()));
          const rvu = await r.json();
          if (rvu && rvu.code) results.push({
            id: "rvu-" + rvu.code, type: "RVU", category: "rvu",
            title: "RVU: " + rvu.code,
            subtitle: "Non-facility: $" + rvu.nonFacilityPayment + " | Facility: $" + rvu.facilityPayment,
            action: "rvu", data: rvu,
          });
        } catch {}
      }
      if (isNpi || (!isCpt && !isIcd && q.length > 3 && /^[a-zA-Z\\s]+$/.test(q))) {
        try {
          const parts = q.split(" ");
          let url = base + "/api/npi/search?limit=2";
          if (isNpi) url += "&number=" + q;
          else { url += "&firstName=" + encodeURIComponent(parts[0]); if (parts[1]) url += "&lastName=" + encodeURIComponent(parts[1]); }
          const r = await fetch(url);
          const data = await r.json();
          if (data.results) data.results.slice(0, 2).forEach((p: any) => {
            const name = p.basic?.organization_name || [p.basic?.first_name, p.basic?.last_name].filter(Boolean).join(" ");
            const spec = p.taxonomies?.find((t: any) => t.primary)?.desc || "";
            results.push({ id: "npi-" + p.number, type: "NPI", category: "npi", title: name, subtitle: spec + " | NPI: " + p.number, action: "npi", data: p });
          });
        } catch {}
      }
      if (!isNpi && q.length > 2) {
        try {
          const r = await fetch(base + "/api/drug/search?q=" + encodeURIComponent(q) + "&type=brand_name&limit=3");
          const data = await r.json();
          if (data.results) data.results.slice(0, 2).forEach((d: any) => results.push({
            id: "drug-" + d.product_ndc, type: "DRUG", category: "drug",
            title: d.brand_name || d.generic_name || q,
            subtitle: String(d.generic_name || "") + " | NDC: " + d.product_ndc,
            action: "drug", data: d,
          }));
        } catch {}
      }
      if (!isNpi && q.length > 2) {
        try {
          const r = await fetch(base + "/api/coverage/lcd/search/smart?q=" + encodeURIComponent(q));
          const data = await r.json();
          if (data.results) data.results.slice(0, 2).forEach((l: any) => results.push({
            id: "lcd-" + l.document_id, type: "LCD", category: "coverage",
            title: l.title, subtitle: String(l.contractor_name_type || "").split("\\r")[0] || "CMS Local Coverage",
            action: "coverage", data: l,
          }));
        } catch {}
      }
      res.json({ results: results.slice(0, 12), intent, query: q });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

`;

content = content.replace('  return httpServer;', unifiedRoute + '  return httpServer;');
fs.writeFileSync('/home/user/codical-healthcare/server/routes.ts', content);
console.log('Done! app.get count:', (content.match(/app\.get/g) || []).length);