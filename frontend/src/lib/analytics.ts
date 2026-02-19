import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = '9b4f847cce1ad09a5ee0276d48de336c';

export function initAnalytics() {
  mixpanel.init(MIXPANEL_TOKEN, {
    track_pageview: 'url-with-path',
    persistence: 'localStorage',
  });
}

export function identify(userId: string, props?: Record<string, unknown>) {
  mixpanel.identify(userId);
  if (props) mixpanel.people.set(props);
}

export function reset() {
  mixpanel.reset();
}

export function track(event: string, props?: Record<string, unknown>) {
  mixpanel.track(event, props);
}
