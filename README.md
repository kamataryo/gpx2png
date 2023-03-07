# GPX to PNG

## synthesize attribution layer

```shell
$ TARGET={lat}-{lng}.png
$ SIZE=$(convert $TARGET -format "%wx%h" info:)
$ convert appendix/attribution.png -resize $SIZE appendix/attribution.$SIZE.tmp.png
$ convert $TARGET appendix/attribution.$SIZE.tmp.png -gravity center -compose over -composite output.png
$ rm appendix/attribution.$SIZE.tmp.png
```
