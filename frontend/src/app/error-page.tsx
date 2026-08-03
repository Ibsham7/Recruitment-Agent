import { useRouteError, useNavigate } from "react-router";
import { useState } from "react";
import { Theme } from "../lib/types";
import { loadSavedTheme, hexToRgba, getGlass } from "../lib/theme";
import { AlertTriangle, RefreshCw, LayoutDashboard, ChevronDown, ChevronUp } from "lucide-react";

export default function RouteErrorPage({ theme }: { theme?: Theme }) {
  const error = useRouteError() as Error | any;
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  const t = theme || loadSavedTheme();
  const G = getGlass(t);

  const errorMessage = error?.message || error?.statusText || (typeof error === "string" ? error : "An unexpected error occurred");
  const isModuleFetchError = errorMessage?.includes(" dynamically imported module") || errorMessage?.includes("Failed to fetch");

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 relative select-none">
      {/* Ambient error glow */}
      <div 
        style={{ 
          position: "absolute", 
          width: "500px", 
          height: "500px", 
          borderRadius: "50%", 
          background: `radial-gradient(circle, ${hexToRgba(t.numNeg, t.isDark ? 0.15 : 0.08)} 0%, transparent 70%)`, 
          pointerEvents: "none" 
        }} 
      />

      <div className="flex flex-col items-center gap-6 relative z-10 max-w-lg w-full">
        {/* Error Icon Badge */}
        <div 
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ 
            background: `linear-gradient(135deg, ${hexToRgba(t.numNeg, 0.2)}, ${hexToRgba(t.numNeg, 0.05)})`,
            border: `1px solid ${hexToRgba(t.numNeg, 0.4)}`,
            color: t.numNeg 
          }}
        >
          <AlertTriangle className="w-8 h-8" />
        </div>

        {/* Main Card */}
        <div className="rounded-2xl p-6 text-center w-full shadow-2xl" style={G.cardWarm}>
          <h2 className="text-xl font-bold mb-2" style={{ color: t.txtPrimary }}>
            {isModuleFetchError ? "Application Update Needed" : "Something Went Wrong"}
          </h2>

          <p className="text-sm leading-relaxed mb-6" style={{ color: t.txtSecondary }}>
            {isModuleFetchError
              ? "A new version of the app is available, or the module failed to load. Reloading the page will fetch the latest assets."
              : "An unexpected error occurred while loading this page."}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={handleReload}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})`,
                color: t.accentText,
                boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}`
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>

            <button
              onClick={handleGoDashboard}
              className="py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              style={{
                background: hexToRgba(t.txtPrimary, 0.08),
                color: t.txtPrimary,
                border: `1px solid ${hexToRgba(t.txtPrimary, 0.12)}`
              }}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
          </div>

          {/* Technical Details Toggle */}
          <div className="mt-6 pt-4 border-t" style={{ borderColor: hexToRgba(t.txtPrimary, 0.08) }}>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs flex items-center justify-center gap-1 mx-auto cursor-pointer font-medium"
              style={{ color: t.txtMuted }}
            >
              {showDetails ? "Hide Technical Details" : "Show Technical Details"}
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDetails && (
              <div 
                className="mt-3 p-3 rounded-xl text-left text-xs overflow-x-auto font-mono max-h-40"
                style={{ 
                  background: hexToRgba(t.bgCard, 0.8), 
                  color: t.txtSecondary,
                  border: `1px solid ${hexToRgba(t.txtPrimary, 0.1)}`
                }}
              >
                <div className="font-semibold text-red-400 mb-1">{errorMessage}</div>
                {error?.stack && (
                  <pre className="text-[11px] whitespace-pre-wrap opacity-75">{error.stack}</pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error code footer badge */}
        <div className="flex items-center gap-2 text-[11px]" style={{ fontFamily: "'DM Mono', monospace", color: t.txtGhost }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: t.numNeg, display: "inline-block", boxShadow: `0 0 6px ${hexToRgba(t.numNeg, 0.7)}` }} />
          ERR_MODULE_IMPORT · hireagent/v1
        </div>
      </div>
    </div>
  );
}
