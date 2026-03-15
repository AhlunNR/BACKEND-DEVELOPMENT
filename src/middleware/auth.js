import { supabaseAdmin } from '../config/supabase.js';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided. Please include Authorization: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      metadata: user.user_metadata,
    };

    next();
  } catch (err) {
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Authentication failed due server error',
    });
  }
};

export default authenticate;
