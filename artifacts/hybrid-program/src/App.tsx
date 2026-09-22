import HybridProgram from "@/pages/HybridProgram";

interface AppProps {
  authConfigured?: boolean;
}

function App({ authConfigured = true }: AppProps) {
  return <HybridProgram clerkConfigured={authConfigured} />;
}

export default App;
