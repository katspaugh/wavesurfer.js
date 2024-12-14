import { defineConfig } from 'cypress'
import { addMatchImageSnapshotPlugin } from 'cypress-image-snapshot/plugin.js'

export default defineConfig({
  video: false,
  e2e: {
    setupNodeEvents(on, config) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome' || browser.name === 'chromium') {
          launchOptions.args.push('--force-device-scale-factor=1')
        }
        return launchOptions
      })

      addMatchImageSnapshotPlugin(on, config)
    },
  },
})
