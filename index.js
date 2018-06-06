const fs = require('fs')
const { promisify } = require('util')
const path = require('path')
const cp = require('child-process-promise')
const rimraf = require('rimraf')
const { groupBy } = require('lodash')

// Write stuff to stderr when in cli mode but not stdout so that the output
// can be read with whatever it is passed to
const noop = () => {}
const { CLI_MODE } = global
// eslint-disable-next-line no-console
const log = (...log) => (!CLI_MODE ? noop : console.error(...log))
log.single = !CLI_MODE ? noop : require('single-line-log')(process.stderr)
log.reset = () => (!CLI_MODE ? noop : (log.single(''), log.single.clear()))

const EXTS = {
  WAV: '.wav',
  MP3: '.mp3'
}

const promisifyAll = m =>
  Object.keys(m).reduce(
    (a, k) => ((a[k] = m[k][promisify.custom] || promisify(m[k])), a),
    {}
  )

const fsp = promisifyAll({
  rimraf,
  readdir: fs.readdir,
  access: {
    [promisify.custom]: file =>
      new Promise(r => fs.access(file, fs.constants.F_OK, e => r(!e)))
  }
})

const el = s => ((Date.now() - s) / 1000).toFixed(1)
const args = (...args) => args.map(a => `'${a}'`).join(' ')

const exec = async cmd => {
  log(cmd.replace(new RegExp(process.cwd(), 'g'), '.'))

  // Start a timer for that updates every .1 seconds but doesnt start for a few
  // hundred ms to avoid a flash for quick commands
  const start = Date.now()
  let interval
  const timeout = setTimeout(
    () => (interval = setInterval(() => log.single(el(start)), 100)),
    200
  )

  const resp = await cp.exec(cmd)

  clearInterval(interval)
  clearTimeout(timeout)
  log.reset()
  log('-'.repeat(80))

  return resp.stdout.trim()
}

const getDuration = f =>
  exec(`mediainfo --Inform="General;%Duration%" ${args(f)}`)

const getMp3 = async (wav, mp3, bitrate) => {
  if (!(await fsp.access(mp3))) {
    await exec(
      `ffmpeg -i ${args(wav)} -codec:a libmp3lame -b:a ${bitrate}k ${args(mp3)}`
    )
  }
  return mp3
}

const getCombinedWav = async (files, out) => {
  if (!(await fsp.access(out))) {
    await exec(`sox ${args(...files.map(({ path }) => path), out)}`)
  }
  return out
}

const getFiles = async (
  dir,
  {
    // Strips "Part 1 - " prefix and tries to remove a letter suffix from the end
    // in order to group things like "Chapter 3a" and "Chapter 3b" together
    group: groupMatch = title => {
      const group = title.match(/^(Part \d+ - )?(.*)([\s\d]+)[A-Za-z]$/)
      return group && group[3] ? (group[2] + group[3]).trim() : title
    },
    // Strips iTunes "1-01 " disc+track prefix
    title: titleMatch = file => file.match(/^(\d+-\d+ )?(.*)\.wav$/)[2].trim()
  } = {}
) =>
  (await fsp.readdir(dir))
    .filter(file => file.endsWith(EXTS.WAV))
    .slice(0, 3)
    .map(file => ({
      path: path.join(dir, file),
      title: titleMatch(file),
      group: groupMatch(titleMatch(file))
    }))

const getChapters = async files => {
  const chapters = []
  const groups = groupBy(files, 'group')
  const titles = Object.keys(groups)

  let nextStart = 0

  for (const title of titles) {
    let duration = 0
    for (const file of groups[title]) {
      duration += parseInt(await getDuration(file.path))
    }
    chapters.push({
      title,
      id: `chp${titles.indexOf(title) + 1}`,
      start: nextStart,
      end: nextStart + duration
    })
    nextStart += duration
  }

  return chapters
}

const parseId3 = str =>
  str.split('\n').reduce((acc, line, index, lines) => {
    const SUB_KEY = 'VALUES'
    let [tag, tagValues] = line.split(/=(.+)/)
    const indent = tag.startsWith(' ')
    tag = tag.trim()
    tagValues = tagValues.trim()

    if (indent) {
      const [parentTag, parentValues] = lines
        .slice(0, index)
        .reverse()
        .find(l => !l.startsWith(' '))
        .trim()
        .split(/=(.+)/)

      let parent = acc[parentTag]
      let parentIndex = null
      if (Array.isArray(parent)) {
        parentIndex = parent.findIndex(p => (p[SUB_KEY] || p) === parentValues)
        parent = parent[parentIndex]
      }

      const getNewValues = () =>
        Object.assign(
          {},
          typeof parent === 'string' ? { [SUB_KEY]: parent } : parent,
          { [tag]: tagValues }
        )

      if (typeof parentIndex === 'number') {
        acc[parentTag][parentIndex] = getNewValues()
      } else {
        acc[parentTag] = getNewValues()
      }
    } else if (acc[tag]) {
      acc[tag] = [
        ...(Array.isArray(acc[tag]) ? acc[tag] : [acc[tag]]),
        tagValues
      ]
    } else {
      acc[tag] = tagValues
    }

    return acc
  }, {})

const writeId3 = async (...arg) =>
  parseId3(
    await exec(`python ${path.resolve(__dirname, 'id3.py')} ${args(...arg)}`)
  )

module.exports = async ({
  dir,
  title,
  podcast = 'My Audiobooks',
  author = 'Author',
  cover = 'cover.jpg',
  clean = true,
  bitrate = 64,
  match = {}
}) => {
  dir = path.resolve(process.cwd(), dir)
  title = title || path.basename(dir)
  const outDir = path.resolve(dir, '..')
  const outPath = path.join(outDir, title)

  if (clean) {
    await fsp.rimraf(path.join(outDir, `*{${Object.values(EXTS).join(',')}}`))
  }

  const files = await getFiles(dir, match)
  const chapters = await getChapters(files)
  const wav = await getCombinedWav(files, outPath + EXTS.WAV)
  const mp3 = await getMp3(wav, outPath + EXTS.MP3, bitrate)

  const metadata = {
    podcast_cover: path.join(dir, cover),
    podcast_title: podcast,
    episode_title: title,
    episode_description: `${title} by ${author}`,
    chapters
  }

  const tags = await writeId3(mp3, JSON.stringify(metadata))

  return { metadata, tags }
}
