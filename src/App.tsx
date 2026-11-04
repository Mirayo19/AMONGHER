import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import { PublicOnly, RequireAuth, RequireRole, Splash } from '@/components/Guards';
import { useAuth } from '@/state/auth';
import Landing from '@/pages/Landing';
import { Forgot, Login, ResetPassword, SignUp, VerifyEmail } from '@/pages/Auth';
import Onboarding from '@/pages/Onboarding';
import Setup from '@/pages/Setup';
import Home from '@/pages/Home';
import Explore, { ExploreCategory } from '@/pages/Explore';
import Share, { ComposerRoute } from '@/pages/Share';
import PostPage from '@/pages/PostPage';
import Library, { CollectionPage } from '@/pages/Library';
import Inbox, { Conversation } from '@/pages/Inbox';
import Understand from '@/pages/Understand';
import Wish from '@/pages/Wish';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import Safety, { NotFound, Suspended } from '@/pages/Safety';
import {
  AdminActivity, AdminAppeals, AdminCategories, AdminCollections, AdminContent, AdminLayout, AdminOverview,
  AdminReports, AdminUsers, AdminVerification,
} from '@/pages/admin/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/safety" element={<SafetyRoute />} />
      <Route path="/setup" element={<Setup />} />
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot" element={<Forgot />} />
      </Route>
      <Route path="/verify" element={<VerifyEmail />} />
      <Route path="/reset" element={<ResetPassword />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/suspended" element={<Suspended />} />
        <Route element={<AppShell />}>
          <Route path="/home" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/:slug" element={<ExploreCategory />} />
          <Route path="/understand" element={<Understand />} />
          <Route path="/wish" element={<Wish />} />
          <Route path="/share" element={<Share />} />
          <Route path="/share/:kind" element={<ComposerRoute />} />
          <Route path="/post/:id" element={<PostPage />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:slug" element={<CollectionPage />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/inbox/:id" element={<Conversation />} />
          <Route path="/me" element={<Profile />} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/safety-centre" element={<Safety />} />
          <Route element={<RequireRole roles={['moderator', 'admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="content" element={<AdminContent />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route element={<RequireRole roles={['admin']} />}>
                <Route path="users" element={<AdminUsers />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="collections" element={<AdminCollections />} />
                <Route path="verification" element={<AdminVerification />} />
                <Route path="appeals" element={<AdminAppeals />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** Signed-out visitors get the standalone page; members get the same content inside the app shell. */
function SafetyRoute() {
  const { me, loading } = useAuth();
  const { hash } = useLocation();
  if (loading) return <Splash />;
  return me ? <Navigate to={`/safety-centre${hash}`} replace /> : <Safety />;
}
