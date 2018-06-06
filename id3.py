import json
import sys
import os.path
from mutagen.id3 import (ID3, CTOC, CHAP, TIT2, TALB,
                         TPE1, COMM, USLT, APIC, CTOCFlags)

audio = ID3(sys.argv[1])

if len(sys.argv) > 2:
    data = json.loads(sys.argv[2])
    chapters = data["chapters"]
    ctoc_ids = list(map(lambda i: i.get("id"), chapters))

    audio.delall('TALB')
    audio["TALB"] = TALB(encoding=3, text=data["podcast_title"])

    audio.delall('TPE1')
    audio["TPE1"] = TPE1(encoding=3, text=data["podcast_title"])

    audio.delall('TIT2')
    audio["TIT2"] = TIT2(encoding=3, text=data["episode_title"])

    audio.delall('COMM')
    audio["COMM"] = COMM(encoding=3,
                         lang=u'eng',
                         text=data["episode_description"])

    audio.delall('USLT')
    audio["USLT"] = USLT(encoding=3,
                         lang=u'eng',
                         text=data["episode_description"])

    if "podcast_cover" in data and os.path.isfile(data["podcast_cover"]):
        audio.delall('APIC')
        audio["APIC"] = APIC(encoding=3,
                             mime='image/jpeg',
                             type=3,
                             desc=u'Cover',
                             data=open(data["podcast_cover"]).read())

    audio.delall('CTOC')
    audio.add(CTOC(element_id=u"toc",
                   flags=CTOCFlags.TOP_LEVEL | CTOCFlags.ORDERED,
                   child_element_ids=ctoc_ids,
                   sub_frames=[
                      TIT2(text=[u"TOC"]),
                   ]))

    audio.delall('CHAP')
    for chapter in chapters:
        audio.add(CHAP(element_id=chapter.get("id"),
                       start_time=int(chapter.get("start")),
                       end_time=int(chapter.get("end")),
                       sub_frames=[
                           TIT2(text=[chapter.get("title")]),
                       ]))

    audio.save()

for key, value in audio.items():
    print(value.pprint())
