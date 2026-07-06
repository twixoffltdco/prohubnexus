import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import Landing from "./pages/Landing";
import ForumPanel from "./pages/ForumPanel";
import Auth from "./pages/Auth";
import CategoryView from "./pages/CategoryView";
import TopicView from "./pages/TopicView";
import CreateTopic from "./pages/CreateTopic";
import Resources from "./pages/Resources";
import CreateResource from "./pages/CreateResource";
import ResourceView from "./pages/ResourceView";
import Profile from "./pages/Profile";
import Videos from "./pages/Videos";
import UploadVideo from "./pages/UploadVideo";
import VideoView from "./pages/VideoView";
import VideoSwiper from "./pages/VideoSwiper";
import ModeratorResources from "./pages/ModeratorResources";
import ModeratorApplications from "./pages/ModeratorApplications";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import CreateAd from "./pages/CreateAd";
import AdsDashboard from "./pages/AdsDashboard";
import Withdraw from "./pages/Withdraw";
import AdminPanel from "./pages/AdminPanel";
import Guilds from "./pages/Guilds";
import GuildView from "./pages/GuildView";
import GuildRankings from "./pages/GuildRankings";
import Members from "./pages/Members";
import Bookmarks from "./pages/Bookmarks";
import StreakLeaderboard from "./pages/StreakLeaderboard";
import NotFound from "./pages/NotFound";
import Blocked from "./pages/Blocked";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import FAQ from "./pages/FAQ";
import Rules from "./pages/Rules";
import CodeForumLanding from "./pages/CodeForumLanding";
import CodeForumPanel from "./pages/CodeForumPanel";
import CodeForumCategoryView from "./pages/CodeForumCategoryView";
import CodeForumTopicView from "./pages/CodeForumTopicView";
import CodeForumMembers from "./pages/CodeForumMembers";
import CodeForumCreateTopic from "./pages/CodeForumCreateTopic";
import CodeForumProfile from "./pages/CodeForumProfile";
import CodeForumModeratorPanel from "./pages/CodeForumModeratorPanel";
import CodeForumResources from "./pages/CodeForumResources";
import CodeForumResourceView from "./pages/CodeForumResourceView";
import CodeForumRules from "./pages/CodeForumRules";
import CodeForumPrivacy from "./pages/CodeForumPrivacy";
import CodeForumTerms from "./pages/CodeForumTerms";
import FlexDevLanding from "./pages/FlexDevLanding";
import FlexDevPanel from "./pages/FlexDevPanel";
import FlexDevCategoryView from "./pages/FlexDevCategoryView";
import FlexDevTopicView from "./pages/FlexDevTopicView";
import FlexDevCreateTopic from "./pages/FlexDevCreateTopic";
import FlexDevMembers from "./pages/FlexDevMembers";
import FlexDevResources from "./pages/FlexDevResources";
import FlexDevResourceView from "./pages/FlexDevResourceView";
import SubForumPanel from "./pages/SubForumPanel";
import SubForumCategoryView from "./pages/SubForumCategoryView";
import SubForumTopicView from "./pages/SubForumTopicView";
import SubForumCreateTopic from "./pages/SubForumCreateTopic";
import SubForumSearchPage from "./pages/SubForumSearchPage";
import AuthHandoff from "./pages/AuthHandoff";
import BrandAccounts from "./pages/BrandAccounts";
import BrandDirectory from "./pages/BrandDirectory";
import BrandRating from "./pages/BrandRating";
import BrandProfile from "./pages/BrandProfile";
import BusinessLanding from "./pages/BusinessLanding";
import RandomTopic from "./pages/RandomTopic";
import OAuthConsent from "./pages/OAuthConsent";
import ChangelogModal from "./components/ChangelogModal";
import PluginRunner from "./components/PluginRunner";
import OinkGramBanner from "./components/OinkGramBanner";
import RecruitmentBanner from "./components/RecruitmentBanner";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import SeasonalEffects from "./components/SeasonalEffects";
import MobileBottomNav from "./components/MobileBottomNav";
import Footer from "./components/Footer";
import BackToTopButton from "./components/BackToTopButton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const CodeForumGate = () => {
  const seen = typeof window !== "undefined" && localStorage.getItem("codeforum_visited") === "1";
  if (!seen && typeof window !== "undefined") {
    return <Navigate to="/codeforum/welcome" replace />;
  }
  return <CodeForumPanel />;
};

const AppLayout = ({ user }: { user: any }) => {
  const location = useLocation();
  const isCodeForumRoute = location.pathname === "/codeforum" || location.pathname.startsWith("/codeforum/");
  const isFlexDevRoute = location.pathname === "/flexdev" || location.pathname.startsWith("/flexdev/");
  const isNeonRoute = isCodeForumRoute || isFlexDevRoute;

  return (
    <AuthGuard>
      <PluginRunner hookPoint="global_header" />
      {!isNeonRoute && <OinkGramBanner />}
      {!isNeonRoute && <RecruitmentBanner />}
      <div className={isNeonRoute ? "" : "pb-16 lg:pb-0"}>

        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="/forum" element={<ForumPanel />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/handoff" element={<AuthHandoff />} />
          <Route path="/brands" element={<BrandAccounts />} />
          <Route path="/brands/all" element={<BrandDirectory />} />
          <Route path="/business" element={<BusinessLanding />} />
          <Route path="/brand/:handle" element={<BrandProfile />} />
          <Route path="/random" element={<RandomTopic />} />
          <Route path="/blocked" element={<Blocked />} />
          <Route path="/category/:slug" element={<CategoryView />} />
          <Route path="/topic/:id" element={<TopicView />} />
          <Route path="/create-topic" element={<CreateTopic />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/resource/:id" element={<ResourceView />} />
          <Route path="/create-resource" element={<CreateResource />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/videos/swipe" element={<VideoSwiper />} />
          <Route path="/upload-video" element={<UploadVideo />} />
          <Route path="/video/:id" element={<VideoView />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/moderator/resources" element={<ModeratorResources />} />
          <Route path="/apply-moderator" element={<ModeratorApplications />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/create-ad" element={<CreateAd />} />
          <Route path="/ads-dashboard" element={<AdsDashboard />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/guilds" element={<Guilds />} />
          <Route path="/guild/:id" element={<GuildView />} />
          <Route path="/guilds/rankings" element={<GuildRankings />} />
          <Route path="/members" element={<Members />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/streaks" element={<StreakLeaderboard />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/codeforum" element={<CodeForumGate />} />
          <Route path="/codeforum/welcome" element={<CodeForumLanding />} />
          <Route path="/codeforum/forum" element={<CodeForumPanel />} />
          <Route path="/codeforum/category/:slug" element={<CodeForumCategoryView />} />
          <Route path="/codeforum/topic/:id" element={<CodeForumTopicView />} />
          <Route path="/codeforum/members" element={<CodeForumMembers />} />
          <Route path="/codeforum/create-topic" element={<CodeForumCreateTopic />} />
          <Route path="/codeforum/resources" element={<CodeForumResources />} />
          <Route path="/codeforum/resource/:id" element={<CodeForumResourceView />} />
          <Route path="/codeforum/profile" element={<CodeForumProfile />} />
          <Route path="/codeforum/profile/:username" element={<CodeForumProfile />} />
          <Route path="/codeforum/moderator" element={<CodeForumModeratorPanel />} />
          <Route path="/codeforum/rules" element={<CodeForumRules />} />
          <Route path="/codeforum/privacy" element={<CodeForumPrivacy />} />
          <Route path="/codeforum/terms" element={<CodeForumTerms />} />
          <Route path="/flexdev" element={<FlexDevLanding />} />
          <Route path="/flexdev/forum" element={<FlexDevPanel />} />
          <Route path="/flexdev/category/:slug" element={<FlexDevCategoryView />} />
          <Route path="/flexdev/topic/:id" element={<FlexDevTopicView />} />
          <Route path="/flexdev/create-topic" element={<FlexDevCreateTopic />} />
          <Route path="/flexdev/members" element={<FlexDevMembers />} />
          <Route path="/flexdev/resources" element={<FlexDevResources />} />
          <Route path="/flexdev/resource/:id" element={<FlexDevResourceView />} />
          <Route path="/f/:slug" element={<SubForumPanel />} />
          <Route path="/f/:slug/c/:catSlug" element={<SubForumCategoryView />} />
          <Route path="/f/:slug/t/:topicId" element={<SubForumTopicView />} />
          <Route path="/f/:slug/new" element={<SubForumCreateTopic />} />
          <Route path="/f/:slug/search" element={<SubForumSearchPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <PluginRunner hookPoint="global_footer" />
      {!isNeonRoute && <Footer />}
      {!isNeonRoute && <MobileBottomNav user={user} />}
      <BackToTopButton />
    </AuthGuard>
  );
};

const App = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAInstallPrompt />
        <SeasonalEffects />
        <ChangelogModal />
        <BrowserRouter>
          <AppLayout user={user} />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
