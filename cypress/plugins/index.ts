export default (on) => {
  on('before:browser:launch', (_, launchOptions) => {
    launchOptions.args.push('--force-device-scale-factor=2')
    return launchOptions
  })
}
