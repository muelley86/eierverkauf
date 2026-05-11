import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { ZeitraumProvider } from "@/context/ZeitraumContext";
import Dashboard from "@/pages/Dashboard";
import Import from "@/pages/Import";
import Kunden from "@/pages/Kunden";
import KundenDetail from "@/pages/KundenDetail";
import Artikel from "@/pages/Artikel";
import ArtikelDetail from "@/pages/ArtikelDetail";
import Ranking from "@/pages/Ranking";
import Jahresvergleich from "@/pages/Jahresvergleich";

export default function App() {
  return (
    <ZeitraumProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="import" element={<Import />} />
            <Route path="kunden" element={<Kunden />} />
            <Route path="kunden/:nr" element={<KundenDetail />} />
            <Route path="artikel" element={<Artikel />} />
            <Route path="artikel/:code" element={<ArtikelDetail />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="jahresvergleich" element={<Jahresvergleich />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </ZeitraumProvider>
  );
}
