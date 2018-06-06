# @lukekarrys/audiobook

Take some `wav` files and try to make a chapterized `mp3`.

It's a mess and a hack (see the prereqs), but it kinda sorta works.

## Prereqs:

- `mediainfo`
- `ffmpeg`
- `sox`
- `python@2` + `mutagen`
- `node 8+`

## Usage

```sh
brew install mediainfo ffmpeg sox python@2
pip install mutagen
npm install @lukekarrys/audiobook -g
audiobook \
  # Directory to look for wavfiles
  # Generated files will be put as siblings of this directory
  --dir "./data/wavs" \
  # This will be the name of the generated files and the episodes title
  --title "An Awesome Great Book" \
  # It will look for this file in --dir
  --cover "cover.jpg" \
  # Delete generated files first before running
  # Helpful if you want to run it again from scratch, otherwise
  # the previously generated wav and mp3 files are reused
  --clean true
# Output looks like
# { metadata: {...}, tags: {...} }
```

```sh
data
├── wavs # This directory already existed
│   ├── 1-01 Opening Titles.wav
│   ├── 1-02 Dedication.wav
│   ├── 1-03 Introduction A.wav
│   ├── 1-04 Introduction B.wav
│   ├── 2-01 Chapter 1a.wav
│   ├── 2-02 Chapter 1b.wav
│   ├── 2-03 Chapter 2a.wav
│   ├── 2-04 Chapter 2b.wav
│   ├── 2-05 Chapter 2c.wav
│   ├── 3-01 End Credits.wav
│   └── cover.jpg
├── An Awesome Great Book.mp3  # Generated combined mp3 file w/ chapters
└── An Awesome Great Book.wav  # Generated combined wav file
```

### LICENSE

MIT
