# GPX to PNG

## synthesize attribution layer

```shell
$ TARGET={lat}-{lng}.png
$ SIZE=$(convert $TARGET -format "%wx%h" info:)
$ convert public/attribution.png -resize $SIZE public/attribution.$SIZE.png
$ convert $TARGET public/attribution.$SIZE.png -gravity center -compose over -composite output.png
$ rm public/attribution.$SIZE.png
```
