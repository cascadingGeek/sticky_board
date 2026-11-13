import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Sticky Board',
    description: 'Your day as sticky notes on every new tab. Drag notes anywhere, set reminders, and keep everything in your browser.',
    minimum_chrome_version: '116',
    permissions: ['storage', 'unlimitedStorage', 'contextMenus', 'activeTab', 'alarms', 'notifications', 'scripting'],
    // No host permissions at install: site access is asked for one site at a time.
    // Chrome rejects a `*://site/*` request unless the manifest declares the `*` scheme.
    optional_host_permissions: ['*://*/*'],
    action: {
      default_title: 'Open Sticky Board',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Open Sticky Board',
      },
      'pin-note': {
        suggested_key: { default: 'Alt+Shift+N' },
        description: 'Pin a note on this page',
      },
    },
  },
});
