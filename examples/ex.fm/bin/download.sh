#!/bin/sh

url="http://ex.fm/api/v3/trending/tag/ambient"
json="data/songs.json"
images="images/waveforms"
audio="tmp"

files=`curl -s $url | egrep -o '[^"]+\.mp3[^"]*'`
d=`date "+%Y-%m-%d"`
n=0

function putJSON() {
    [ $n == 0 ] && comma='' || comma=','
    echo "$comma{\"url\":\"$song\",\"waveform\":\"$images/$filename.png\"}" >> "$json"
    let n=n+1
}

rm -rf "$audio"
mkdir "$audio"

echo '[' > "$json"

for song in $files; do
    echo "Downloading $song..."
    curl -s "$song" > "$audio/$n"
    filename="$d-$n"
    node bin/waveform.js "$audio/$n" "$images/$filename.png" && putJSON
done;

echo ']' >> "$json"
