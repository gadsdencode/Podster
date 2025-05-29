import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "@/lib/notification-context";
import { useEpisodeNotifications } from "@/hooks/use-episode-notifications";
import MainLayout from "@/components/layout/main-layout";
import Dashboard from "@/pages/dashboard";
import AddEpisode from "@/pages/add-episode";
import Episodes from "@/pages/episodes";
import Search from "@/pages/search";
import Admin from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import NotFound from "@/pages/not-found";
import { BrowserRouter } from "react-router-dom";

// Component to initialize global hooks
function GlobalHooks() {
  useEpisodeNotifications();
  return null;
}

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/add-episode" component={AddEpisode} />
        <Route path="/episodes" component={Episodes} />
        <Route path="/search" component={Search} />
        <Route path="/admin" component={Admin} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <NotificationProvider>
            <GlobalHooks />
            <Toaster />
            <Router />
          </NotificationProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
