import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();
const clerkPublishableKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function Root() {
  const app = <App authConfigured={Boolean(clerkPublishableKey)} />;
  return (
    <QueryClientProvider client={queryClient}>
      {clerkPublishableKey ? (
        <ClerkProvider publishableKey={clerkPublishableKey} proxyUrl={clerkProxyUrl} appearance={{ variables: { colorPrimary: "#c8ff31", colorBackground: "#0d1818" } }}>
          {app}
        </ClerkProvider>
      ) : app}
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
