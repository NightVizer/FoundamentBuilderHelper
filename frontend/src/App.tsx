import { Route, Routes } from "react-router-dom";
import { ComparePage } from "./pages/ComparePage";
import { HomePage } from "./pages/HomePage";
import { ReportPage } from "./pages/ReportPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/report" element={<ReportPage />} />
    </Routes>
  );
}
