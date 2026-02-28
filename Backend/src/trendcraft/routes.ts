import { Router } from 'express';
import {
  getFeed,
  getYouTube,
  getReddit,
  getHackerNews,
  getNews,
} from './controller';

const router = Router();

router.get('/feed', getFeed);
router.get('/youtube', getYouTube);
router.get('/reddit', getReddit);
router.get('/hackernews', getHackerNews);
router.get('/news', getNews);

// generate-content and content-suggestions are registered on main router at /trendcraft/*

export default router;
