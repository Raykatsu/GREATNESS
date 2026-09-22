import { useState } from "react";
import { BrainCircuit } from "lucide-react";
import { CoachPanel } from "@/components/coach/CoachPanel";

interface CoachLauncherProps {
  clerkConfigured: boolean;
}

export function CoachLauncher({ clerkConfigured }: CoachLauncherProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="button-open-coach" className="coach-launcher" onClick={() => setOpen(true)} aria-label="Ouvrir le coach IA">
        <span className="coach-launcher__pulse" />
        <BrainCircuit size={16} />
        <span>COACH IA</span>
      </button>
      {open && (clerkConfigured ? <CoachPanel onClose={() => setOpen(false)} /> : <div className="coach-backdrop" data-testid="auth-not-configured-backdrop" onClick={() => setOpen(false)}><div className="coach-panel" role="dialog" aria-modal="true" aria-label="Authentification indisponible" onClick={(event) => event.stopPropagation()}><div className="coach-panel__header"><div><div className="coach-kicker">ESPACE PRIVÉ</div><h2 style={{ margin: "8px 0 4px", color: "hsl(var(--foreground))", fontSize: 24 }}>Connexion en attente.</h2><p style={{ margin: 0, color: "hsl(var(--muted-foreground))", fontSize: 12, lineHeight: 1.6 }}>Clerk n’est pas configuré sur cet environnement. Le coach sera disponible après activation de l’authentification.</p></div><button type="button" data-testid="button-close-auth-unavailable" className="coach-close" onClick={() => setOpen(false)} aria-label="Fermer"><span aria-hidden="true">×</span></button></div><div className="coach-section"><div className="coach-card" style={{ padding: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 10, color: "hsl(45 95% 69%)", fontSize: 12, lineHeight: 1.6 }}><CircleAlertIcon /> Authentification non disponible dans cette prévisualisation.</div></div></div></div></div>)}
    </>
  );
}

function CircleAlertIcon() {
  return <span style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: "50%", color: "hsl(45 95% 69%)", background: "hsl(45 95% 69% / .12)", fontSize: 15 }} aria-hidden="true">!</span>;
}