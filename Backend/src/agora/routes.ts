import { Router } from 'express';
import {
  createPost,
  listPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  tipPost,
  listUsers,
  tipUser,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getUserLikedPosts,
  createReply,
  listReplies,
  deleteReply,
  tipReply,
  getHomeFeed,
  getTrendingFeed,
  getUserPosts,
  getUserProfile,
  updateProfile,
  listSentTips,
  listReceivedTips,
  bookmarkPost,
  removeBookmark,
  listBookmarks,
  listConversations,
  getOrCreateConversation,
  getMessages,
  editMessage,
  deleteMessage,
  getMostTippedUsers,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  reportPost,
  reportUser,
  listReports,
  updateReportStatus,
  hidePost,
} from './controllers';
import { requireAuth, optionalAuth, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/admin/reports', requireAuth, requireAdmin, listReports);
router.patch('/admin/reports/:id', requireAuth, requireAdmin, updateReportStatus);
router.patch('/admin/posts/:id/hide', requireAuth, requireAdmin, hidePost);

router.get('/feed/trending', optionalAuth, getTrendingFeed);
router.get('/feed/user/:id', optionalAuth, getUserPosts);
router.get('/feed', requireAuth, getHomeFeed);

router.get('/me/tips/sent', requireAuth, listSentTips);
router.get('/me/tips/received', requireAuth, listReceivedTips);
router.get('/me/bookmarks', requireAuth, listBookmarks);

router.get('/notifications', requireAuth, listNotifications);
router.post('/notifications/read-all', requireAuth, markAllNotificationsRead);
router.patch('/notifications/:id/read', requireAuth, markNotificationRead);

router.patch('/users/me', requireAuth, updateProfile);
router.get('/users/most-tipped', optionalAuth, getMostTippedUsers);
router.get('/users', requireAuth, listUsers);
router.get('/users/:id/posts', optionalAuth, getUserPosts);
router.get('/users/:id', optionalAuth, getUserProfile);
router.post('/users/:id/report', requireAuth, reportUser);
router.post('/users/:id/tip', requireAuth, tipUser);
router.post('/users/:id/follow', requireAuth, followUser);
router.delete('/users/:id/follow', requireAuth, unfollowUser);
router.get('/users/:id/followers', optionalAuth, getFollowers);
router.get('/users/:id/following', optionalAuth, getFollowing);
router.get('/users/:id/liked', optionalAuth, getUserLikedPosts);

router.post('/posts', requireAuth, createPost);
router.get('/posts', optionalAuth, listPosts);
router.post('/posts/:id/report', requireAuth, reportPost);
router.post('/posts/:id/replies', requireAuth, createReply);
router.get('/posts/:id/replies', optionalAuth, listReplies);
router.post('/posts/:id/bookmark', requireAuth, bookmarkPost);
router.delete('/posts/:id/bookmark', requireAuth, removeBookmark);
router.post('/posts/:id/like', requireAuth, likePost);
router.delete('/posts/:id/like', requireAuth, unlikePost);
router.post('/posts/:id/tip', requireAuth, tipPost);
router.get('/posts/:id', optionalAuth, getPost);
router.patch('/posts/:id', requireAuth, updatePost);
router.delete('/posts/:id', requireAuth, deletePost);

router.delete('/replies/:id', requireAuth, deleteReply);
router.post('/replies/:id/tip', requireAuth, tipReply);

router.get('/conversations', requireAuth, listConversations);
router.post('/conversations', requireAuth, getOrCreateConversation);
router.get('/conversations/:id/messages', requireAuth, getMessages);
router.patch('/conversations/:convId/messages/:msgId', requireAuth, editMessage);
router.delete('/conversations/:convId/messages/:msgId', requireAuth, deleteMessage);

export default router;
