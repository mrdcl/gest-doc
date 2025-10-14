import posthog from 'posthog-js';

// Check if telemetry is enabled (based on user consent)
export function isTelemetryEnabled(): boolean {
  return localStorage.getItem('telemetry_consent') === 'true';
}

// Enable telemetry (user gives consent)
export function enableTelemetry() {
  localStorage.setItem('telemetry_consent', 'true');
  initializeTelemetry();
}

// Disable telemetry (user revokes consent)
export function disableTelemetry() {
  localStorage.setItem('telemetry_consent', 'false');
  posthog.opt_out_capturing();
}

// Initialize PostHog
export function initializeTelemetry() {
  if (!isTelemetryEnabled()) {
    return;
  }

  const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not configured. Telemetry disabled.');
    return;
  }

  posthog.init(apiKey, {
    api_host: apiHost,
    autocapture: false, // Manual event tracking only
    capture_pageview: false, // We'll track pageviews manually
    disable_session_recording: true, // Privacy-first approach
  });
}

// Track page view
export function trackPageView(pageName: string, properties?: Record<string, any>) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('$pageview', {
    $current_url: window.location.href,
    page_name: pageName,
    ...properties,
  });
}

// Auth events
export function trackAuthLoginSuccess(userId: string, email: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('auth_login_success', {
    user_id: userId,
    email,
    timestamp: new Date().toISOString(),
  });

  // Identify user for session tracking
  posthog.identify(userId, {
    email,
  });
}

export function trackAuthLoginFail(reason: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('auth_login_fail', {
    reason,
    timestamp: new Date().toISOString(),
  });
}

export function trackAuthLogout(userId: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('auth_logout', {
    user_id: userId,
    timestamp: new Date().toISOString(),
  });

  posthog.reset(); // Clear user identity
}

// Category events
export function trackCategoryCreate(categoryId: string, categoryName: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('category_create_success', {
    category_id: categoryId,
    category_name: categoryName,
    timestamp: new Date().toISOString(),
  });
}

export function trackCategoryCreateFail(reason: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('category_create_fail', {
    reason,
    timestamp: new Date().toISOString(),
  });
}

// Document upload events
export function trackDocUploadStart(fileName: string, fileSize: number) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('doc_upload_start', {
    file_name: fileName,
    file_size: fileSize,
    timestamp: new Date().toISOString(),
  });
}

export function trackDocUploadSuccess(documentId: string, fileName: string, fileSize: number, duration: number) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('doc_upload_success', {
    document_id: documentId,
    file_name: fileName,
    file_size: fileSize,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
  });
}

export function trackDocUploadFail(fileName: string, reason: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('doc_upload_fail', {
    file_name: fileName,
    reason,
    timestamp: new Date().toISOString(),
  });
}

// Share events
export function trackSharePreflightBlocked(documentId: string, reason: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('share_preflight_blocked', {
    document_id: documentId,
    reason,
    timestamp: new Date().toISOString(),
  });
}

export function trackShareSuccess(documentId: string, shareWithUserId: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('share_success', {
    document_id: documentId,
    share_with_user_id: shareWithUserId,
    timestamp: new Date().toISOString(),
  });
}

// Search events
export function trackSearchQuery(query: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('search_query', {
    query,
    query_length: query.length,
    timestamp: new Date().toISOString(),
  });
}

export function trackSearchRun(query: string, resultCount: number, duration: number) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('search_run', {
    query,
    result_count: resultCount,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
  });
}

export function trackSearchResultClick(query: string, documentId: string, position: number) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('search_result_click', {
    query,
    document_id: documentId,
    position,
    timestamp: new Date().toISOString(),
  });
}

// Document view events
export function trackDocumentView(documentId: string, fileName: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('doc_view', {
    document_id: documentId,
    file_name: fileName,
    timestamp: new Date().toISOString(),
  });
}

// Document download events
export function trackDocumentDownload(documentId: string, fileName: string) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('doc_download', {
    document_id: documentId,
    file_name: fileName,
    timestamp: new Date().toISOString(),
  });
}

// Time to First Value (TTFV) - Track when user uploads first document
export function trackFirstValueAchieved(timeSinceSignup: number) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('first_value_achieved', {
    time_since_signup_ms: timeSinceSignup,
    timestamp: new Date().toISOString(),
  });
}

// Activation metric - User uploaded at least 1 document within 24 hours
export function trackUserActivated(timeSinceSignup: number) {
  if (!isTelemetryEnabled()) return;

  posthog.capture('user_activated', {
    time_since_signup_ms: timeSinceSignup,
    timestamp: new Date().toISOString(),
  });

  // Set user property for activation
  posthog.people.set({
    activated: true,
    activation_date: new Date().toISOString(),
  });
}

// Generic event tracker for custom events
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!isTelemetryEnabled()) return;

  posthog.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

// Get PostHog instance for advanced usage
export function getPostHog() {
  return posthog;
}
