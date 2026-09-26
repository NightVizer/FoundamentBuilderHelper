import { useCallback, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { InputPage } from "./pages/InputPage";
import { ResultsPage } from "./pages/ResultsPage";
import type { FoundationInput, RecommendResponse } from "./types/foundation";

export interface Calculation {
  input: FoundationInput;
  result: RecommendResponse;
}

function ErrorScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-sheet px-6">
      <p role="alert" className="text-center text-3xl font-semibold text-ink">
        Произошла ошибка, перезагрузите страницу<span className="text-coral">.</span>
      </p>
    </main>
  );
}

export default function App() {
  const navigate = useNavigate();
  // Состояние живёт только в памяти: без localStorage и параметров URL.
  const [calc, setCalc] = useState<Calculation | null>(null);
  const [failed, setFailed] = useState(false);

  const fail = useCallback((error: unknown) => {
    console.error(error);
    setFailed(true);
  }, []);

  if (failed) return <ErrorScreen />;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <InputPage
            onError={fail}
            onCalculated={(next) => {
              setCalc(next);
              navigate("/results");
            }}
          />
        }
      />
      <Route
        path="/results"
        element={
          calc ? (
            <ResultsPage
              calc={calc}
              onError={fail}
              onNewCalculation={() => {
                setCalc(null);
                navigate("/");
              }}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
