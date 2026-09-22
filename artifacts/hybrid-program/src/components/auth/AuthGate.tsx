import { useAuth, useUser, SignIn } from "@clerk/react";

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isLoaded) {
    return (
      <div className="coach-section" data-testid="status-auth-loading">
        <div className="coach-skeleton" style={{ width: "42%", marginBottom: 12 }} />
        <div className="coach-skeleton" style={{ width: "76%", marginBottom: 8 }} />
        <div className="coach-skeleton" style={{ width: "58%" }} />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="coach-section" data-testid="status-signed-out">
        <div style={{ marginBottom: 16 }}>
          <div className="coach-kicker">ESPACE PRIVÉ</div>
          <h3 style={{ margin: "8px 0 6px", color: "hsl(var(--foreground))", fontSize: 22, letterSpacing: "-.6px" }}>
            Retrouve ton coach.
          </h3>
          <p style={{ margin: 0, color: "hsl(var(--muted-foreground))", fontSize: 12, lineHeight: 1.6 }}>
            Connecte-toi pour que le coach puisse croiser tes séances, ta récupération et tes objectifs.
          </p>
        </div>
        <div className="coach-card" style={{ overflow: "hidden" }}>
          <SignIn routing="hash" appearance={{ variables: { colorPrimary: "#c8ff31", colorBackground: "#0d1818" } }} />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="status-signed-in" data-athlete-name={user?.firstName ?? "athlète"}>
      {children}
    </div>
  );
}