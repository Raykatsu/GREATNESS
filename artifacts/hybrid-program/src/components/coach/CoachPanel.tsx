import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCoachConversationQueryKey,
  getGetMyOverviewQueryKey,
  getListCoachConversationsQueryKey,
  useCreateCoachConversation,
  useGetCoachConversation,
  useGetMyOverview,
  useImportMyLocalData,
  useListCoachConversations,
  useSendCoachMessage,
  useUpdateMyProfile,
  type CoachConversation,
  type CoachConversationDetail,
  type LocalDataImport,
} from "@workspace/api-client-react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronRight,
  FileUp,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";

interface CoachPanelProps {
  onClose: () => void;
}

const requestOptions = { credentials: "include" as const };

function formatDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Le service n’a pas répondu. Réessaie dans un instant.";
}

function localDataPayload(): LocalDataImport {
  const read = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    sessions: read("journal_v4", []).map((session: any) => ({
      id: Number(session.id),
      date: String(session.date ?? ""),
      dateISO: String(session.dateISO ?? ""),
      exercise: String(session.exercise ?? ""),
      sets: (session.sets ?? []).map((set: any) => ({
        reps: String(set.reps ?? ""),
        weight: String(set.weight ?? ""),
        rpe: set.rpe ? String(set.rpe) : null,
      })),
    })),
    bodyMetrics: read("body_v4", []).map((entry: any) => ({
      date: String(entry.date ?? ""),
      dateISO: String(entry.dateISO ?? ""),
      weight: Number(entry.weight ?? 0),
    })),
    recovery: read("recov_v4", []).map((entry: any) => ({
      id: Number(entry.id),
      date: String(entry.date ?? ""),
      dateISO: String(entry.dateISO ?? ""),
      sleep: entry.sleep ? Number(entry.sleep) : null,
      fatigue: Number(entry.fatigue ?? 0),
      stress: Number(entry.stress ?? 0),
      protScore: entry.protScore ?? null,
      carbScore: entry.carbScore ?? null,
      hydration: Number(entry.hydration ?? 0),
    })),
  };
}

function StatusMessage({
  tone,
  children,
}: {
  tone: "error" | "info" | "success";
  children: React.ReactNode;
}) {
  const colors = {
    error: {
      bg: "hsl(5 55% 14% / .55)",
      border: "hsl(5 72% 55% / .32)",
      text: "hsl(5 82% 73%)",
    },
    info: {
      bg: "hsl(190 55% 14% / .55)",
      border: "hsl(190 72% 58% / .3)",
      text: "hsl(190 78% 76%)",
    },
    success: {
      bg: "hsl(151 48% 13% / .6)",
      border: "hsl(151 65% 52% / .28)",
      text: "hsl(151 73% 70%)",
    },
  }[tone];
  return (
    <div
      data-testid={`status-coach-${tone}`}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: "11px 12px",
        background: colors.bg,
        color: colors.text,
        fontSize: 11,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  creating,
}: {
  conversations: CoachConversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <section className="coach-section" aria-label="Conversations">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div>
          <div className="coach-kicker">FIL DU COACH</div>
          <div
            style={{
              marginTop: 4,
              color: "hsl(var(--muted-foreground))",
              fontSize: 11,
            }}
          >
            Tes décisions, au même endroit.
          </div>
        </div>
        <button
          type="button"
          data-testid="button-new-coach-conversation"
          className="coach-close"
          onClick={onCreate}
          disabled={creating}
          aria-label="Nouvelle conversation"
        >
          {creating ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <Plus size={17} />
          )}
        </button>
      </div>
      {conversations.length === 0 ? (
        <div
          className="coach-card"
          data-testid="empty-coach-conversations"
          style={{
            padding: 16,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              display: "grid",
              placeItems: "center",
              borderRadius: 11,
              color: "hsl(var(--accent))",
              background: "hsl(var(--accent) / .12)",
            }}
          >
            <MessageCircle size={17} />
          </div>
          <div>
            <div
              style={{
                color: "hsl(var(--foreground))",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Pas encore de fil.
            </div>
            <div
              style={{
                color: "hsl(var(--muted-foreground))",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              Lance une conversation pour donner un peu de contexte à ton coach.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 7 }}>
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              data-testid={`button-coach-conversation-${conversation.id}`}
              onClick={() => onSelect(conversation.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                padding: "11px 12px",
                textAlign: "left",
                border: `1px solid ${selectedId === conversation.id ? "hsl(var(--accent) / .46)" : "hsl(var(--border))"}`,
                borderRadius: 12,
                color: "hsl(var(--foreground))",
                background:
                  selectedId === conversation.id
                    ? "hsl(var(--accent) / .1)"
                    : "hsl(var(--card) / .6)",
                cursor: "pointer",
              }}
            >
              <MessageCircle
                size={15}
                color={
                  selectedId === conversation.id
                    ? "hsl(var(--accent))"
                    : "hsl(var(--muted-foreground))"
                }
              />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {conversation.title}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    color: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                >
                  {formatDate(conversation.updatedAt)}
                </span>
              </span>
              <ChevronRight size={15} color="hsl(var(--muted-foreground))" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function OverviewCard() {
  const { isLoaded, isSignedIn } = useAuth();
  const overviewQuery = useGetMyOverview({
    query: {
      enabled: Boolean(isLoaded && isSignedIn),
      queryKey: getGetMyOverviewQueryKey(),
    },
    request: requestOptions,
  });
  const overview = overviewQuery.data;
  const latestRecovery = overview?.recovery?.at(-1);
  const latestSession = overview?.sessions?.at(-1);
  if (overviewQuery.isLoading) {
    return (
      <section className="coach-section" data-testid="status-overview-loading">
        <div className="coach-card" style={{ padding: 16 }}>
          <div
            className="coach-skeleton"
            style={{ width: "34%", marginBottom: 12 }}
          />
          <div
            className="coach-skeleton"
            style={{ width: "78%", marginBottom: 8 }}
          />
          <div className="coach-skeleton" style={{ width: "54%" }} />
        </div>
      </section>
    );
  }
  if (overviewQuery.isError) {
    return (
      <section className="coach-section">
        <StatusMessage tone="info">
          Ton espace d’entraînement sera disponible dès que ton profil sera
          synchronisé.
        </StatusMessage>
      </section>
    );
  }
  return (
    <section className="coach-section" data-testid="card-athlete-overview">
      <div className="coach-card" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div className="coach-kicker">POINT DE DÉPART</div>
            <div
              style={{
                marginTop: 5,
                color: "hsl(var(--foreground))",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-.3px",
              }}
            >
              {overview?.profile.displayName || "Ton profil athlète"}
            </div>
          </div>
          <Activity size={18} color="hsl(var(--accent))" />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 16,
          }}
        >
          {[
            ["Séances", overview?.sessions.length ?? 0, "hsl(163 62% 62%)"],
            [
              "Récupération",
              latestRecovery ? `${latestRecovery.fatigue}/5` : "—",
              "hsl(45 95% 69%)",
            ],
            ["Dernière trace", latestSession?.date ?? "—", "hsl(284 80% 78%)"],
          ].map(([label, value, color]) => (
            <div
              key={label}
              style={{
                padding: "10px 9px",
                borderRadius: 10,
                background: "hsl(var(--muted) / .65)",
              }}
            >
              <div
                style={{
                  color: "hsl(var(--muted-foreground))",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: ".8px",
                }}
              >
                {label}
              </div>
              <div
                data-testid={`text-overview-${label}`}
                style={{
                  marginTop: 5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: String(color),
                  fontSize: 15,
                  fontWeight: 800,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ConversationView({ conversationId }: { conversationId: number }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const detailQuery = useGetCoachConversation(conversationId, {
    query: {
      enabled: !!conversationId,
      queryKey: getGetCoachConversationQueryKey(conversationId),
    },
    request: requestOptions,
  });
  const sendMessage = useSendCoachMessage({ request: requestOptions });
  const detail = detailQuery.data as CoachConversationDetail | undefined;

  const submit = () => {
    const content = draft.trim();
    if (!content || sendMessage.isPending) return;
    setDraft("");
    sendMessage.mutate(
      { id: conversationId, data: { content } },
      {
        onSuccess: (response) => {
          setAiUnavailable(!response.aiAvailable);
          queryClient.invalidateQueries({
            queryKey: getGetCoachConversationQueryKey(conversationId),
          });
          queryClient.invalidateQueries({
            queryKey: getListCoachConversationsQueryKey(),
          });
        },
        onError: () => setDraft(content),
      },
    );
  };

  if (detailQuery.isLoading)
    return (
      <div
        className="coach-card"
        data-testid="status-conversation-loading"
        style={{
          minHeight: 380,
          padding: 16,
          display: "grid",
          alignContent: "end",
          gap: 9,
        }}
      >
        <div className="coach-skeleton" style={{ width: "66%" }} />
        <div
          className="coach-skeleton"
          style={{ width: "42%", justifySelf: "end" }}
        />
        <div className="coach-skeleton" style={{ width: "82%" }} />
      </div>
    );
  if (detailQuery.isError)
    return (
      <StatusMessage tone="error">
        Impossible d’ouvrir ce fil.{" "}
        <button
          type="button"
          data-testid="button-retry-conversation"
          onClick={() => void detailQuery.refetch()}
          style={{
            marginLeft: 6,
            color: "inherit",
            textDecoration: "underline",
            background: "none",
            border: 0,
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      </StatusMessage>
    );

  const messages = detail?.messages ?? [];
  return (
    <div
      className="coach-card coach-chat"
      data-testid={`card-coach-conversation-${conversationId}`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 14px",
          borderBottom: "1px solid hsl(var(--border))",
        }}
      >
        <div>
          <div className="coach-kicker">CONVERSATION ACTIVE</div>
          <div
            style={{
              marginTop: 3,
              color: "hsl(var(--foreground))",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {detail?.title ?? "Coach"}
          </div>
        </div>
        <Sparkles size={16} color="hsl(var(--accent))" />
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 12,
          padding: 14,
          overflowY: "auto",
        }}
      >
        {messages.length === 0 ? (
          <div
            data-testid="empty-coach-messages"
            style={{
              margin: "auto",
              maxWidth: 280,
              textAlign: "center",
              color: "hsl(var(--muted-foreground))",
              fontSize: 11,
              lineHeight: 1.6,
            }}
          >
            Décris ton état du jour, une séance prévue ou ce qui te freine. Le
            coach répond avec le contexte que tu lui donnes.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`coach-message ${message.role === "user" ? "coach-message--user" : ""}`}
              data-testid={`message-coach-${message.id}`}
            >
              <div className="coach-message__meta">
                {message.role === "user" ? "TOI" : "COACH"} ·{" "}
                {formatDate(message.createdAt)}
              </div>
              {message.content}
            </div>
          ))
        )}
        {sendMessage.isPending && (
          <div className="coach-message" data-testid="status-coach-thinking">
            <div className="coach-message__meta">COACH · EN TRAIN DE LIRE</div>
            <div style={{ display: "flex", gap: 5 }}>
              <span
                className="coach-skeleton"
                style={{ width: 8, height: 8 }}
              />
              <span
                className="coach-skeleton"
                style={{ width: 8, height: 8, animationDelay: ".12s" }}
              />
              <span
                className="coach-skeleton"
                style={{ width: 8, height: 8, animationDelay: ".24s" }}
              />
            </div>
          </div>
        )}
      </div>
      {sendMessage.isError && (
        <div style={{ padding: "0 12px 10px" }}>
          <StatusMessage tone="error">
            {getErrorMessage(sendMessage.error)}
          </StatusMessage>
        </div>
      )}
      {aiUnavailable && (
        <div style={{ padding: "0 12px 10px" }}>
          <StatusMessage tone="info">
            <Sparkles
              size={13}
              style={{ verticalAlign: "middle", marginRight: 5 }}
            />
            Le fil est bien enregistré, mais le moteur IA est momentanément
            indisponible. Tu peux continuer à noter ton contexte ici.
          </StatusMessage>
        </div>
      )}
      <form
        className="coach-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          data-testid="input-coach-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Écris à ton coach…"
          aria-label="Message au coach"
        />
        <button
          type="submit"
          data-testid="button-send-coach-message"
          className="coach-icon-button"
          disabled={!draft.trim() || sendMessage.isPending}
          aria-label="Envoyer le message"
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}

function ProfileAndImport() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const overviewQuery = useGetMyOverview({
    query: {
      enabled: Boolean(isLoaded && isSignedIn),
      queryKey: getGetMyOverviewQueryKey(),
    },
    request: requestOptions,
  });
  const profile = overviewQuery.data?.profile;
  const [name, setName] = useState("");
  const [goals, setGoals] = useState("");
  const [constraints, setConstraints] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const updateProfile = useUpdateMyProfile({ request: requestOptions });
  const importData = useImportMyLocalData({ request: requestOptions });

  const valuesReady = useMemo(() => Boolean(profile), [profile]);
  useEffect(() => {
    if (profile && !name && !goals && !constraints) {
      setName(profile.displayName ?? "");
      setGoals(profile.goals ?? "");
      setConstraints(profile.constraints ?? "");
    }
  }, [profile]);

  const saveProfile = () => {
    updateProfile.mutate(
      {
        data: {
          displayName: name.trim() || null,
          goals: goals.trim() || null,
          constraints: constraints.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setNotice("Profil mis à jour.");
          setProfileOpen(false);
          queryClient.invalidateQueries({
            queryKey: getGetMyOverviewQueryKey(),
          });
        },
      },
    );
  };

  const importLocal = () => {
    importData.mutate(
      { data: localDataPayload() },
      {
        onSuccess: (result) => {
          setNotice(
            `${result.sessionsImported} séances, ${result.recoveryImported} suivis importés.`,
          );
          queryClient.invalidateQueries({
            queryKey: getGetMyOverviewQueryKey(),
          });
        },
      },
    );
  };

  if (!valuesReady) return null;
  return (
    <section className="coach-section" aria-label="Profil et données">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          data-testid="button-toggle-coach-profile"
          onClick={() => setProfileOpen((open) => !open)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            minHeight: 38,
            padding: "0 11px",
            border: "1px solid hsl(var(--border))",
            borderRadius: 10,
            color: "hsl(var(--muted-foreground))",
            background: "hsl(var(--muted) / .55)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".5px",
            cursor: "pointer",
          }}
        >
          <Settings2 size={14} />{" "}
          {profileOpen ? "FERMER LE PROFIL" : "AJUSTER MON PROFIL"}
        </button>
        <button
          type="button"
          data-testid="button-import-local-data"
          onClick={importLocal}
          disabled={importData.isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            minHeight: 38,
            padding: "0 11px",
            border: "1px solid hsl(var(--accent) / .28)",
            borderRadius: 10,
            color: "hsl(var(--accent))",
            background: "hsl(var(--accent) / .08)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".5px",
            cursor: "pointer",
          }}
        >
          <FileUp size={14} />{" "}
          {importData.isPending ? "IMPORT…" : "IMPORTER MES DONNÉES"}
        </button>
      </div>
      {profileOpen && (
        <div
          className="coach-card"
          style={{ display: "grid", gap: 9, marginTop: 12, padding: 13 }}
        >
          <label
            style={{
              color: "hsl(var(--muted-foreground))",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".8px",
            }}
          >
            NOM AFFICHÉ
            <input
              data-testid="input-coach-display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label
            style={{
              color: "hsl(var(--muted-foreground))",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".8px",
            }}
          >
            OBJECTIFS
            <textarea
              data-testid="input-coach-goals"
              value={goals}
              onChange={(event) => setGoals(event.target.value)}
              style={textAreaStyle}
              placeholder="Ex : rester explosif sans sacrifier la force"
            />
          </label>
          <label
            style={{
              color: "hsl(var(--muted-foreground))",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".8px",
            }}
          >
            CONTRAINTES
            <textarea
              data-testid="input-coach-constraints"
              value={constraints}
              onChange={(event) => setConstraints(event.target.value)}
              style={textAreaStyle}
              placeholder="Ex : épaule droite sensible, deux soirées disponibles"
            />
          </label>
          <button
            type="button"
            data-testid="button-save-coach-profile"
            onClick={saveProfile}
            disabled={updateProfile.isPending}
            style={primaryButton}
          >
            {updateProfile.isPending
              ? "ENREGISTREMENT…"
              : "ENREGISTRER LE PROFIL"}
          </button>
        </div>
      )}
      {notice && (
        <div style={{ marginTop: 10 }}>
          <StatusMessage tone="success">
            <Check
              size={13}
              style={{ verticalAlign: "middle", marginRight: 5 }}
            />
            {notice}
          </StatusMessage>
        </div>
      )}
      {importData.isError && (
        <div style={{ marginTop: 10 }}>
          <StatusMessage tone="error">
            {getErrorMessage(importData.error)}
          </StatusMessage>
        </div>
      )}
      {updateProfile.isError && (
        <div style={{ marginTop: 10 }}>
          <StatusMessage tone="error">
            {getErrorMessage(updateProfile.error)}
          </StatusMessage>
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 5,
  minHeight: 40,
  boxSizing: "border-box",
  border: "1px solid hsl(var(--border))",
  borderRadius: 9,
  padding: "9px 10px",
  color: "hsl(var(--foreground))",
  background: "hsl(var(--muted) / .72)",
  font: "500 12px/1.4 var(--font-body, 'Manrope', sans-serif)",
  outline: "none",
};
const textAreaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 68,
  resize: "vertical",
};
const primaryButton: React.CSSProperties = {
  minHeight: 42,
  border: 0,
  borderRadius: 9,
  color: "hsl(var(--accent-foreground))",
  background: "hsl(var(--accent))",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".8px",
  cursor: "pointer",
};

export function CoachPanel({ onClose }: CoachPanelProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const conversationsQuery = useListCoachConversations({
    query: {
      enabled: Boolean(isLoaded && isSignedIn),
      queryKey: getListCoachConversationsQueryKey(),
    },
    request: requestOptions,
  });
  const createConversation = useCreateCoachConversation({
    request: requestOptions,
  });

  const conversations = conversationsQuery.data ?? [];
  const create = () => {
    createConversation.mutate(
      { data: { title: "Point du jour" } },
      {
        onSuccess: (conversation) => {
          setSelectedId(conversation.id);
          queryClient.invalidateQueries({
            queryKey: getListCoachConversationsQueryKey(),
          });
        },
      },
    );
  };

  return (
    <>
      <div
        className="coach-backdrop"
        data-testid="coach-backdrop"
        onClick={onClose}
      />
      <aside
        className="coach-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Coach IA"
      >
        <div className="coach-panel__header">
          <div>
            <div
              className="coach-kicker"
              style={{ display: "flex", alignItems: "center", gap: 7 }}
            >
              <span className="coach-launcher__pulse" /> COACH IA · ATHLÈTE
              HYBRIDE
            </div>
            <h2
              style={{
                margin: "8px 0 4px",
                color: "hsl(var(--foreground))",
                fontSize: 24,
                letterSpacing: "-.8px",
              }}
            >
              On ajuste, pas à pas.
            </h2>
            <p
              style={{
                margin: 0,
                maxWidth: 390,
                color: "hsl(var(--muted-foreground))",
                fontSize: 11,
                lineHeight: 1.55,
              }}
            >
              Un espace de décision pour relier charge, souffle, combat et
              récupération.
            </p>
          </div>
          <button
            type="button"
            data-testid="button-close-coach"
            className="coach-close"
            onClick={onClose}
            aria-label="Fermer le coach"
          >
            <X size={17} />
          </button>
        </div>
        <div className="coach-panel__scroll">
          <AuthGate>
            <OverviewCard />
            {conversationsQuery.isError ? (
              <div className="coach-section">
                <StatusMessage tone="error">
                  <AlertTriangle
                    size={14}
                    style={{ verticalAlign: "middle", marginRight: 5 }}
                  />
                  {getErrorMessage(conversationsQuery.error)}{" "}
                  <button
                    type="button"
                    data-testid="button-retry-coach-list"
                    onClick={() => void conversationsQuery.refetch()}
                    style={{
                      marginLeft: 6,
                      color: "inherit",
                      textDecoration: "underline",
                      background: "none",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    Réessayer
                  </button>
                </StatusMessage>
              </div>
            ) : conversationsQuery.isLoading ? (
              <div
                className="coach-section"
                data-testid="status-coach-list-loading"
              >
                <div
                  className="coach-skeleton"
                  style={{ width: "38%", marginBottom: 12 }}
                />
                <div
                  className="coach-skeleton"
                  style={{ width: "100%", marginBottom: 8 }}
                />
                <div className="coach-skeleton" style={{ width: "88%" }} />
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCreate={create}
                creating={createConversation.isPending}
              />
            )}
            {createConversation.isError && (
              <div className="coach-section">
                <StatusMessage tone="error">
                  Impossible de créer un fil.{" "}
                  {getErrorMessage(createConversation.error)}
                </StatusMessage>
              </div>
            )}
            <section className="coach-section">
              {selectedId ? (
                <ConversationView conversationId={selectedId} />
              ) : (
                <div
                  className="coach-card"
                  data-testid="empty-coach-selected"
                  style={{
                    minHeight: 250,
                    display: "grid",
                    placeItems: "center",
                    padding: 28,
                    textAlign: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        display: "grid",
                        placeItems: "center",
                        margin: "0 auto 12px",
                        borderRadius: 15,
                        color: "hsl(var(--accent))",
                        background: "hsl(var(--accent) / .1)",
                      }}
                    >
                      <Sparkles size={21} />
                    </div>
                    <div
                      style={{
                        color: "hsl(var(--foreground))",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      Choisis ton prochain point d’appui.
                    </div>
                    <div
                      style={{
                        maxWidth: 300,
                        marginTop: 6,
                        color: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                        lineHeight: 1.6,
                      }}
                    >
                      Un fil pour préparer la séance, interpréter ta
                      récupération ou arbitrer entre force et endurance.
                    </div>
                    <button
                      type="button"
                      data-testid="button-start-coach-conversation"
                      onClick={create}
                      disabled={createConversation.isPending}
                      style={{
                        ...primaryButton,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        marginTop: 16,
                        padding: "0 14px",
                      }}
                    >
                      <ArrowUpRight size={14} />{" "}
                      {createConversation.isPending
                        ? "OUVERTURE…"
                        : "OUVRIR UN FIL"}
                    </button>
                  </div>
                </div>
              )}
            </section>
            <section className="coach-section">
              <div className="coach-kicker" style={{ marginBottom: 9 }}>
                DISPONIBILITÉ
              </div>
              <StatusMessage tone="info">
                <Sparkles
                  size={13}
                  style={{ verticalAlign: "middle", marginRight: 5 }}
                />
                Le coach s’appuie sur tes données enregistrées. Il ne remplace
                pas un professionnel de santé et te signalera quand les données
                sont trop incomplètes.
              </StatusMessage>
            </section>
            <ProfileAndImport />
          </AuthGate>
        </div>
      </aside>
    </>
  );
}
