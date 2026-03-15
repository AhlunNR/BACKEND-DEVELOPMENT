import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import { googleOAuth, githubOAuth, oauthCallback, getMe, logout } from '../controllers/auth.controller.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    module: 'auth',
    endpoints: [
      { method: 'GET',  path: '/api/v1/auth/google',   auth: false },
      { method: 'GET',  path: '/api/v1/auth/github',   auth: false },
      { method: 'GET',  path: '/api/v1/auth/callback', auth: false },
      { method: 'GET',  path: '/api/v1/auth/me',       auth: true  },
      { method: 'POST', path: '/api/v1/auth/logout',   auth: true  },
    ],
  });
});

router.get('/google',   googleOAuth);
router.get('/github',   githubOAuth);
router.get('/callback', oauthCallback);
router.get('/me',       authenticate, getMe);
router.post('/logout',  authenticate, logout);

export default router;
