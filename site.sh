#!/bin/sh
# The files that make up the site, copied to $1: the pages, the games and their shared code.
# One list for every way it's served (GitHub Pages, the Docker image); tests and repo files stay out.
set -eu
dest=${1:?usage: site.sh <dest>}
mkdir -p "$dest"
cp -r index.html .nojekyll games shared "$dest"/
find "$dest" -name '*.test.js' -delete
