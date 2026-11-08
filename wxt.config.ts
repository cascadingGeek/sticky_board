import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// Sticky Board: a local first Chrome extension (spec 0001, child 0001).
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
    permissions: ['storage', 'unlimitedStorage', 'contextMenus', 'activeTab', 'alarms', 'notifications'],
    action: {
      default_title: 'Open Sticky Board',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Open Sticky Board',
      },
    },
  },
});
