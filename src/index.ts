import fs from 'fs'
import path from 'path'
import cp from 'child_process'
import trash from 'trash'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const durationRange = 60 * 2
const videoFilesDir = path.join(__dirname, '..', '..')

function getExt(files: string[], ext: string) {
  return files.filter((filename) => path.parse(filename).ext === ext)
}

function getMediaDuration(videoPath: string, showInSeconds: true): Promise<number>
function getMediaDuration(videoPath: string, showInSeconds: false): Promise<string>
function getMediaDuration(videoPath: string, showInSeconds: boolean): Promise<number | string> {
  return new Promise((resolve, reject) => {
    try {
      const options = `-v error${showInSeconds ? ' ' : ' -sexagesimal '}-show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${videoPath}`

      const task = cp.spawn('ffprobe', options.split(' '))

      task.stdout.on('data', (msg) => {
        resolve(showInSeconds ? Number(msg.toString()) : String(msg.toString()))
      })

      task.stderr.on('data', (msg) => {
        console.log('data', msg.toString())

        reject(-1)
      })
    } catch (error) {
      reject(-1)
    }
  })
}

function getVideoFilePath(name: string, root = videoFilesDir) {
  return path.join(root, name)
}

async function init() {
  const files = fs.readdirSync(videoFilesDir)
  const mp4Files = getExt(files, '.mp4')
  const tsFiles = getExt(files, '.ts')

  for (const tsFile of tsFiles) {
    const tsFileName = path.parse(tsFile).name
    const tsFilePath = getVideoFilePath(tsFile)
    const mp4File = mp4Files.find((name) => path.parse(name).name.includes(tsFileName))

    if (!mp4File) continue

    const [mp4Duration, tsDuration] = await Promise.all([getMediaDuration(getVideoFilePath(mp4File), true), getMediaDuration(tsFilePath, true)])
    const range = Number(mp4Duration) - Number(tsDuration)
    const isSafeFile = Math.abs(range) <= durationRange

    if (isSafeFile) {
      // remove tsFile
      await trash(tsFilePath)
    } else {
      // warning file duration loss
      console.log('invalid:', tsFilePath, 'at range:', range)
    }
  }

  console.log('done!!!')
}

init()
