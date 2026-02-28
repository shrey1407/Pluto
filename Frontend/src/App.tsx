import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import LoginCallback from './pages/LoginCallback'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import Campaigns from './pages/Campaigns'
import CampaignDetail from './pages/CampaignDetail'
import ChainLens from './pages/ChainLens'
import Trendcraft from './pages/Trendcraft'
import PulseBot from './pages/PulseBot'
import AgoraLayout from './layouts/AgoraLayout'
import AgoraFeed from './pages/AgoraFeed'
import AgoraUserProfile from './pages/AgoraUserProfile'
import AgoraThread from './pages/AgoraThread'
import AgoraBookmarks from './pages/AgoraBookmarks'
import AgoraTips from './pages/AgoraTips'
import AgoraMessages from './pages/AgoraMessages'
import AgoraMostTipped from './pages/AgoraMostTipped'
import AgoraExplore from './pages/AgoraExplore'
import AgoraAdminReports from './pages/AgoraAdminReports'
import AgoraNotifications from './pages/AgoraNotifications'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Docs from './pages/Docs'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/chainlens" element={<ChainLens />} />
        <Route path="/trendcraft" element={<Trendcraft />} />
        <Route path="/pulsebot" element={<PulseBot />} />
        <Route path="/integrations" element={<Navigate to={{ pathname: '/pulsebot', search: window.location.search }} replace />} />
        <Route path="/agora/messages" element={<AgoraMessages />} />
        <Route path="/agora/messages/:id" element={<AgoraMessages />} />
        <Route path="/agora" element={<AgoraLayout />}>
          <Route index element={<AgoraFeed />} />
          <Route path="tips" element={<AgoraTips />} />
          <Route path="bookmarks" element={<AgoraBookmarks />} />
          <Route path="notifications" element={<AgoraNotifications />} />
          <Route path="most-tipped" element={<AgoraMostTipped />} />
          <Route path="explore" element={<AgoraExplore />} />
          <Route path="admin/reports" element={<AgoraAdminReports />} />
          <Route path="user/:id" element={<AgoraUserProfile />} />
          <Route path="thread/:id" element={<AgoraThread />} />
        </Route>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
