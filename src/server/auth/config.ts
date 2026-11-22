// Auth settings from the Phase 1 spec (P1-AUTH-02, 05, 06).
export const SESSION_COOKIE = "t2t_session";

export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours idle for normal sessions
export const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for "Remember Me"
export const TOUCH_INTERVAL_MS = 5 * 60 * 1000; // update last_seen at most every 5 minutes

export const MAX_FAILED_PER_USER = 5; // lock the account after 5 failed attempts...
export const LOCK_MS = 15 * 60 * 1000; // ...for 15 minutes
export const MAX_FAILED_PER_IP = 20; // block an IP after 20 failures in the window
export const IP_WINDOW_MS = 15 * 60 * 1000;
