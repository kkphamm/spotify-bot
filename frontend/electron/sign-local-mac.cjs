const { execFileSync } = require('node:child_process')
const path = require('node:path')

module.exports = ({ appOutDir, packager }) => {
  const bundle = path.join(appOutDir, `${packager.appInfo.productFilename}.app`)
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' })
}
