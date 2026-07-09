import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import Login from "./pages/Login.jsx";
import Materiales from "./pages/Materiales.jsx";
import Promociones from "./pages/Promociones.jsx";
import Conversaciones from "./pages/Conversaciones.jsx";
import Resumenes from "./pages/Resumenes.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Blogs from "./pages/Blogs.jsx";
import Documentos from "./pages/Documentos.jsx";
import { Leaf } from "./components/Icons.jsx";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <span className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-soft text-brand-leaf">
        <Leaf size={28} />
      </span>
    </div>
  );
}

function Protected({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { session, loading } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <Splash /> : session ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/materiales"
        element={
          <Protected>
            <Materiales />
          </Protected>
        }
      />
      <Route
        path="/promociones"
        element={
          <Protected>
            <Promociones />
          </Protected>
        }
      />
      <Route
        path="/blogs"
        element={
          <Protected>
            <Blogs />
          </Protected>
        }
      />
      <Route
        path="/documentos"
        element={
          <Protected>
            <Documentos />
          </Protected>
        }
      />
      <Route
        path="/conversaciones"
        element={
          <Protected>
            <Conversaciones />
          </Protected>
        }
      />
      <Route
        path="/resumenes"
        element={
          <Protected>
            <Resumenes />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
