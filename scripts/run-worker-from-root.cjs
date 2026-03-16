/**
 * プロジェクトルート（package.json があるディレクトリ）に cd してから
 * image-resize-worker を起動する。Render で cwd が src 配下になっている場合の対策。
 */
'use strict'
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

let dir = __dirname
while (dir !== path.dirname(dir)) {
  if (fs.existsSync(path.join(dir, 'package.json'))) {
    break
  }
  dir = path.dirname(dir)
}
process.chdir(dir)
const env = { ...process.env, TS_NODE_PROJECT: path.join(dir, 'tsconfig.worker.json') }
const result = spawnSync(
  'node',
  ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'scripts/image-resize-worker.ts'],
  { cwd: dir, stdio: 'inherit', shell: false, env }
)
process.exit(result.status ?? 1)
